import { readJson, route } from "@/lib/server/api";
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/lib/server/services/transactions";
import { id } from "@/lib/server/validate";

export const GET = route(({ userId, params }) =>
  getTransaction(userId, id(params.id, "id")),
);

export const PATCH = route(async ({ request, userId, params }) =>
  updateTransaction(userId, id(params.id, "id"), await readJson(request)),
);

export const DELETE = route(({ userId, params }) =>
  deleteTransaction(userId, id(params.id, "id")),
);
