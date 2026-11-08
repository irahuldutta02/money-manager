// Creates the indexes the app's queries rely on. Safe to re-run (idempotent).
//
//   npm run db:indexes
//
// YOU run this; the app and tooling never do. Reads MONGODB_URI from .env.local.
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (use: npm run db:indexes).");
  process.exit(1);
}

const INDEXES = {
  // --- Better Auth collections (names are Better Auth's defaults) ---
  user: [{ key: { email: 1 }, unique: true }],
  session: [{ key: { token: 1 }, unique: true }, { key: { userId: 1 } }],
  account: [{ key: { userId: 1 } }],
  passkey: [{ key: { userId: 1 } }, { key: { credentialID: 1 } }],

  // --- App collections: every query is scoped by userId first ---
  accounts: [{ key: { userId: 1, deletedAt: 1, sortOrder: 1 } }],
  categories: [
    { key: { userId: 1, deletedAt: 1, type: 1 } },
    { key: { userId: 1, parentId: 1 } },
  ],
  transactions: [
    // Home list + summaries: range scan by date for a user's live rows.
    { key: { userId: 1, deletedAt: 1, date: -1 } },
    // Per-account views and account-in-use checks.
    { key: { userId: 1, accountId: 1, date: -1 } },
    { key: { userId: 1, toAccountId: 1, date: -1 } },
    // Phase 2: category stats / filters, text search on notes.
    { key: { userId: 1, categoryId: 1, date: -1 } },
    { key: { note: "text" }, name: "note_text" },
  ],
  holdings: [{ key: { userId: 1, deletedAt: 1, sortOrder: 1 } }],
  lending: [{ key: { userId: 1, deletedAt: 1, date: -1 } }],
  budgets: [{ key: { userId: 1, month: 1, deletedAt: 1 } }],
  recurringRules: [{ key: { userId: 1, active: 1, nextRunAt: 1 } }],
  bookmarks: [{ key: { userId: 1, deletedAt: 1 } }],
};

const client = new MongoClient(uri);
try {
  const db = client.db();
  for (const [name, specs] of Object.entries(INDEXES)) {
    const created = await db
      .collection(name)
      .createIndexes(specs.map(({ key, ...opts }) => ({ key, ...opts })));
    console.log(`${name}: ${created.join(", ")}`);
  }
} finally {
  await client.close();
}
