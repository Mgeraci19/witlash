import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const clearDB = mutation({
    args: {},
    handler: async (ctx) => {
        const tables = [
            "games",
            "players",
            "messages",
            "prompts",
            "submissions",
            "votes",
            "suggestions",
        ];

        for (const table of tables) {
            const docs = await ctx.db.query(table as any).collect();
            for (const doc of docs) {
                await ctx.db.delete(doc._id);
            }
        }
        console.log("Database cleared");
    },
});

export const deleteGame = mutation({
    args: { gameId: v.id("games") },
    handler: async (ctx, args) => {
        // 1. Get Prompts to clean up sub-resources
        const prompts = await ctx.db.query("prompts")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();

        for (const prompt of prompts) {
            // Delete Submissions
            const submissions = await ctx.db.query("submissions")
                .withIndex("by_prompt", q => q.eq("promptId", prompt._id))
                .collect();
            for (const sub of submissions) await ctx.db.delete(sub._id);

            // Delete Votes
            const votes = await ctx.db.query("votes")
                .withIndex("by_prompt", q => q.eq("promptId", prompt._id))
                .collect();
            for (const vote of votes) await ctx.db.delete(vote._id);

            // Delete the prompt itself
            await ctx.db.delete(prompt._id);
        }

        // 2. Delete Players
        const players = await ctx.db.query("players")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();
        for (const p of players) await ctx.db.delete(p._id);

        // 3. Delete Messages
        const messages = await ctx.db.query("messages")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();
        for (const m of messages) await ctx.db.delete(m._id);

        // 4. Delete Suggestions
        const suggestions = await ctx.db.query("suggestions")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();
        for (const s of suggestions) await ctx.db.delete(s._id);

        // 5. Delete Game
        await ctx.db.delete(args.gameId);

        console.log(`[ADMIN] Deleted game ${args.gameId}`);
    }
});
