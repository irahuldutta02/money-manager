import "server-only";
import { col } from "../mongodb";
import { ApiError } from "../api";
import {
  MAX_AMOUNT,
  TX_TYPES,
  date,
  id,
  int,
  oneOf,
  publicDoc,
} from "../validate";

const STEP = 100;
const MAX_LIMIT = 500;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function optionalInt(params, key) {
  const raw = params.get(key);
  if (raw == null || raw === "") return null;
  return int(Number(raw), key, { min: 0, max: MAX_AMOUNT });
}

/** Builds the Mongo filter shared by the list and the summary. */
export async function buildFilter(userId, params) {
  const and = [];
  const filter = { userId, deletedAt: null };

  const q = (params.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    // Match the note, or any category/subcategory whose name matches.
    const cats = await col("categories")
      .find({ userId, name: rx }, { projection: { _id: 1 } })
      .toArray();
    const ids = cats.map((c) => c._id);
    and.push({
      $or: [
        { note: rx },
        ...(ids.length
          ? [{ categoryId: { $in: ids } }, { subcategoryId: { $in: ids } }]
          : []),
      ],
    });
  }

  const type = params.get("type");
  if (type) filter.type = oneOf(type, "type", TX_TYPES);

  const categoryId = params.get("categoryId");
  if (categoryId) filter.categoryId = id(categoryId, "categoryId");

  const accountId = params.get("accountId");
  if (accountId) {
    id(accountId, "accountId");
    and.push({ $or: [{ accountId }, { toAccountId: accountId }] });
  }

  const min = optionalInt(params, "min");
  const max = optionalInt(params, "max");
  if (min != null || max != null) {
    filter.amount = {
      ...(min != null ? { $gte: min } : {}),
      ...(max != null ? { $lte: max } : {}),
    };
  }

  const from = params.get("from") ? date(params.get("from"), "from") : null;
  const to = params.get("to") ? date(params.get("to"), "to") : null;
  if (from || to) {
    filter.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lt: to } : {}),
    };
  }
  if (and.length) filter.$and = and;

  if (min != null && max != null && min > max) {
    throw new ApiError(400, "Minimum amount is higher than maximum");
  }
  return filter;
}

export async function searchTransactions(userId, params) {
  const filter = await buildFilter(userId, params);
  const limit = Math.min(
    Math.max(Number(params.get("limit")) || STEP, 1),
    MAX_LIMIT,
  );
  // Receipt photos are heavy base64: lists only get a count.
  const rows = await col("transactions")
    .aggregate([
      { $match: filter },
      { $sort: { date: -1, _id: -1 } },
      { $limit: limit + 1 },
      {
        $addFields: {
          receiptCount: { $size: { $ifNull: ["$receipts", []] } },
        },
      },
      { $project: { receipts: 0 } },
    ])
    .toArray();
  return {
    transactions: rows.slice(0, limit).map(publicDoc),
    hasMore: rows.length > limit && limit < MAX_LIMIT,
  };
}

/** Income/expense totals for the same filters (transfers are neither). */
export async function summarizeTransactions(userId, params) {
  const filter = await buildFilter(userId, params);
  const match = filter.type
    ? filter
    : { ...filter, type: { $in: ["income", "expense"] } };
  const rows = await col("transactions")
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));
  return {
    income: by.income?.total ?? 0,
    expense: by.expense?.total ?? 0,
    count: (by.income?.count ?? 0) + (by.expense?.count ?? 0),
  };
}
