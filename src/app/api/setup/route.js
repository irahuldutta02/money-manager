import { readJson, route } from "@/lib/server/api";
import { ensureSetup } from "@/lib/server/services/setup";

export const POST = route(async ({ request, userId }) => {
  const body = await readJson(request);
  return ensureSetup(userId, body.currency, {
    starterCategories: body.starterCategories !== false,
    cashAccount: body.cashAccount !== false,
  });
});
