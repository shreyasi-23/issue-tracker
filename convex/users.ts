import { query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Public query used by the frontend to show the signed-in user in the header.
 * Returns `null` when nobody is signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Server-side helper used by mutations (and queries that require auth).
 * Throws if the caller is not signed in, or if their user row no longer exists.
 * Returns the full user document so callers can read fields like `_id` or `name`.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("Signed-in user no longer exists");
  }
  return user;
}