import "server-only";
import { col, newId } from "../mongodb";
import { ApiError } from "../api";
import { date, int, oneOf, publicDoc, str } from "../validate";

// Lending is a personal IOU ledger. It deliberately lives in its own
// collection: entries never touch accounts, balances, budgets or stats.
export const LENDING_KINDS = ["lent", "repaid"];

const personKey = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

function parseFields(body, { partial }) {
  const out = {};
  if (!partial || body.person !== undefined) {
    out.person = str(body.person, "person", { max: 40 }).replace(/\s+/g, " ");
    out.personKey = personKey(out.person);
  }
  if (!partial || body.kind !== undefined) {
    out.kind = oneOf(body.kind, "kind", LENDING_KINDS);
  }
  if (!partial || body.amount !== undefined) {
    out.amount = int(body.amount, "amount", { min: 1 });
  }
  if (!partial || body.date !== undefined) {
    out.date = date(body.date, "date");
  }
  if (!partial || body.note !== undefined) {
    out.note = str(body.note, "note", { max: 200, optional: true });
  }
  return out;
}

const serialize = (doc) => {
  const { personKey: _k, ...rest } = publicDoc(doc);
  return rest;
};

export async function listLending(userId) {
  const docs = await col("lending")
    .find({ userId, deletedAt: null })
    .sort({ date: -1, createdAt: -1 })
    .limit(5000)
    .toArray();
  return { entries: docs.map(serialize) };
}

export async function createLending(userId, body) {
  const f = parseFields(body, { partial: false });
  const now = new Date();
  const doc = {
    _id: newId(),
    userId,
    ...f,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await col("lending").insertOne(doc);
  return serialize(doc);
}

export async function updateLending(userId, entryId, body) {
  const lending = col("lending");

  // Undo of a delete.
  if (body.deleted === false) {
    const r = await lending.findOneAndUpdate(
      { _id: entryId, userId, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!r) throw new ApiError(404, "Entry not found", "not_found");
    return serialize(r);
  }

  const f = parseFields(body, { partial: true });
  const r = await lending.findOneAndUpdate(
    { _id: entryId, userId, deletedAt: null },
    { $set: { ...f, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!r) throw new ApiError(404, "Entry not found", "not_found");
  return serialize(r);
}

export async function deleteLending(userId, entryId) {
  const r = await col("lending").updateOne(
    { _id: entryId, userId, deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
  );
  if (!r.matchedCount) throw new ApiError(404, "Entry not found", "not_found");
  return { ok: true };
}
