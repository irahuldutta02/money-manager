import { readJson, route } from "@/lib/server/api";
import {
  clearBudgets,
  deleteBudget,
  listBudgets,
  upsertBudget,
} from "@/lib/server/services/budgets";

export const GET = route(({ request, userId }) =>
  listBudgets(userId, new URL(request.url).searchParams),
);

// Create or update (upsert) the budget for a month + category (or overall).
export const POST = route(async ({ request, userId }) =>
  upsertBudget(userId, await readJson(request)),
);

// ?month[&categoryId] removes one budget; ?month&all=1 removes the whole month.
export const DELETE = route(({ request, userId }) => {
  const params = new URL(request.url).searchParams;
  return params.get("all") === "1"
    ? clearBudgets(userId, params)
    : deleteBudget(userId, params);
});
