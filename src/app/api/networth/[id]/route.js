import { readJson, route } from "@/lib/server/api";
import { deleteHolding, updateHolding } from "@/lib/server/services/networth";
import { id } from "@/lib/server/validate";

export const PATCH = route(async ({ request, userId, params }) =>
  updateHolding(userId, id(params.id, "id"), await readJson(request)),
);

export const DELETE = route(({ userId, params }) =>
  deleteHolding(userId, id(params.id, "id")),
);
