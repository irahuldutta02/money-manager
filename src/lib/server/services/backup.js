import "server-only";
import { col, withTransaction } from "../mongodb";
import { ApiError } from "../api";
import { recomputeBalances } from "./accounts";
import {
  ACCOUNT_TYPES,
  CATEGORY_TYPES,
  COLORS,
  MAX_AMOUNT,
  TX_TYPES,
  date,
  id,
  int,
  oneOf,
  receipts,
  str,
} from "../validate";

export const BACKUP_VERSION = 1;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const iso = (d) => (d instanceof Date ? d.toISOString() : null);
const strip = ({ _id, userId: _u, ...rest }) => ({ id: _id, ...rest });
const dated = (doc, ...keys) => {
  const out = strip(doc);
  for (const k of keys) out[k] = iso(doc[k]);
  return out;
};

/** Everything needed to rebuild the user's data, as plain JSON. */
export async function buildBackup(userId) {
  const [settings, accounts, categories, transactions, budgets] =
    await Promise.all([
      col("userSettings").findOne({ _id: userId }),
      col("accounts").find({ userId }).toArray(),
      col("categories").find({ userId }).toArray(),
      col("transactions").find({ userId, deletedAt: null }).toArray(),
      col("budgets").find({ userId, deletedAt: null }).toArray(),
    ]);
  const D = ["deletedAt", "createdAt", "updatedAt"];
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    currency: settings?.currency ?? null,
    accounts: accounts.map((d) => dated(d, ...D)),
    categories: categories.map((d) => dated(d, ...D, "lastUsedAt")),
    transactions: transactions.map((d) => dated(d, ...D, "date")),
    budgets: budgets.map((d) => dated(d, ...D)),
  };
}

// ---------------------------------------------------------------- validation

const list = (v, name) => {
  if (!Array.isArray(v)) throw new ApiError(400, `Backup is missing "${name}"`);
  return v;
};
const optDate = (v, f) => (v == null ? null : date(v, f));

function each(arr, name, fn) {
  return arr.map((raw, i) => {
    if (raw === null || typeof raw !== "object") {
      throw new ApiError(400, `${name}[${i}] is not an object`);
    }
    try {
      return fn(raw);
    } catch (e) {
      if (e instanceof ApiError) {
        throw new ApiError(400, `${name}[${i}]: ${e.message}`);
      }
      throw e;
    }
  });
}

/** Validates the whole file and returns clean docs; throws on the first bad record. */
export function validateBackup(data, userId) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiError(400, "Not a Money Manager backup.");
  }
  if (data.version !== BACKUP_VERSION) {
    throw new ApiError(400, `Unsupported backup version: ${data.version}`);
  }
  const stamps = (r) => ({
    deletedAt: optDate(r.deletedAt, "deletedAt"),
    createdAt: optDate(r.createdAt, "createdAt") ?? new Date(),
    updatedAt: optDate(r.updatedAt, "updatedAt") ?? new Date(),
  });

  const accounts = each(list(data.accounts, "accounts"), "accounts", (r) => ({
    _id: id(r.id ?? r._id, "id"),
    userId,
    name: str(r.name, "name", { max: 40 }),
    type: oneOf(r.type, "type", ACCOUNT_TYPES),
    color: oneOf(r.color ?? "gray", "color", COLORS),
    openingBalance: int(r.openingBalance ?? 0, "openingBalance"),
    balance: int(r.openingBalance ?? 0, "openingBalance"), // recomputed after
    sortOrder: int(r.sortOrder ?? 0, "sortOrder", { min: 0, max: 1e6 }),
    ...stamps(r),
  }));
  const accountIds = new Set(accounts.map((a) => a._id));

  const categories = each(
    list(data.categories, "categories"),
    "categories",
    (r) => ({
      _id: id(r.id ?? r._id, "id"),
      userId,
      name: str(r.name, "name", { max: 40 }),
      type: oneOf(r.type, "type", CATEGORY_TYPES),
      icon: str(r.icon ?? "tag", "icon", { max: 40 }),
      color: oneOf(r.color ?? "gray", "color", COLORS),
      parentId: r.parentId == null ? null : id(r.parentId, "parentId"),
      sortOrder: int(r.sortOrder ?? 0, "sortOrder", { min: 0, max: 1e6 }),
      useCount: int(r.useCount ?? 0, "useCount", { min: 0, max: 1e9 }),
      lastUsedAt: optDate(r.lastUsedAt, "lastUsedAt"),
      ...stamps(r),
    }),
  );
  const categoryIds = new Set(categories.map((c) => c._id));

  const transactions = each(
    list(data.transactions, "transactions"),
    "transactions",
    (r) => {
      const type = oneOf(r.type, "type", TX_TYPES);
      const tx = {
        _id: id(r.id ?? r._id, "id"),
        userId,
        type,
        amount: int(r.amount, "amount", { min: 1, max: MAX_AMOUNT }),
        accountId: id(r.accountId, "accountId"),
        toAccountId: null,
        categoryId: null,
        subcategoryId: null,
        date: date(r.date, "date"),
        note: str(r.note, "note", { max: 500, optional: true }),
        receipts: receipts(r.receipts),
        recurringRuleId: null,
        ...stamps(r),
      };
      tx.deletedAt = null; // backups hold live transactions only
      if (type === "transfer") {
        tx.toAccountId = id(r.toAccountId, "toAccountId");
        if (tx.toAccountId === tx.accountId) {
          throw new ApiError(400, "transfer accounts must differ");
        }
      } else {
        tx.categoryId = id(r.categoryId, "categoryId");
      }
      return tx;
    },
  );

  const budgets = each(list(data.budgets, "budgets"), "budgets", (r) => {
    if (typeof r.month !== "string" || !MONTH_RE.test(r.month)) {
      throw new ApiError(400, "month is invalid");
    }
    const categoryId = r.categoryId == null ? null : id(r.categoryId, "cat");
    return {
      _id: `${userId}:${r.month}:${categoryId ?? "overall"}`,
      userId,
      month: r.month,
      categoryId,
      amount: int(r.amount, "amount", { min: 1, max: MAX_AMOUNT }),
      ...stamps(r),
    };
  });

  return {
    accounts,
    categories,
    transactions,
    budgets,
    accountIds,
    categoryIds,
  };
}

// ------------------------------------------------------------------- restore

const COLLECTIONS = ["accounts", "categories", "transactions", "budgets"];

/**
 * Restores a validated backup. "merge" skips ids that already exist;
 * "replace" wipes this user's data in the four collections first.
 */
export async function restoreBackup(userId, data, mode) {
  oneOf(mode, "mode", ["merge", "replace"]);
  const v = validateBackup(data, userId);

  const settings = await col("userSettings").findOne({ _id: userId });
  if (
    data.currency &&
    settings?.currency &&
    data.currency !== settings.currency
  ) {
    throw new ApiError(
      400,
      `This backup is in ${data.currency} but your account uses ${settings.currency}.`,
    );
  }

  const existing = {};
  for (const name of COLLECTIONS) {
    existing[name] =
      mode === "replace"
        ? new Set()
        : new Set(
            (
              await col(name)
                .find({ userId }, { projection: { _id: 1 } })
                .toArray()
            ).map((d) => d._id),
          );
  }

  // Every reference must resolve against what will exist after the restore.
  const hasAccount = (x) => v.accountIds.has(x) || existing.accounts.has(x);
  for (const t of v.transactions) {
    if (
      !hasAccount(t.accountId) ||
      (t.toAccountId && !hasAccount(t.toAccountId))
    ) {
      throw new ApiError(
        400,
        `Transaction ${t._id} refers to a missing account`,
      );
    }
    if (
      t.categoryId &&
      !v.categoryIds.has(t.categoryId) &&
      !existing.categories.has(t.categoryId)
    ) {
      throw new ApiError(
        400,
        `Transaction ${t._id} refers to a missing category`,
      );
    }
  }

  const counts = { accounts: 0, categories: 0, transactions: 0, budgets: 0 };
  await withTransaction(
    async (session) => {
      if (mode === "replace") {
        for (const name of COLLECTIONS) {
          await col(name).deleteMany({ userId }, { session });
        }
      }
      for (const name of COLLECTIONS) {
        const fresh = v[name].filter((d) => !existing[name].has(d._id));
        counts[name] = fresh.length;
        if (fresh.length) {
          await col(name).insertMany(fresh, { session, ordered: false });
        }
      }
    },
    { onFallbackError: () => recomputeBalances(userId) },
  ).catch((e) => {
    if (e?.code === 11000) {
      throw new ApiError(409, "Backup contains ids that belong to other data.");
    }
    throw e;
  });

  await recomputeBalances(userId);
  return { ok: true, mode, restored: counts };
}
