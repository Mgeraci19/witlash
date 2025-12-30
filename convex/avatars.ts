import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { validatePlayer } from "./lib/auth";

// Maximum avatar size (500KB base64 string)
const MAX_AVATAR_SIZE = 500000;

// Save a custom-drawn avatar
export const saveAvatar = mutation({
  args: {
    playerId: v.id("players"),
    sessionToken: v.string(),
    avatarData: v.string(),
  },
  handler: async (ctx, args) => {
    await validatePlayer(ctx, args.playerId, args.sessionToken);

    // Validate avatar size
    if (args.avatarData.length > MAX_AVATAR_SIZE) {
      throw new Error("Avatar image too large (max 500KB)");
    }

    // Validate it's a data URL
    if (!args.avatarData.startsWith("data:image/")) {
      throw new Error("Invalid avatar format");
    }

    await ctx.db.patch(args.playerId, {
      avatar: args.avatarData,
    });
  },
});

// Get all default avatars
export const getDefaults = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("defaultAvatars").collect();
  },
});

// Select a default avatar (copy its imageData to player)
export const selectDefault = mutation({
  args: {
    playerId: v.id("players"),
    sessionToken: v.string(),
    avatarId: v.id("defaultAvatars"),
  },
  handler: async (ctx, args) => {
    await validatePlayer(ctx, args.playerId, args.sessionToken);

    const defaultAvatar = await ctx.db.get(args.avatarId);
    if (!defaultAvatar) {
      throw new Error("Default avatar not found");
    }

    await ctx.db.patch(args.playerId, {
      avatar: defaultAvatar.imageData,
    });
  },
});

// Assign a random default avatar (for skip + bots)
export const assignRandomDefault = mutation({
  args: {
    playerId: v.id("players"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await validatePlayer(ctx, args.playerId, args.sessionToken);

    const defaults = await ctx.db.query("defaultAvatars").collect();
    if (defaults.length === 0) {
      // No defaults available, leave avatar empty
      return;
    }

    const randomDefault = defaults[Math.floor(Math.random() * defaults.length)];
    await ctx.db.patch(args.playerId, {
      avatar: randomDefault.imageData,
    });
  },
});

// Internal helper: Assign random default to a bot (no auth needed, called from lobby.ts)
export const assignRandomDefaultToBot = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player || !player.isBot) {
      throw new Error("Can only assign to bots");
    }

    const defaults = await ctx.db.query("defaultAvatars").collect();
    if (defaults.length === 0) {
      return;
    }

    const randomDefault = defaults[Math.floor(Math.random() * defaults.length)];
    await ctx.db.patch(args.playerId, {
      avatar: randomDefault.imageData,
    });
  },
});

// Seed default avatars (run once via dashboard or script)
export const seedDefaultAvatars = mutation({
  args: {
    avatars: v.array(
      v.object({
        name: v.string(),
        imageData: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Clear existing defaults first
    const existing = await ctx.db.query("defaultAvatars").collect();
    for (const avatar of existing) {
      await ctx.db.delete(avatar._id);
    }

    // Insert new defaults
    for (const avatar of args.avatars) {
      await ctx.db.insert("defaultAvatars", {
        name: avatar.name,
        imageData: avatar.imageData,
      });
    }
  },
});
