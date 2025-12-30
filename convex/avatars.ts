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

// Helper to create simple SVG data URLs
function createSvgAvatar(bgColor: string, shape: string, shapeColor: string): string {
  let shapeEl = "";
  switch (shape) {
    case "circle":
      shapeEl = `<circle cx="150" cy="150" r="80" fill="${shapeColor}"/>`;
      break;
    case "square":
      shapeEl = `<rect x="70" y="70" width="160" height="160" fill="${shapeColor}"/>`;
      break;
    case "triangle":
      shapeEl = `<polygon points="150,50 250,250 50,250" fill="${shapeColor}"/>`;
      break;
    case "star":
      shapeEl = `<polygon points="150,25 179,111 269,111 197,165 223,251 150,200 77,251 103,165 31,111 121,111" fill="${shapeColor}"/>`;
      break;
    case "diamond":
      shapeEl = `<polygon points="150,30 250,150 150,270 50,150" fill="${shapeColor}"/>`;
      break;
    case "cross":
      shapeEl = `<path d="M120,50 h60 v70 h70 v60 h-70 v70 h-60 v-70 h-70 v-60 h70 z" fill="${shapeColor}"/>`;
      break;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="${bgColor}"/>
    ${shapeEl}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Seed simple test avatars (no args needed)
export const seedTestAvatars = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing defaults first
    const existing = await ctx.db.query("defaultAvatars").collect();
    for (const avatar of existing) {
      await ctx.db.delete(avatar._id);
    }

    const testAvatars = [
      { name: "Red Circle", imageData: createSvgAvatar("#FFE0E0", "circle", "#FF4444") },
      { name: "Blue Square", imageData: createSvgAvatar("#E0E8FF", "square", "#4444FF") },
      { name: "Green Triangle", imageData: createSvgAvatar("#E0FFE8", "triangle", "#44BB44") },
      { name: "Gold Star", imageData: createSvgAvatar("#FFF8E0", "star", "#FFD700") },
      { name: "Purple Diamond", imageData: createSvgAvatar("#F0E0FF", "diamond", "#8844CC") },
      { name: "Orange Cross", imageData: createSvgAvatar("#FFF0E0", "cross", "#FF8800") },
    ];

    for (const avatar of testAvatars) {
      await ctx.db.insert("defaultAvatars", {
        name: avatar.name,
        imageData: avatar.imageData,
      });
    }

    return { seeded: testAvatars.length };
  },
});
