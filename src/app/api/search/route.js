import { route } from "@/lib/server/api";
import { searchTransactions } from "@/lib/server/services/search";

export const GET = route(({ request, userId }) =>
  searchTransactions(userId, new URL(request.url).searchParams),
);
