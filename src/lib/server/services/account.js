import "server-only";
import { col } from "../mongodb";
import { auth } from "../auth";

/**
 * Permanently deletes a user: every app collection keyed by userId first, then
 * the Better Auth user (which also removes their linked accounts and sessions).
 * App data goes first so a mid-way failure leaves a signed-in user who can retry,
 * rather than orphaned data nobody can reach.
 */
export async function deleteAccount(userId) {
  await Promise.all([
    col("transactions").deleteMany({ userId }),
    col("budgets").deleteMany({ userId }),
    col("categories").deleteMany({ userId }),
    col("accounts").deleteMany({ userId }),
    col("passkey").deleteMany({ userId }),
  ]);
  await col("userSettings").deleteOne({ _id: userId });

  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUser(userId);
  return { ok: true };
}
