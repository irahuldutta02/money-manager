import "server-only";
import { col, newId } from "../mongodb";
import { ApiError } from "../api";
import {
  MAX_AMOUNT,
  date,
  iconImage,
  int,
  oneOf,
  publicDoc,
  str,
} from "../validate";
import { NW_TYPE_IDS, nwFields } from "@/lib/networth";

// Net worth instruments (accounts, investments, loans) with a balance history.
// Entirely separate from transactions: balances here are typed in, not derived.
const MAX_HISTORY = 100;

/** Keeps only the detail fields this type defines; trims, caps, drops empties. */
export function cleanDetails(type, raw) {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError(400, "details is invalid");
  }
  const out = {};
  for (const fld of nwFields(type)) {
    const v = raw[fld.key];
    if (v == null || v === "") continue;
    if (typeof v !== "string")
      throw new ApiError(400, `${fld.label} is invalid`);
    const t = v.trim();
    if (!t) continue;
    if (t.length > 200) {
      throw new ApiError(400, `${fld.label} must be at most 200 characters`);
    }
    if (fld.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      throw new ApiError(400, `${fld.label} is invalid`);
    }
    out[fld.key] = t;
  }
  return out;
}

const bal = (v) => int(v, "balance", { min: -MAX_AMOUNT, max: MAX_AMOUNT });

function parseFields(body, { partial, currentType }) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = str(body.name, "name", { max: 60 });
  }
  if (!partial || body.type !== undefined) {
    out.type = oneOf(body.type, "type", NW_TYPE_IDS);
  }
  if (!partial || body.included !== undefined) {
    const v = body.included ?? true;
    if (typeof v !== "boolean") throw new ApiError(400, "included is invalid");
    out.included = v;
  }
  if (!partial || body.icon !== undefined) {
    out.icon = iconImage(body.icon);
  }
  if (!partial || body.details !== undefined) {
    const type = out.type ?? currentType;
    if (type) out.details = cleanDetails(type, body.details);
  }
  if (!partial || body.note !== undefined) {
    out.note = str(body.note, "note", { max: 200, optional: true });
  }
  return out;
}

const serialize = (doc) => publicDoc(doc);

export async function getNetWorth(userId) {
  const [docs, ledger, settings] = await Promise.all([
    col("holdings")
      .find({ userId, deletedAt: null })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray(),
    col("lending")
      .aggregate([
        { $match: { userId, deletedAt: null } },
        {
          $group: {
            _id: "$personKey",
            lent: {
              $sum: { $cond: [{ $eq: ["$kind", "lent"] }, "$amount", 0] },
            },
            repaid: {
              $sum: { $cond: [{ $eq: ["$kind", "repaid"] }, "$amount", 0] },
            },
          },
        },
      ])
      .toArray(),
    col("userSettings").findOne({ _id: userId }),
  ]);
  let owed = 0;
  let owe = 0;
  for (const p of ledger) {
    const net = p.lent - p.repaid;
    if (net > 0) owed += net;
    else owe -= net;
  }
  return {
    holdings: docs.map(serialize),
    lending: { owed, owe },
    // Whether the lending ledger counts towards net worth (default: yes).
    lendingIncluded: settings?.lendingInNetWorth !== false,
  };
}

export async function createHolding(userId, body) {
  const f = parseFields(body, { partial: false });
  const balance = bal(body.balance ?? 0);
  const last = await col("holdings")
    .find({ userId })
    .sort({ sortOrder: -1 })
    .limit(1)
    .next();
  const now = new Date();
  const doc = {
    _id: newId(),
    userId,
    ...f,
    balance,
    history: [{ at: now, balance }],
    sortOrder: (last?.sortOrder ?? -1) + 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await col("holdings").insertOne(doc);
  return serialize(doc);
}

export async function updateHolding(userId, holdingId, body) {
  const holdings = col("holdings");

  // Undo of a delete.
  if (body.deleted === false) {
    const r = await holdings.findOneAndUpdate(
      { _id: holdingId, userId, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!r) throw new ApiError(404, "Not found", "not_found");
    return serialize(r);
  }

  let currentType;
  if (body.details !== undefined && body.type === undefined) {
    const cur = await holdings.findOne(
      { _id: holdingId, userId, deletedAt: null },
      { projection: { type: 1 } },
    );
    if (!cur) throw new ApiError(404, "Not found", "not_found");
    currentType = cur.type;
  }
  const f = parseFields(body, { partial: true, currentType });
  const now = new Date();
  const update = { $set: { ...f, updatedAt: now } };
  if (body.history !== undefined) {
    // The client edits the whole list of balance entries; the current balance
    // is always the latest entry by date.
    const list = body.history;
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_HISTORY) {
      throw new ApiError(
        400,
        `Keep between 1 and ${MAX_HISTORY} balance entries`,
      );
    }
    const history = list
      .map((e) => ({ at: date(e?.at, "date"), balance: bal(e?.balance) }))
      .sort((x, y) => x.at - y.at);
    update.$set.history = history;
    update.$set.balance = history[history.length - 1].balance;
  }
  const r = await holdings.findOneAndUpdate(
    { _id: holdingId, userId, deletedAt: null },
    update,
    { returnDocument: "after" },
  );
  if (!r) throw new ApiError(404, "Not found", "not_found");
  return serialize(r);
}

export async function deleteHolding(userId, holdingId) {
  const r = await col("holdings").updateOne(
    { _id: holdingId, userId, deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
  );
  if (!r.matchedCount) throw new ApiError(404, "Not found", "not_found");
  return { ok: true };
}

export async function setLendingIncluded(userId, body) {
  if (typeof body.included !== "boolean") {
    throw new ApiError(400, "included is invalid");
  }
  const r = await col("userSettings").updateOne(
    { _id: userId },
    { $set: { lendingInNetWorth: body.included } },
  );
  if (!r.matchedCount) throw new ApiError(404, "Not found", "not_found");
  return { lendingIncluded: body.included };
}
