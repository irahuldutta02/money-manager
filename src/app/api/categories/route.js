import { created, readJson, route } from "@/lib/server/api";
import { createCategory } from "@/lib/server/services/categories";

export const POST = route(async ({ request, userId }) =>
  created(await createCategory(userId, await readJson(request))),
);
