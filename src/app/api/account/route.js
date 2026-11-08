import { route } from "@/lib/server/api";
import { deleteAccount } from "@/lib/server/services/account";

// Permanently deletes the signed-in user and all of their data.
export const DELETE = route(({ userId }) => deleteAccount(userId));
