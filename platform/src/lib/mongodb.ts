import { MongoClient, Db } from 'mongodb';

// MongoDB Connection String - Replace with your actual connection string
// Use environment variable in production!
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-home-study';
const MONGODB_DB = process.env.MONGODB_DB || 'smart-home-study';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

if (!MONGODB_DB) {
  throw new Error('Please define the MONGODB_DB environment variable');
}

export async function connectToDatabase() {
  // If we already have a connection, use it
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Connect to the MongoDB server
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  const db = client.db(MONGODB_DB);

  // Cache the connection
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}