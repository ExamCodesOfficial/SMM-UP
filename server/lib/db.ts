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

let indexesCreated = false;
let razorpayIndexesPromise: Promise<void> | null = null;

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

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);

  // Ensure indexes lazily only once in lifecycle
  if (!indexesCreated) {
    indexesCreated = true;
    Promise.allSettled([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      // Case-insensitive uniqueness: "Aryan" and "aryan" are the same account
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
      db.collection("transactions").createIndex({ memo: 1 }, { sparse: true }),
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
      db.collection("wallet_ledger").createIndex({ user_id: 1, created_at: -1 }),
      db.collection("payment_events").createIndex(
        { provider: 1, event_id: 1 },
        { unique: true },
      ),
      db.collection("reviews").createIndex({ user_id: 1 }, { unique: true, sparse: true }),
      db.collection("reviews").createIndex({ seed_key: 1 }, { unique: true, sparse: true }),
      db.collection("reviews").createIndex({ status: 1, created_at: -1 }),
    ]).catch(() => {});
  }

  return db;
}

export default clientPromise;
