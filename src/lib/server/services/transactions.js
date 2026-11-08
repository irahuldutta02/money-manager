import "server-only";
import { col, newId, withTransaction } from "../mongodb";
import { ApiError } from "../api";
import { recomputeBalances } from "./accounts";
import {
  MAX_AMOUNT,
  TX_TYPES,
  date,
  id,
  int,
  oneOf,
  publicDoc,
  receipts,
  str,
} from "../validate";

// Transactional when MongoDB supports it; otherwise sequential, with balances
// rebuilt from transactions if a write fails midway.
const atomically = (userId, fn) =>
  withTransaction(fn, { onFallbackError: () => recomputeBalances(userId) });

/** Balance effect of a transaction: Map(accountId -> signed delta). */
export function effectOf(tx) {
  const m = new Map();
  const add = (accountId, d) => m.set(accountId, (m.get(accountId) ?? 0) + d);
  if (tx.type === "expense") add(tx.accountId, -tx.amount);
  else if (tx.type === "income") add(tx.accountId, tx.amount);
  else {
    add(tx.accountId, -tx.amount);
    add(tx.toAccountId, tx.amount);
  }
  return m;
}

function mergeEffects(...parts) {
  const out = new Map();
  for (const { effect, sign } of parts) {
    for (const [accountId, d] of effect) {
      out.set(accountId, (out.get(accountId) ?? 0) + d * sign);
    }
  }
  return out;
}

async function applyDeltas(userId, deltas, session) {
  const now = new Date();
  const ops = [...deltas]
    .filter(([, d]) => d !== 0)
    .map(([accountId, d]) => ({
      updateOne: {
        filter: { _id: accountId, userId },
        update: { $inc: { balance: d }, $set: { updatedAt: now } },
      },
    }));
  if (!ops.length) return;
  const r = await col("accounts").bulkWrite(ops, { session, ordered: true });
  if (r.matchedCount !== ops.length) {
    // Throwing aborts the surrounding transaction: no partial balance changes.
    throw new ApiError(409, "Account not found", "account_missing");
  }
}

async function assertLiveAccounts(userId, ids, session) {
  const unique = [...new Set(ids)];
  const n = await col("accounts").countDocuments(
    { _id: { $in: unique }, userId, deletedAt: null },
    { session },
  );
  if (n !== unique.length) {
    throw new ApiError(
      400,
      "Account not found or was deleted",
      "account_missing",
    );
  }
}

// `receipts` is only touched when the client sends it, so list-sized edits
// (which never load the photos) can't wipe them.
async function parseInput(userId, body) {
  const type = oneOf(body.type, "type", TX_TYPES);
  const amount = int(body.amount, "amount", { min: 1, max: MAX_AMOUNT });
  const accountId = id(body.accountId, "accountId");
  const base = {
    type,
    amount,
    accountId,
    toAccountId: null,
    categoryId: null,
    subcategoryId: null,
    date: date(body.date, "date"),
    note: str(body.note, "note", { max: 500, optional: true }),
  };
  if (body.receipts !== undefined) base.receipts = receipts(body.receipts);

  if (type === "transfer") {
    base.toAccountId = id(body.toAccountId, "toAccountId");
    if (base.toAccountId === accountId) {
      throw new ApiError(400, "Choose two different accounts");
    }
    return base;
  }

  // Everything but the note is mandatory: a category is required.
  // (Subcategories are no longer offered; subcategoryId stays null.)
  base.categoryId = id(body.categoryId, "category");
  const cat = await col("categories").findOne({
    _id: base.categoryId,
    userId,
    deletedAt: null,
    parentId: null,
    type,
  });
  if (!cat) throw new ApiError(400, "Category not found");
  return base;
}

function txAccountIds(tx) {
  return tx.type === "transfer"
    ? [tx.accountId, tx.toAccountId]
    : [tx.accountId];
}

export async function createTransaction(userId, body) {
  const f = await parseInput(userId, body);
  const now = new Date();
  const doc = {
    _id: newId(),
    userId,
    receipts: [],
    ...f,
    recurringRuleId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await atomically(userId, async (session) => {
    await assertLiveAccounts(userId, txAccountIds(doc), session);
    await col("transactions").insertOne(doc, { session });
    await applyDeltas(userId, effectOf(doc), session);

    // Smart defaults: remember last account + bump category recency.
    await col("userSettings").updateOne(
      { _id: userId },
      { $set: { lastAccountId: doc.accountId, updatedAt: now } },
      { session },
    );
    const catIds = [doc.categoryId].filter(Boolean);
    if (catIds.length) {
      await col("categories").updateMany(
        { _id: { $in: catIds }, userId },
        { $set: { lastUsedAt: now }, $inc: { useCount: 1 } },
        { session },
      );
    }
  });
  return publicDoc(doc);
}

export async function updateTransaction(userId, txId, body) {
  const f = await parseInput(userId, body);
  const now = new Date();
  return atomically(userId, async (session) => {
    const old = await col("transactions").findOne(
      { _id: txId, userId, deletedAt: null },
      { session },
    );
    if (!old) throw new ApiError(404, "Transaction not found", "not_found");

    await assertLiveAccounts(userId, txAccountIds(f), session);
    // Net effect = undo old + apply new, in a single atomic step.
    const net = mergeEffects(
      { effect: effectOf(old), sign: -1 },
      { effect: effectOf(f), sign: 1 },
    );
    await applyDeltas(userId, net, session);
    const updated = await col("transactions").findOneAndUpdate(
      { _id: txId, userId, deletedAt: null },
      { $set: { ...f, updatedAt: now } },
      { returnDocument: "after", session },
    );
    return publicDoc(updated);
  });
}

export async function deleteTransaction(userId, txId) {
  const now = new Date();
  await atomically(userId, async (session) => {
    // The deletedAt:null filter makes a repeated delete a no-op (no double reverse).
    const old = await col("transactions").findOneAndUpdate(
      { _id: txId, userId, deletedAt: null },
      { $set: { deletedAt: now, updatedAt: now } },
      { returnDocument: "before", session },
    );
    if (!old) throw new ApiError(404, "Transaction not found", "not_found");
    await applyDeltas(
      userId,
      mergeEffects({ effect: effectOf(old), sign: -1 }),
      session,
    );
  });
  return { ok: true };
}

export async function restoreTransaction(userId, txId) {
  const now = new Date();
  return atomically(userId, async (session) => {
    const doc = await col("transactions").findOneAndUpdate(
      { _id: txId, userId, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, updatedAt: now } },
      { returnDocument: "after", session },
    );
    if (!doc) throw new ApiError(404, "Transaction not found", "not_found");
    await assertLiveAccounts(userId, txAccountIds(doc), session);
    await applyDeltas(userId, effectOf(doc), session);
    return publicDoc(doc);
  });
}

/** Full transaction including receipt photos (lists leave them out). */
export async function getTransaction(userId, txId) {
  const doc = await col("transactions").findOne({
    _id: txId,
    userId,
    deletedAt: null,
  });
  if (!doc) throw new ApiError(404, "Transaction not found", "not_found");
  return publicDoc(doc);
}
