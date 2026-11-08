import { route } from "@/lib/server/api";
import { restoreTransaction } from "@/lib/server/services/transactions";
import { id } from "@/lib/server/validate";

export const POST = route(({ userId, params }) =>
  restoreTransaction(userId, id(params.id, "id")),
);
