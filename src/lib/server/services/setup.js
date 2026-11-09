import "server-only";
import { col, newId, withTransaction } from "../mongodb";
import { ApiError } from "../api";
import { publicDoc } from "../validate";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "./defaults";

function isDuplicateKey(err) {
  return err?.code === 11000;
}

// Every account is in rupees: the app is for Indian users.
const CURRENCY = "INR";

/** Everything the client needs to boot, in one read. */
export async function getMeta(userId) {
  const [settings, accounts, categories] = await Promise.all([
    col("userSettings").findOne({ _id: userId }),
    col("accounts")
      .find({ userId, deletedAt: null })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray(),
    col("categories")
      .find({ userId })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray(),
  ]);
  return {
    seeded: Boolean(settings?.seededAt),
    settings: settings
      ? {
          currency: settings.currency,
          lastAccountId: settings.lastAccountId ?? null,
        }
      : null,
    accounts: accounts.map(publicDoc),
    categories: categories.map(publicDoc),
  };
}

/**
 * Idempotent first-run setup: default account + categories. The settings doc
 * (keyed by userId) acts as the lock; a concurrent second call either sees
 * `seededAt` or hits a duplicate key and is treated as already done.
 */
export async function ensureSetup(
  userId,
  _currency, // ignored: always INR
  { starterCategories = true, cashAccount = true } = {},
) {
  const cur = CURRENCY;
  try {
    await withTransaction(async (session) => {
      const settings = col("userSettings");
      const existing = await settings.findOne({ _id: userId }, { session });
      if (existing?.seededAt) return;
      if (existing) throw new ApiError(409, "Setup in progress");

      // Unseeded means no real data yet; clear any leftovers of a half-finished
      // earlier attempt (only possible without transactions).
      await col("accounts").deleteMany({ userId }, { session });
      await col("categories").deleteMany({ userId }, { session });

      const now = new Date();
      const accountId = cashAccount ? newId() : null;
      if (cashAccount) {
        await col("accounts").insertOne(
          {
            _id: accountId,
            userId,
            name: "Cash",
            type: "cash",
            openingBalance: 0,
            balance: 0,
            color: "green",
            sortOrder: 0,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      }

      const docs = [];
      let order = 0;
      const addGroup = (list, type) => {
        for (const c of list) {
          const parentId = newId();
          docs.push({
            _id: parentId,
            userId,
            name: c.name,
            type,
            icon: c.icon,
            color: c.color,
            parentId: null,
            sortOrder: order++,
            useCount: 0,
            lastUsedAt: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          });
          for (const sub of c.subs) {
            docs.push({
              _id: newId(),
              userId,
              name: sub,
              type,
              icon: c.icon,
              color: c.color,
              parentId,
              sortOrder: order++,
              useCount: 0,
              lastUsedAt: null,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      };
      if (starterCategories) {
        addGroup(DEFAULT_EXPENSE_CATEGORIES, "expense");
        addGroup(DEFAULT_INCOME_CATEGORIES, "income");
      }
      if (docs.length) await col("categories").insertMany(docs, { session });

      await settings.insertOne(
        {
          _id: userId,
          userId,
          currency: cur,
          lastAccountId: accountId,
          seededAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  return getMeta(userId);
}
