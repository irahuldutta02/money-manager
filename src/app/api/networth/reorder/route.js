import { readJson, route } from "@/lib/server/api";
import { reorderHoldings } from "@/lib/server/services/networth";

export const POST = route(async ({ request, userId }) =>
  reorderHoldings(userId, await readJson(request)),
);
