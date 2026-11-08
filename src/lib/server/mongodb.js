import "server-only";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");
}

// One cached client for the whole process. In dev, HMR re-evaluates modules,
// so the client is parked on globalThis to avoid leaking connections.
const globalForMongo = globalThis;

// Transactions need a replica set (Atlas is one). On a standalone mongod set
// MONGODB_TRANSACTIONS=false: writes then run without transactions (and
// without retryable writes, which standalone servers reject), and balances are
// repaired by recomputing them if a multi-step write fails midway.
export const TRANSACTIONS_ENABLED =
  process.env.MONGODB_TRANSACTIONS !== "false";

const client = (globalForMongo.__mongoClient ??= new MongoClient(uri, {
  retryWrites: TRANSACTIONS_ENABLED,
}));

export { client };

export function getDb() {
  // Uses the database name from the connection string.
  return client.db();
}

export const newId = () => new ObjectId().toHexString();

/**
 * Runs `fn(session)` inside a MongoDB transaction (requires a replica set).
 * The callback may be retried by the driver on transient errors, so it must
 * only perform reads/writes through `session`.
 */
export async function withTransaction(fn, { onFallbackError } = {}) {
  if (!TRANSACTIONS_ENABLED) {
    try {
      return await fn(undefined);
    } catch (err) {
      await onFallbackError?.().catch(() => {});
      throw err;
    }
  }
  const session = client.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}

export const col = (name) => getDb().collection(name);
