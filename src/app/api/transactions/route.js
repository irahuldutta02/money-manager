import { created, readJson, route } from "@/lib/server/api";
import { createTransaction } from "@/lib/server/services/transactions";

export const POST = route(async ({ request, userId }) =>
  created(await createTransaction(userId, await readJson(request))),
);
