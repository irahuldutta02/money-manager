import { readJson, route } from "@/lib/server/api";
import {
  deleteCategory,
  updateCategory,
} from "@/lib/server/services/categories";
import { id } from "@/lib/server/validate";

export const PATCH = route(async ({ request, userId, params }) =>
  updateCategory(userId, id(params.id, "id"), await readJson(request)),
);

export const DELETE = route(({ userId, params }) =>
  deleteCategory(userId, id(params.id, "id")),
);
