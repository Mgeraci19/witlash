import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const sendMessage = mutation({
    args: { gameId: v.id("games"), playerId: v.id("players"), text: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.insert("messages", {
            gameId: args.gameId,
            playerId: args.playerId,
            text: args.text,
        });
    },
});

export const submitAnswer = mutation({
    args: { gameId: v.id("games"), playerId: v.id("players"), promptId: v.id("prompts"), text: v.string() },
    handler: async (ctx, args) => {
        console.log(`[GAME] Player ${args.playerId} submitted answer for ${args.promptId}`);
        await ctx.db.insert("submissions", {
            promptId: args.promptId,
            playerId: args.playerId,
            text: args.text,
        });

        // MVP Check: Total Submissions >= Prompts * 2
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        // Assuming 2 players per prompt. 
        // Note: For Round 4, we only generate 1 prompt at a time, so prompts.length * 2 is correct (1 prompt * 2 players = 2 subs).
        const totalExpected = allPrompts.length * 2;

        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived >= totalExpected) {
            console.log(`[GAME] All answers received! Moving to VOTING.`);

            // For Round 4 (Sudden Death), we want the LATEST prompt (newest one created)
            // For other rounds, first prompt is fine
            const game = await ctx.db.get(args.gameId);
            const startPromptId = game?.currentRound === 4
                ? allPrompts[allPrompts.length - 1]._id  // Latest prompt in Round 4
                : allPrompts[0]._id;                      // First prompt otherwise

            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: startPromptId,
                roundStatus: "VOTING"
            });
            // BOTS VOTE
            const delay = 300 + Math.random() * 400;
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: startPromptId });
        }
    }
});

export const submitVote = mutation({
    args: { gameId: v.id("games"), playerId: v.id("players"), promptId: v.id("prompts"), submissionId: v.id("submissions") },
    handler: async (ctx, args) => {
        console.log(`[VOTE] Player ${args.playerId} attempting to vote for submission ${args.submissionId} in prompt ${args.promptId}`);

        const existing = await ctx.db.query("votes")
            .withIndex("by_prompt", q => q.eq("promptId", args.promptId))
            .filter(q => q.eq(q.field("playerId"), args.playerId))
            .first();

        if (existing) {
            console.warn(`[VOTE] DUPLICATE VOTE BLOCKED: Player ${args.playerId} already voted for ${existing.submissionId} in prompt ${args.promptId}`);
            throw new Error("Already voted");
        }

        const submissionsInBattle = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", args.promptId)).collect();
        const battlerIds = submissionsInBattle.map(s => s.playerId);
        const player = await ctx.db.get(args.playerId);
        if (!player) throw new Error("Player not found");

        const game = await ctx.db.get(args.gameId);

        // Anti-Cheat: Battlers cannot vote in their own battle
        if (battlerIds.includes(args.playerId)) {
            console.warn(`[VOTE] Battler ${player.name} tried to vote in their own battle!`);
            throw new Error("You cannot vote in your own battle");
        }

        // Team Loyalty Logic:
        // You cannot vote for your own team (conflict of interest).
        if (player.teamId && battlerIds.includes(player.teamId)) {
            console.warn(`[VOTE] Corner man ${player.name} tried to vote for their own team!`);
            throw new Error("You cannot vote for your own team");
        }

        await ctx.db.insert("votes", {
            promptId: args.promptId,
            playerId: args.playerId,
            submissionId: args.submissionId
        });

        console.log(`[VOTE] ✅ Vote recorded: ${player.name} voted for submission ${args.submissionId}`);

        // Auto-Advance Check
        const players = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        // Calculate "Expected" Votes
        // We need to count how many people are ELIGIBLE to vote.
        // 1. Battlers are never eligible.
        const battlers = players.filter(p => battlerIds.includes(p._id));

        // 2. Teammates of battlers are never eligible.
        const teammates = players.filter(p => !battlerIds.includes(p._id) && p.teamId && battlerIds.includes(p.teamId));
        const ineligibleCount = battlers.length + teammates.length;

        const expectedVotes = Math.max(1, players.length - ineligibleCount);
        const currentVotes = await ctx.db.query("votes").withIndex("by_prompt", q => q.eq("promptId", args.promptId)).collect();

        console.log(`[VOTE] Vote count: ${currentVotes.length}/${expectedVotes} (${ineligibleCount} ineligible players)`);

        if (currentVotes.length >= expectedVotes) {
            console.log(`[VOTE] 🎉 All votes received! Advancing to REVEAL`);
            await ctx.db.patch(args.gameId, { roundStatus: "REVEAL" });
        }
    }
});

export const submitSuggestion = mutation({
    args: { gameId: v.id("games"), playerId: v.id("players"), promptId: v.id("prompts"), text: v.string() },
    handler: async (ctx, args) => {
        const player = await ctx.db.get(args.playerId);
        if (!player || player.role !== "CORNER_MAN") throw new Error("Only Corner Men can suggest");
        if (!player.teamId) throw new Error("No team assigned");

        // Validate target
        const target = await ctx.db.get(player.teamId);
        if (!target) throw new Error("Captain not found");

        await ctx.db.insert("suggestions", {
            gameId: args.gameId,
            promptId: args.promptId,
            senderId: args.playerId,
            targetId: player.teamId,
            text: args.text
        });
    }
});
