import { route } from "@/lib/server/api";
import { summarizeTransactions } from "@/lib/server/services/search";

// Same filters as /api/search: from, to, q, type, categoryId, accountId, min, max.
export const GET = route(({ request, userId }) =>
  summarizeTransactions(userId, new URL(request.url).searchParams),
);
