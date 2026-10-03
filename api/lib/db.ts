import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "***REMOVED_MONGODB_URI***";
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

let indexesCreated = false;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);

  // Ensure indexes lazily only once in lifecycle
  if (!indexesCreated) {
    indexesCreated = true;
    Promise.allSettled([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("users").createIndex({ username: 1 }),
      db.collection("users").createIndex({ api_key: 1 }),
      db.collection("processed_transactions").createIndex({ utr: 1 }, { unique: true }),
      db.collection("orders").createIndex({ user_id: 1, created_at: -1 }),
      db.collection("transactions").createIndex({ user_id: 1, created_at: -1 }),
    ]).catch(() => {});
  }

  return db;
}

export default clientPromise;
