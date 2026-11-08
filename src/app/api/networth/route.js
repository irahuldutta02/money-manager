import { created, readJson, route } from "@/lib/server/api";
import { createHolding, getNetWorth } from "@/lib/server/services/networth";

export const GET = route(({ userId }) => getNetWorth(userId));

export const POST = route(async ({ request, userId }) =>
  created(await createHolding(userId, await readJson(request))),
);
