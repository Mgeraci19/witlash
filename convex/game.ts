import { query } from "./_generated/server";
import { v } from "convex/values";

// Host display query - validates hostToken and returns full game state
export const getForHost = query({
    args: { roomCode: v.string(), hostToken: v.string() },
    handler: async (ctx, args) => {
        const game = await ctx.db
            .query("games")
            .withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
            .first();

        if (!game || game.hostToken !== args.hostToken) return null;

        const players = await ctx.db
            .query("players")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();

        // Don't expose session tokens to clients
        const sanitizedPlayers = players.map(p => ({
            ...p,
            sessionToken: undefined
        }));

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

        // Host sees same submission visibility as players
        const showAllSubmissions = game.status === "ROUND_RESULTS" || game.status === "RESULTS";
        const showCurrentPromptOnly = game.status === "VOTING" && game.currentPromptId;

        for (const p of prompts) {
            if (showAllSubmissions || (showCurrentPromptOnly && p._id === game.currentPromptId)) {
                const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", p._id)).collect();
                submissions.push(...subs);
            }

            const promptVotes = await ctx.db.query("votes").withIndex("by_prompt", q => q.eq("promptId", p._id)).collect();
            votes.push(...promptVotes);
        }

        const suggestions = await ctx.db.query("suggestions").withIndex("by_game", q => q.eq("gameId", game._id)).collect();

        // Don't expose hostToken to client
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { hostToken: _hostToken, ...gameWithoutToken } = game;
        return { ...gameWithoutToken, players: sanitizedPlayers, messages, prompts, submissions, votes, suggestions };
    },
});

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

        // Don't expose session tokens to clients
        const sanitizedPlayers = players.map(p => ({
            ...p,
            sessionToken: undefined
        }));

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

        // Filter submissions based on game phase to prevent peeking at answers
        // - LOBBY/PROMPTS: No submissions returned (players writing answers)
        // - VOTING: Only return submissions for the current prompt being voted on
        // - ROUND_RESULTS/RESULTS: Return all submissions (game over or round complete)
        const showAllSubmissions = game.status === "ROUND_RESULTS" || game.status === "RESULTS";
        const showCurrentPromptOnly = game.status === "VOTING" && game.currentPromptId;

        for (const p of prompts) {
            // Only fetch submissions if we should show them
            if (showAllSubmissions || (showCurrentPromptOnly && p._id === game.currentPromptId)) {
                const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", p._id)).collect();
                submissions.push(...subs);
            }

            // Get votes for this prompt
            const promptVotes = await ctx.db.query("votes").withIndex("by_prompt", q => q.eq("promptId", p._id)).collect();
            votes.push(...promptVotes);
        }

        const suggestions = await ctx.db.query("suggestions").withIndex("by_game", q => q.eq("gameId", game._id)).collect();

        return { ...game, players: sanitizedPlayers, messages, prompts, submissions, votes, suggestions };
    },
});
