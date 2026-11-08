import { readJson, route } from "@/lib/server/api";
import { setLendingIncluded } from "@/lib/server/services/networth";

export const POST = route(async ({ request, userId }) =>
  setLendingIncluded(userId, await readJson(request)),
);
