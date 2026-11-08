import { route } from "@/lib/server/api";
import { recomputeBalances } from "@/lib/server/services/accounts";

// Repair tool: rebuilds every balance from opening balance + active transactions.
export const POST = route(({ userId }) => recomputeBalances(userId));
