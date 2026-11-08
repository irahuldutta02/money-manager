import "server-only";
import { col } from "../mongodb";
import { ApiError } from "../api";
import { MAX_AMOUNT, date, int, optionalId } from "../validate";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function month(v) {
  if (typeof v !== "string" || !MONTH_RE.test(v)) {
    throw new ApiError(400, "month must look like 2026-11");
  }
  return v;
}

// One budget per (user, month, category|overall). A deterministic _id makes the
// upsert race-safe: two simultaneous saves can never create duplicates.
const budgetId = (userId, m, categoryId) =>
  `${userId}:${m}:${categoryId ?? "overall"}`;

export async function listBudgets(userId, params) {
  const m = month(params.get("month"));
  const from = date(params.get("from"), "from");
  const to = date(params.get("to"), "to");
  if (to <= from) throw new ApiError(400, "Invalid date range");

  const [budgets, spend] = await Promise.all([
    col("budgets").find({ userId, month: m, deletedAt: null }).toArray(),
    col("transactions")
      .aggregate([
        {
          $match: {
            userId,
            deletedAt: null,
            type: "expense",
            date: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: "$categoryId", spent: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);

  const byCat = new Map(spend.map((r) => [r._id, r.spent]));
  const overallSpent = spend.reduce((n, r) => n + r.spent, 0);
  return {
    month: m,
    overallSpent,
    // Spend per category, so the UI can show categories that have no budget yet.
    spend: spend.map((r) => ({ categoryId: r._id, spent: r.spent })),
    budgets: budgets.map((b) => ({
      categoryId: b.categoryId,
      amount: b.amount,
      spent: b.categoryId ? (byCat.get(b.categoryId) ?? 0) : overallSpent,
    })),
  };
}

export async function upsertBudget(userId, body) {
  const m = month(body.month);
  const categoryId = optionalId(body.categoryId, "categoryId");
  const amount = int(body.amount, "amount", { min: 1, max: MAX_AMOUNT });

  if (categoryId) {
    const cat = await col("categories").findOne({
      _id: categoryId,
      userId,
      deletedAt: null,
      parentId: null,
      type: "expense",
    });
    if (!cat) throw new ApiError(400, "Category not found");
  }
  const now = new Date();
  await col("budgets").updateOne(
    { _id: budgetId(userId, m, categoryId) },
    {
      $set: {
        userId,
        month: m,
        categoryId,
        amount,
        deletedAt: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return { ok: true };
}

export async function deleteBudget(userId, params) {
  const m = month(params.get("month"));
  const categoryId = optionalId(params.get("categoryId"), "categoryId");
  const r = await col("budgets").updateOne(
    { _id: budgetId(userId, m, categoryId), userId, deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
  );
  if (!r.matchedCount) throw new ApiError(404, "Budget not found", "not_found");
  return { ok: true };
}

/**
 * Copy every live budget from one month into another. Budgets the target
 * month already has are left alone, and categories that no longer exist are
 * skipped.
 */
export async function copyBudgets(userId, body) {
  const from = month(body.from);
  const to = month(body.to);
  if (from === to) throw new ApiError(400, "Pick a different month to copy");

  const source = await col("budgets")
    .find({ userId, month: from, deletedAt: null })
    .toArray();
  if (!source.length) {
    throw new ApiError(404, "No budgets in that month", "not_found");
  }
  const [existing, cats] = await Promise.all([
    col("budgets").find({ userId, month: to, deletedAt: null }).toArray(),
    col("categories")
      .find({ userId, deletedAt: null, parentId: null, type: "expense" })
      .toArray(),
  ]);
  const taken = new Set(existing.map((b) => b.categoryId ?? null));
  const liveCats = new Set(cats.map((c) => c._id));

  const now = new Date();
  let copied = 0;
  for (const b of source) {
    const categoryId = b.categoryId ?? null;
    if (taken.has(categoryId)) continue;
    if (categoryId && !liveCats.has(categoryId)) continue;
    await col("budgets").updateOne(
      { _id: budgetId(userId, to, categoryId) },
      {
        $set: {
          userId,
          month: to,
          categoryId,
          amount: b.amount,
          deletedAt: null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    copied++;
  }
  return { copied, skipped: source.length - copied };
}

/** Remove every budget of a month. */
export async function clearBudgets(userId, params) {
  const m = month(params.get("month"));
  const now = new Date();
  const r = await col("budgets").updateMany(
    { userId, month: m, deletedAt: null },
    { $set: { deletedAt: now, updatedAt: now } },
  );
  return { removed: r.modifiedCount };
}
