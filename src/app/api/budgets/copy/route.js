import { readJson, route } from "@/lib/server/api";
import { copyBudgets } from "@/lib/server/services/budgets";

// Body: { from: "2026-10", to: "2026-11" }
export const POST = route(async ({ request, userId }) =>
  copyBudgets(userId, await readJson(request)),
);
