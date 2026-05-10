import { query, mutation, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getCurrentUser } from "./users";
import type { Doc, Id } from "./_generated/dataModel";
import { assertProjectOwner } from "./projects";

/**
 * Guard for operations that only the issue's creator can perform, and
 * only while the issue is still in the "todo" column. As soon as the
 * project owner moves the issue out of To Do, the creator loses these
 * rights — the issue is considered "triaged" and effectively read-only
 * from the creator's perspective.
 */
async function assertIssueCreatorAndEditable(
  ctx: MutationCtx,
  issueId: Id<"issues">,
): Promise<Doc<"issues">> {
  const user = await getCurrentUser(ctx);
  const issue = await ctx.db.get(issueId);
  if (issue === null) {
    throw new ConvexError("Issue not found");
  }
  if (issue.creatorId !== user._id) {
    throw new ConvexError("Only the creator can modify this issue");
  }
  if (issue.status !== "todo") {
    throw new ConvexError("This issue can no longer be modified");
  }
  return issue;
}

export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("issues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await ctx.db.insert("issues", {
      projectId: args.projectId,
      creatorId: user._id,
      title: args.title,
      description: args.description,
      status: "todo",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("issues"),
    status: v.union(
      v.literal("todo"),
      v.literal("in-progress"),
      v.literal("done"),
    ),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.id);
    if (issue === null) {
      throw new ConvexError("Issue not found");
    }
    // Only the owner of the issue's parent project may move it between
    // columns. Issue creators do not have this right — once an issue is
    // filed, triage is the project owner's responsibility.
    await assertProjectOwner(ctx, issue.projectId);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const update = mutation({
  args: {
    id: v.id("issues"),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await assertIssueCreatorAndEditable(ctx, args.id);
    await ctx.db.patch(args.id, {
      title: args.title,
      description: args.description,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("issues"),
  },
  handler: async (ctx, args) => {
    await assertIssueCreatorAndEditable(ctx, args.id);
    await ctx.db.delete(args.id);
  },
});
