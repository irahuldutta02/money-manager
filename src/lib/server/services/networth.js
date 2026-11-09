import "server-only";
import { col, newId } from "../mongodb";
import { ApiError } from "../api";
import {
  MAX_AMOUNT,
  date,
  iconImage,
  int,
  isId,
  oneOf,
  publicDoc,
  str,
} from "../validate";
import {
  MAX_DETAIL_ROWS,
  MAX_EMIS,
  emiError,
  NW_TYPE_IDS,
  detailRows,
  normLabel,
  rowKind,
} from "@/lib/networth";

// Net worth instruments (accounts, investments, loans) with a balance history.
// Entirely separate from transactions: balances here are typed in, not derived.
const MAX_HISTORY = 100;

/** Free-form {label, value} rows: trimmed, capped, blank rows dropped. */
export function cleanDetails(type, raw) {
  if (raw == null) return [];
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return detailRows(type, raw); // legacy keyed object (older backups)
  }
  if (!Array.isArray(raw)) throw new ApiError(400, "details is invalid");
  if (raw.length > MAX_DETAIL_ROWS) {
    throw new ApiError(400, `At most ${MAX_DETAIL_ROWS} details`);
  }
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== "object")
      throw new ApiError(400, "details is invalid");
    const label = normLabel(r.label);
    const value = String(r.value ?? "").trim();
    if (!label && !value) continue;
    if (!label) throw new ApiError(400, "Each detail needs a label");
    if (label.length > 60)
      throw new ApiError(400, "Labels must be at most 60 characters");
    if (value.length > 200)
      throw new ApiError(400, "Values must be at most 200 characters");
    out.push({
      label,
      value,
      ...rowKind(type, { ...r, label }),
    });
  }
  return out;
}

/** Card EMIs: capped, each with a name, amounts, tenure and first date. */
export function cleanEmis(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new ApiError(400, "emis is invalid");
  if (raw.length > MAX_EMIS) {
    throw new ApiError(400, `At most ${MAX_EMIS} EMIs`);
  }
  const names = new Set();
  return raw.map((e) => {
    if (!e || typeof e !== "object") throw new ApiError(400, "emis is invalid");
    const emi = {
      id: str(e.id ?? newId(), "emi id", { max: 40 }),
      name: typeof e.name === "string" ? e.name.trim() : "",
      principal: e.principal,
      monthly: e.monthly,
      tenure: e.tenure,
      start: date(e.start, "first EMI date"),
      ...(e.paidCount != null && { paidCount: e.paidCount }),
      ...(e.custom != null && { custom: e.custom }),
      ...(e.noInterest === true && { noInterest: true }),
    };
    if (emi.principal > MAX_AMOUNT || emi.monthly > MAX_AMOUNT)
      throw new ApiError(400, "An EMI amount is too large");
    const err = emiError(emi);
    if (err) throw new ApiError(400, err);
    const key = emi.name.toLowerCase();
    if (names.has(key))
      throw new ApiError(400, `Another EMI is already called "${emi.name}"`);
    names.add(key);
    if (emi.custom)
      emi.custom = emi.custom.map((c) => ({
        principal: c.principal,
        interest: c.interest,
      }));
    return emi;
  });
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
  if (body.emis !== undefined) {
    out.emis = cleanEmis(body.emis);
  }
  if (!partial || body.platformIcon !== undefined) {
    out.platformIcon = iconImage(body.platformIcon);
  }
  if (!partial || body.issuerIcon !== undefined) {
    out.issuerIcon = iconImage(body.issuerIcon);
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
  // An FD that backs a credit card stays until the card is deleted (or the
  // link is removed).
  const cards = await col("holdings")
    .find({ userId, deletedAt: null, type: "credit_card" })
    .toArray();
  const backed = cards.filter((c) =>
    detailRows(c.type, c.details)
      .find((r) => r.kind === "fdlink")
      ?.value.split(",")
      .includes(holdingId),
  );
  if (backed.length) {
    throw new ApiError(
      409,
      `This FD backs ${backed.map((c) => c.name).join(", ")}. Delete the card or remove the link first.`,
    );
  }
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

/** Save a new display order: `ids` (every instrument, top to bottom). */
export async function reorderHoldings(userId, body) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length > 2000 || !ids.every(isId)) {
    throw new ApiError(400, "ids is invalid");
  }
  if (ids.length === 0) return { ok: true };
  await col("holdings").bulkWrite(
    ids.map((id, i) => ({
      updateOne: {
        filter: { _id: id, userId },
        update: { $set: { sortOrder: i } },
      },
    })),
  );
  return { ok: true };
}
