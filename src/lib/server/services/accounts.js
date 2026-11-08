import "server-only";
import { col, newId, withTransaction } from "../mongodb";
import { ApiError } from "../api";
import { ACCOUNT_TYPES, COLORS, int, oneOf, publicDoc, str } from "../validate";

function parseFields(body, { partial }) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = str(body.name, "name", { max: 40 });
  }
  if (!partial || body.type !== undefined) {
    out.type = oneOf(body.type, "type", ACCOUNT_TYPES);
  }
  if (!partial || body.color !== undefined) {
    out.color = oneOf(body.color ?? "gray", "color", COLORS);
  }
  if (!partial || body.openingBalance !== undefined) {
    out.openingBalance = int(body.openingBalance ?? 0, "openingBalance");
  }
  return out;
}

export async function createAccount(userId, body) {
  const f = parseFields(body, { partial: false });
  const last = await col("accounts")
    .find({ userId })
    .sort({ sortOrder: -1 })
    .limit(1)
    .next();
  const now = new Date();
  const doc = {
    _id: newId(),
    userId,
    ...f,
    balance: f.openingBalance,
    sortOrder: (last?.sortOrder ?? -1) + 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await col("accounts").insertOne(doc);
  return publicDoc(doc);
}

export async function updateAccount(userId, accountId, body) {
  const accounts = col("accounts");

  // Undo of a delete.
  if (body.deleted === false) {
    const r = await accounts.findOneAndUpdate(
      { _id: accountId, userId, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!r) throw new ApiError(404, "Account not found", "not_found");
    return publicDoc(r);
  }

  const f = parseFields(body, { partial: true });
  return withTransaction(async (session) => {
    const current = await accounts.findOne(
      { _id: accountId, userId, deletedAt: null },
      { session },
    );
    if (!current) throw new ApiError(404, "Account not found", "not_found");
    const update = { $set: { ...f, updatedAt: new Date() } };
    if (f.openingBalance !== undefined) {
      // Keep balance = opening + sum(effects) by shifting it with the opening.
      update.$inc = { balance: f.openingBalance - current.openingBalance };
    }
    const r = await accounts.findOneAndUpdate(
      { _id: accountId, userId },
      update,
      { returnDocument: "after", session },
    );
    return publicDoc(r);
  });
}

export async function deleteAccount(userId, accountId) {
  const inUse = await col("transactions").countDocuments(
    {
      userId,
      deletedAt: null,
      $or: [{ accountId }, { toAccountId: accountId }],
    },
    { limit: 1 },
  );
  if (inUse) {
    throw new ApiError(
      409,
      "This account still has transactions. Delete or move them first.",
      "account_in_use",
    );
  }
  const r = await col("accounts").updateOne(
    { _id: accountId, userId, deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
  );
  if (!r.matchedCount)
    throw new ApiError(404, "Account not found", "not_found");
  return { ok: true };
}

/**
 * Repair tool: balance = openingBalance + sum of effects of active
 * transactions. Safe to run any time; used if a balance is ever suspected off.
 */
export async function recomputeBalances(userId) {
  const net = await col("transactions")
    .aggregate([
      { $match: { userId, deletedAt: null } },
      {
        $facet: {
          out: [
            { $match: { type: { $in: ["expense", "transfer"] } } },
            { $group: { _id: "$accountId", sum: { $sum: "$amount" } } },
          ],
          inc: [
            { $match: { type: "income" } },
            { $group: { _id: "$accountId", sum: { $sum: "$amount" } } },
          ],
          xin: [
            { $match: { type: "transfer" } },
            { $group: { _id: "$toAccountId", sum: { $sum: "$amount" } } },
          ],
        },
      },
    ])
    .next();
  const delta = new Map();
  const add = (list, sign) =>
    (list ?? []).forEach((r) =>
      delta.set(r._id, (delta.get(r._id) ?? 0) + sign * r.sum),
    );
  add(net?.out, -1);
  add(net?.inc, 1);
  add(net?.xin, 1);

  const accounts = await col("accounts").find({ userId }).toArray();
  if (!accounts.length) return { updated: 0 };
  const ops = accounts.map((a) => ({
    updateOne: {
      filter: { _id: a._id, userId },
      update: {
        $set: {
          balance: a.openingBalance + (delta.get(a._id) ?? 0),
          updatedAt: new Date(),
        },
      },
    },
  }));
  await col("accounts").bulkWrite(ops);
  return { updated: ops.length };
}
