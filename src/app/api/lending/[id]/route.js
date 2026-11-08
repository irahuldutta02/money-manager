import { readJson, route } from "@/lib/server/api";
import { deleteLending, updateLending } from "@/lib/server/services/lending";
import { id } from "@/lib/server/validate";

export const PATCH = route(async ({ request, userId, params }) =>
  updateLending(userId, id(params.id, "id"), await readJson(request)),
);

export const DELETE = route(({ userId, params }) =>
  deleteLending(userId, id(params.id, "id")),
);
