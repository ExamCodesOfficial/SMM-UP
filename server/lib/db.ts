import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is required");
const dbName = process.env.DATABASE_NAME || "smm_up_db";

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = global as unknown as GlobalWithMongo;

let clientPromise: Promise<MongoClient>;

if (!globalWithMongo._mongoClientPromise) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000,
  });
  globalWithMongo._mongoClientPromise = client.connect();
}
clientPromise = globalWithMongo._mongoClientPromise;

/** Returns the shared client for operations that require MongoDB transactions. */
export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

let coreIndexesPromise: Promise<void> | null = null;
let razorpayIndexesPromise: Promise<void> | null = null;
let apiKeyIndexesPromise: Promise<void> | null = null;
let sessionIndexesPromise: Promise<void> | null = null;

/** Financial uniqueness indexes are awaited by Razorpay writes (fail closed). */
export async function ensureRazorpayIndexes(): Promise<void> {
  if (!razorpayIndexesPromise) {
    razorpayIndexesPromise = clientPromise.then(async (client) => {
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
    apiKeyIndexesPromise = clientPromise.then(async (client) => {
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
    sessionIndexesPromise = clientPromise.then(async (client) => {
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

export async function ensureCoreIndexes(suppliedDb?: Db): Promise<void> {
  if (!coreIndexesPromise) {
    coreIndexesPromise = (async () => {
      const db = suppliedDb || (await clientPromise).db(dbName);
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("users").createIndex(
          { username: 1 },
          { unique: true, collation: { locale: "en", strength: 2 } },
        ),
        db.collection("users").createIndex({ api_key: 1 }, { unique: true, sparse: true }),
        db.collection("processed_transactions").createIndex({ utr: 1 }, { unique: true, sparse: true }),
        db.collection("processed_transactions").createIndex({ transaction_id: 1 }, { unique: true, sparse: true }),
        db.collection("processed_transactions").createIndex({ memo: 1 }, { unique: true, sparse: true }),
        db.collection("orders").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("transactions").createIndex({ user_id: 1, created_at: -1 }),
        db.collection("transactions").createIndex({ memo: 1 }, { unique: true, sparse: true }),
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
  const client = await clientPromise;
  const db = client.db(dbName);
  await ensureCoreIndexes(db);
  return db;
}

export default clientPromise;
