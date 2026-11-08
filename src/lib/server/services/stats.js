import "server-only";
import { col } from "../mongodb";
import { ApiError } from "../api";
import { date, oneOf } from "../validate";

function range(userId, params) {
  const from = date(params.get("from"), "from");
  const to = date(params.get("to"), "to");
  if (to <= from) throw new ApiError(400, "Invalid date range");
  return {
    userId,
    deletedAt: null,
    // Transfers are not income or expense.
    type: { $in: ["income", "expense"] },
    date: { $gte: from, $lt: to },
  };
}

/** Spend (or income) per top-level category for the donut chart. */
async function categories(userId, params) {
  const type = oneOf(params.get("type") ?? "expense", "type", [
    "expense",
    "income",
  ]);
  const rows = await col("transactions")
    .aggregate([
      { $match: { ...range(userId, params), type } },
      {
        $group: {
          _id: "$categoryId",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ])
    .toArray();
  return {
    categories: rows.map((r) => ({
      categoryId: r._id,
      total: r.total,
      count: r.count,
    })),
  };
}

export function stats(userId, params) {
  switch (params.get("kind")) {
    case "categories":
      return categories(userId, params);
    default:
      throw new ApiError(400, "kind must be categories");
  }
}
