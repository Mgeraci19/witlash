import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
    args: { roomCode: v.string() },
    handler: async (ctx, args) => {
        const game = await ctx.db
            .query("games")
            .withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
            .first();

        if (!game) return null;

        const players = await ctx.db
            .query("players")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();

        const prompts = await ctx.db
            .query("prompts")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();

        const submissions = [];
        const votes = [];
        for (const p of prompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", p._id)).collect();
            submissions.push(...subs);

            // Get votes for this prompt (not all votes from all games!)
            const promptVotes = await ctx.db.query("votes").withIndex("by_prompt", q => q.eq("promptId", p._id)).collect();
            votes.push(...promptVotes);
        }

        const suggestions = await ctx.db.query("suggestions").withIndex("by_game", q => q.eq("gameId", game._id)).collect();

        return { ...game, players, messages, prompts, submissions, votes, suggestions };
    },
});
