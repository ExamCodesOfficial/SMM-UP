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
    serverSelectionTimeoutMS: 5000,
  });
  globalWithMongo._mongoClientPromise = client.connect();
}
clientPromise = globalWithMongo._mongoClientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);
  
  // Ensure indexes lazily once
  try {
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ username: 1 });
    await db.collection("processed_transactions").createIndex({ utr: 1 }, { unique: true });
    await db.collection("orders").createIndex({ user_id: 1, created_at: -1 });
    await db.collection("transactions").createIndex({ user_id: 1, created_at: -1 });
  } catch (e) {
    // Indexes already exist or building
  }

  return db;
}

export default clientPromise;
