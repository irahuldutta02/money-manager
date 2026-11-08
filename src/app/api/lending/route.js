import { created, readJson, route } from "@/lib/server/api";
import { createLending, listLending } from "@/lib/server/services/lending";

export const GET = route(({ userId }) => listLending(userId));

export const POST = route(async ({ request, userId }) =>
  created(await createLending(userId, await readJson(request))),
);
