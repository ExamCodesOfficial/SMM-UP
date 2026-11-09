import { MongoClient, Db } from "mongodb";

const dbName = process.env.DATABASE_NAME || "smm_up_db";

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = global as unknown as GlobalWithMongo;

function clientConnection(): Promise<MongoClient> {
  if (!globalWithMongo._mongoClientPromise) {
    const uri = String(process.env.MONGODB_URI || "").trim();
    if (!uri) return Promise.reject(new Error("MONGODB_URI environment variable is required"));
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
    });
    globalWithMongo._mongoClientPromise = client.connect().catch((error) => {
      globalWithMongo._mongoClientPromise = undefined;
      throw error;
    });
  }
  return globalWithMongo._mongoClientPromise;
}

/** Returns the shared client for operations that require MongoDB transactions. */
export async function getMongoClient(): Promise<MongoClient> {
  return clientConnection();
}

let coreIndexesPromise: Promise<void> | null = null;
let identityIndexesPromise: Promise<void> | null = null;
let legacyCredentialIndexesPromise: Promise<void> | null = null;
let directUpiIndexesPromise: Promise<void> | null = null;
let razorpayIndexesPromise: Promise<void> | null = null;
let apiKeyIndexesPromise: Promise<void> | null = null;
let sessionIndexesPromise: Promise<void> | null = null;
let paymentProviderIndexesPromise: Promise<void> | null = null;

/**
 * Financial uniqueness indexes for the hosted payment providers (FamGateway,
 * OxaPay) plus the shared wallet/event keys every provider relies on.
 * Awaited by provider writes — a missing index means the write fails closed.
 */
export async function ensurePaymentProviderIndexes(): Promise<void> {
  if (!paymentProviderIndexesPromise) {
    paymentProviderIndexesPromise = clientConnection().then(async (client) => {
      const db = client.db(dbName);
      await Promise.all([
        // One FamGateway order maps to exactly one SMM UP transaction.
        // The name and filter MUST match the admin bot's definition exactly:
        // MongoDB rejects two indexes over the same key with different names.
        db.collection("transactions").createIndex(
          { famgateway_order_id: 1 },
          {
            name: "transactions_famgateway_order_id_unique",
            unique: true,
            partialFilterExpression: { famgateway_order_id: { $type: "string" } },
          },
        ),
        // One OxaPay invoice maps to exactly one SMM UP transaction.
        db.collection("transactions").createIndex(
          { oxapay_track_id: 1 },
          {
            name: "transactions_oxapay_track_id_unique",
            unique: true,
            partialFilterExpression: { oxapay_track_id: { $type: "string" } },
          },
        ),
        // Per-chain idempotency: a tx_hash can never credit twice.
        db.collection("crypto_payment_txs").createIndex({ track_id: 1, created_at: -1 }),
        // Shared settlement/event keys — provider agnostic by design.
        db.collection("wallet_ledger").createIndex(
          { settlement_key: 1 },
          {
            unique: true,
            partialFilterExpression: { settlement_key: { $type: "string" } },
          },
        ),
        db.collection("payment_events").createIndex(
          { provider: 1, event_id: 1 },
          { unique: true },
        ),
        // Bot -> website internal channel replay protection.
        db.collection("internal_request_nonces").createIndex(
          { nonce: 1 },
          { unique: true },
        ),
        db.collection("internal_request_nonces").createIndex(
          { expires_at: 1 },
          { expireAfterSeconds: 0 },
        ),
        // Owner control-panel state (single singleton document).
        db.collection("payment_method_config").createIndex(
          { updated_at: -1 },
          { name: "payment_method_config_updated_at" },
        ),
      ]);
    }).catch((error) => {
      // Allow a later cold/warm request to retry after a transient database error.
      paymentProviderIndexesPromise = null;
      throw error;
    });
  }
  return paymentProviderIndexesPromise;
}

/** Financial uniqueness indexes are awaited by Razorpay writes (fail closed). */
export async function ensureRazorpayIndexes(): Promise<void> {
  if (!razorpayIndexesPromise) {
    razorpayIndexesPromise = clientConnection().then(async (client) => {
      const db = client.db(dbName);
      await Promise.all([
        db.collection("transactions").createIndex(
          { razorpay_order_id: 1 },
          { unique: true, sparse: true },
        ),
        db.collection("transactions").createIndex(
          { razorpay_payment_id: 1 },
          { unique: true, sparse: true },
        ),
        db.collection("wallet_ledger").createIndex(
          { settlement_key: 1 },
          {
            unique: true,
            partialFilterExpression: { settlement_key: { $type: "string" } },
          },
        ),
        db.collection("payment_events").createIndex(
          { provider: 1, event_id: 1 },
          { unique: true },
        ),
      ]);
    }).catch((error) => {
      // Allow a later cold/warm request to retry after a transient database error.
      razorpayIndexesPromise = null;
      throw error;
    });
  }
  return razorpayIndexesPromise;
}

/** Critical API-key lifecycle indexes are awaited before key writes/authentication. */
export async function ensureApiKeyIndexes(): Promise<void> {
  if (!apiKeyIndexesPromise) {
    apiKeyIndexesPromise = clientConnection().then(async (client) => {
      const db = client.db(dbName);
      await Promise.all([
        db.collection("api_keys").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("api_keys").createIndex(
          { user_id: 1, active_name_normalized: 1 },
          {
            unique: true,
            partialFilterExpression: { active_name_normalized: { $type: "string" } },
          },
        ),
        db.collection("api_keys").createIndex(
          { user_id: 1, creation_idempotency_key: 1 },
          {
            unique: true,
            partialFilterExpression: { creation_idempotency_key: { $type: "string" } },
          },
        ),
        db.collection("api_keys").createIndex(
          { user_id: 1, legacy_migrated: 1 },
          {
            unique: true,
            partialFilterExpression: { legacy_migrated: true },
          },
        ),
        db.collection("api_key_versions").createIndex({ secret_hash: 1 }, { unique: true }),
        db.collection("api_key_versions").createIndex({ key_id: 1, version: 1 }, { unique: true }),
        db.collection("api_key_activity").createIndex({ user_id: 1, completed_at: -1 }),
        db.collection("api_key_activity").createIndex({ api_key_id: 1, completed_at: -1 }),
        db.collection("api_key_activity").createIndex({ api_key_id: 1, action: 1, completed_at: -1 }),
        db.collection("api_key_activity").createIndex({ api_key_id: 1, order_id: 1 }),
        db.collection("api_key_activity").createIndex({ api_key_id: 1, service_id: 1, completed_at: -1 }),
        db.collection("api_key_activity").createIndex(
          { completed_at: 1 },
          { expireAfterSeconds: 60 * 60 * 24 * 90 },
        ),
        db.collection("api_key_audit").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("api_key_audit").createIndex({ api_key_id: 1, created_at: -1 }),
        db.collection("api_key_spend_buckets").createIndex(
          { key_id: 1, period_type: 1, period_key: 1 },
          { unique: true },
        ),
        db.collection("wallet_ledger").createIndex(
          { settlement_key: 1 },
          {
            unique: true,
            partialFilterExpression: { settlement_key: { $type: "string" } },
          },
        ),
        db.collection("orders").createIndex({ api_key_id: 1, created_at: -1 }),
        db.collection("orders").createIndex({ api_key_id: 1, service_id: 1, created_at: -1 }),
        db.collection("wallet_ledger").createIndex({ api_key_id: 1, created_at: -1 }),
      ]);
    }).catch((error) => {
      apiKeyIndexesPromise = null;
      throw error;
    });
  }
  return apiKeyIndexesPromise;
}

/** Session/token uniqueness and expiry indexes are awaited before issuance. */
export async function ensureSessionIndexes(): Promise<void> {
  if (!sessionIndexesPromise) {
    sessionIndexesPromise = clientConnection().then(async (client) => {
      const db = client.db(dbName);
      await Promise.all([
        db.collection("sessions").createIndex({ token_hash: 1 }, { unique: true }),
        db.collection("sessions").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("sessions").createIndex({ actor_admin_id: 1, created_at: -1 }),
        db.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
        db.collection("restricted_sessions").createIndex({ token_hash: 1 }, { unique: true }),
        db.collection("restricted_sessions").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("restricted_sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
        db.collection("temporary_passwords").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("temporary_passwords").createIndex({ expires_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
        db.collection("support_access_codes").createIndex({ code_hash: 1 }, { unique: true }),
        db.collection("support_access_codes").createIndex(
          { subject_user_id: 1 },
          {
            unique: true,
            partialFilterExpression: { consumed_at: null, invalidated_at: null },
            name: "one_active_support_code_per_subject",
          },
        ),
        db.collection("support_access_codes").createIndex({ expires_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 }),
        db.collection("support_access_audit").createIndex({ actor_admin_id: 1, created_at: -1 }),
        db.collection("support_access_audit").createIndex({ subject_user_id: 1, created_at: -1 }),
        db.collection("support_access_audit").createIndex({ session_id: 1, created_at: -1 }),
      ]);
    }).catch((error) => {
      sessionIndexesPromise = null;
      throw error;
    });
  }
  return sessionIndexesPromise;
}

/**
 * Registration-only identity constraints. Legacy production has a non-unique
 * username_1 index, so new registrations use a canonical field that old rows do
 * not contain. This gives concurrent new signups atomic uniqueness without a
 * destructive rewrite of existing accounts.
 */
export async function ensureIdentityIndexes(suppliedDb?: Db): Promise<void> {
  if (!identityIndexesPromise) {
    identityIndexesPromise = (async () => {
      const db = suppliedDb || (await clientConnection()).db(dbName);
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("users").createIndex(
          { username_normalized: 1 },
          {
            name: "users_username_normalized_unique_v2",
            unique: true,
            partialFilterExpression: { username_normalized: { $type: "string" } },
          },
        ),
      ]);
    })().catch((error) => {
      identityIndexesPromise = null;
      throw error;
    });
  }
  return identityIndexesPromise;
}

/** Legacy API credentials fail closed without making normal website login depend on their migration. */
export async function ensureLegacyCredentialIndexes(suppliedDb?: Db): Promise<void> {
  if (!legacyCredentialIndexesPromise) {
    legacyCredentialIndexesPromise = (async () => {
      const db = suppliedDb || (await clientConnection()).db(dbName);
      await Promise.all([
        db.collection("users").createIndex(
          { api_key: 1 },
          {
            name: "users_legacy_api_key_unique_v2",
            unique: true,
            partialFilterExpression: { api_key: { $type: "string" } },
          },
        ),
        db.collection("users").createIndex(
          { api_key_hash: 1 },
          {
            name: "users_legacy_api_key_hash_unique_v2",
            unique: true,
            partialFilterExpression: { api_key_hash: { $type: "string" } },
          },
        ),
      ]);
    })().catch((error) => {
      legacyCredentialIndexesPromise = null;
      throw error;
    });
  }
  return legacyCredentialIndexesPromise;
}

/** Direct-UPI creation/settlement fails closed if legacy memo data cannot be made unique. */
export async function ensureDirectUpiIndexes(suppliedDb?: Db): Promise<void> {
  if (!directUpiIndexesPromise) {
    directUpiIndexesPromise = (async () => {
      const db = suppliedDb || (await clientConnection()).db(dbName);
      await Promise.all([
        db.collection("transactions").createIndex(
          { memo: 1 },
          {
            name: "transactions_memo_unique_v2",
            unique: true,
            partialFilterExpression: { memo: { $type: "string" } },
          },
        ),
        db.collection("direct_upi_amount_reservations").createIndex(
          { amount_paise: 1 },
          { name: "direct_upi_reserved_amount_unique", unique: true },
        ),
        db.collection("direct_upi_amount_reservations").createIndex(
          { expires_at: 1 },
          { name: "direct_upi_reserved_amount_expiry", expireAfterSeconds: 0 },
        ),
      ]);
    })().catch((error) => {
      directUpiIndexesPromise = null;
      throw error;
    });
  }
  return directUpiIndexesPromise;
}

export async function ensureCoreIndexes(suppliedDb?: Db): Promise<void> {
  if (!coreIndexesPromise) {
    coreIndexesPromise = (async () => {
      const db = suppliedDb || (await clientConnection()).db(dbName);
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("processed_transactions").createIndex({ utr: 1 }, { unique: true, sparse: true }),
        db.collection("processed_transactions").createIndex({ transaction_id: 1 }, { unique: true, sparse: true }),
        db.collection("processed_transactions").createIndex({ memo: 1 }, { unique: true, sparse: true }),
        db.collection("orders").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("transactions").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("payment_reconciliation").createIndex(
          { memo: 1, status: 1, reason: 1 },
          { unique: true, partialFilterExpression: { status: "open" } },
        ),
        db.collection("transactions").createIndex(
          { direct_upi_settlement_key: 1 },
          { unique: true, partialFilterExpression: { direct_upi_settlement_key: { $type: "string" } } },
        ),
        db.collection("transactions").createIndex({ razorpay_order_id: 1 }, { unique: true, sparse: true }),
        db.collection("transactions").createIndex({ razorpay_payment_id: 1 }, { unique: true, sparse: true }),
        db.collection("wallet_ledger").createIndex(
          { settlement_key: 1 },
          { unique: true, partialFilterExpression: { settlement_key: { $type: "string" } } },
        ),
        db.collection("wallet_ledger").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("payment_events").createIndex({ provider: 1, event_id: 1 }, { unique: true }),
        db.collection("reviews").createIndex({ user_id: 1 }, { unique: true, sparse: true }),
        db.collection("reviews").createIndex({ seed_key: 1 }, { unique: true, sparse: true }),
        db.collection("reviews").createIndex({ status: 1, created_at: -1 }),
        db.collection("security_events").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("security_events").createIndex({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }),
        db.collection("email_verification_tokens").createIndex({ token_hash: 1 }, { unique: true }),
        db.collection("email_verification_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
        db.collection("rate_limits").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
      ]);
    })().catch((error) => {
      coreIndexesPromise = null;
      throw error;
    });
  }
  return coreIndexesPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientConnection();
  // Runtime reads and existing-account authentication must not be held hostage
  // by an online schema migration. Security-critical write paths await their
  // dedicated index guards above; ensureCoreIndexes remains available for
  // controlled provisioning and validation outside the request entry point.
  return client.db(dbName);
}
