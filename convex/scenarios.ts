import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const setupRound2Test = mutation({
    args: {},
    handler: async (ctx) => {
        // 1. Create Game
        const gameId = await ctx.db.insert("games", {
            roomCode: "TEST01",
            status: "VOTING",
            currentRound: 2,
            roundStatus: "REVEAL" // Ready for nextBattle to be called
        });

        // 2. Create Players
        const p1 = await ctx.db.insert("players", { gameId, name: "Victim", score: 0, isVip: true, hp: 10, knockedOut: false });
        const p2 = await ctx.db.insert("players", { gameId, name: "Killer", score: 0, isVip: false, hp: 100, knockedOut: false });
        const p3 = await ctx.db.insert("players", { gameId, name: "Bystander1", score: 0, isVip: false, hp: 100, knockedOut: false });
        const p4 = await ctx.db.insert("players", { gameId, name: "Bystander2", score: 0, isVip: false, hp: 100, knockedOut: false });

        // 3. Create Prompts (Pair 1: Victim vs Killer, Pair 2: By1 vs By2)
        const prompt1 = await ctx.db.insert("prompts", { gameId, text: "Prompt 1 (V vs K)", assignedTo: [p1, p2] });
        const prompt2 = await ctx.db.insert("prompts", { gameId, text: "Prompt 2 (V vs K) - Should Skip", assignedTo: [p1, p2] });
        const prompt3 = await ctx.db.insert("prompts", { gameId, text: "Prompt 3 (B1 vs B2) - Should Be Next", assignedTo: [p3, p4] });

        // Set current prompt
        await ctx.db.patch(gameId, { currentPromptId: prompt1 });

        // 4. Create Submissions for Prompt 1
        const s1 = await ctx.db.insert("submissions", { promptId: prompt1, playerId: p1, text: "Weak Answer" });
        const s2 = await ctx.db.insert("submissions", { promptId: prompt1, playerId: p2, text: "Strong Answer" });

        // 5. Create Votes (All for Killer, so Victim takes damage)
        // Damage Calc: votesAgainst / totalVotes * 35. 
        // If we have 2 votes, both for Killer (s2). 
        // Victim (s1): 0 votes for. 2 votes against. Damage = (2/2) * 35 = 35. 
        // Victim HP is 10. Should die.

        await ctx.db.insert("votes", { promptId: prompt1, playerId: p3, submissionId: s2 });
        await ctx.db.insert("votes", { promptId: prompt1, playerId: p4, submissionId: s2 });

        return { gameId, prompt1, prompt2, prompt3, p1 };
    }
});

export const checkGameStatus = query({
    args: { gameId: v.id("games") },
    handler: async (ctx, args) => {
        const game = await ctx.db.get(args.gameId);
        const p1 = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).first(); // Just picking one to check KO status if needed, but query by ID is better
        return {
            currentPromptId: game?.currentPromptId,
            roundStatus: game?.roundStatus
        };
    }
});

export const checkPlayerStatus = query({
    args: { playerId: v.id("players") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.playerId);
    }
});
