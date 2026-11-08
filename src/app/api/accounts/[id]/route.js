import { readJson, route } from "@/lib/server/api";
import { deleteAccount, updateAccount } from "@/lib/server/services/accounts";
import { id } from "@/lib/server/validate";

export const PATCH = route(async ({ request, userId, params }) =>
  updateAccount(userId, id(params.id, "id"), await readJson(request)),
);

export const DELETE = route(({ userId, params }) =>
  deleteAccount(userId, id(params.id, "id")),
);
