import { created, readJson, route } from "@/lib/server/api";
import { createAccount } from "@/lib/server/services/accounts";

export const POST = route(async ({ request, userId }) =>
  created(await createAccount(userId, await readJson(request))),
);
