import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
    validatePlayer,
    validateTextInput,
    MAX_MESSAGE_LENGTH,
    MAX_ANSWER_LENGTH,
    MAX_SUGGESTION_LENGTH
} from "./lib/auth";
import { getBotDelay, isBotOnlyBattle } from "./lib/constants";

export const sendMessage = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string(),
        text: v.string()
    },
    handler: async (ctx, args) => {
        // Validate player session
        await validatePlayer(ctx, args.playerId, args.sessionToken);

        // Validate input
        const validatedText = validateTextInput(args.text, MAX_MESSAGE_LENGTH, "Message");

        await ctx.db.insert("messages", {
            gameId: args.gameId,
            playerId: args.playerId,
            text: validatedText,
        });
    },
});

export const submitAnswer = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string(),
        promptId: v.id("prompts"),
        text: v.string(),
        // Attack type for Final round (jab = 1x, haymaker = 2x, flyingKick = 3x dealt/4x received)
        attackType: v.optional(v.union(
            v.literal("jab"),
            v.literal("haymaker"),
            v.literal("flyingKick")
        ))
    },
    handler: async (ctx, args) => {
        // Validate player session
        await validatePlayer(ctx, args.playerId, args.sessionToken);

        // Validate prompt exists
        const prompt = await ctx.db.get(args.promptId);
        if (!prompt) {
            console.warn(`[GAME] submitAnswer: Prompt ${args.promptId} not found`);
            throw new Error("Prompt not found");
        }

        // Validate game is in PROMPTS phase
        const game = await ctx.db.get(args.gameId);
        if (!game) {
            throw new Error("Game not found");
        }
        if (game.status !== "PROMPTS") {
            console.warn(`[GAME] submitAnswer: Game ${args.gameId} is in ${game.status}, not PROMPTS`);
            throw new Error("Cannot submit answers at this time");
        }

        // Validate player is assigned to this prompt
        if (!prompt.assignedTo?.includes(args.playerId)) {
            console.warn(`[GAME] submitAnswer: Player ${args.playerId} not assigned to prompt ${args.promptId}`);
            throw new Error("You are not assigned to this prompt");
        }

        // Check for duplicate submission
        const existingSubmission = await ctx.db.query("submissions")
            .withIndex("by_prompt", q => q.eq("promptId", args.promptId))
            .filter(q => q.eq(q.field("playerId"), args.playerId))
            .first();
        if (existingSubmission) {
            console.warn(`[GAME] submitAnswer: Player ${args.playerId} already submitted for prompt ${args.promptId}`);
            throw new Error("You have already submitted for this prompt");
        }

        // Validate input
        const validatedText = validateTextInput(args.text, MAX_ANSWER_LENGTH, "Answer");

        // Semi-Finals JAB enforcement: single word only
        if (game.currentRound === 2 && prompt.promptType === "jab") {
            const wordCount = validatedText.trim().split(/\s+/).length;
            if (wordCount > 1) {
                console.warn(`[GAME] JAB VIOLATION: Player ${args.playerId} tried to submit "${validatedText}" (${wordCount} words) for jab prompt`);
                throw new Error("Jab answers must be a single word!");
            }
        }

        console.log(`[GAME] Player ${args.playerId} submitted answer for ${args.promptId}${args.attackType ? ` (${args.attackType})` : ''}${prompt.promptType ? ` [${prompt.promptType}]` : ''}`);
        await ctx.db.insert("submissions", {
            promptId: args.promptId,
            playerId: args.playerId,
            text: validatedText,
            submittedAt: Date.now(),
            // Only include attackType in Final round (Round 3)
            ...(args.attackType && game.currentRound === 3 && { attackType: args.attackType })
        });

        // MVP Check: Total Submissions >= Prompts * 2
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        // Assuming 2 players per prompt.
        // Note: For Final round, we only generate 1 prompt at a time, so prompts.length * 2 is correct (1 prompt * 2 players = 2 subs).
        const totalExpected = allPrompts.length * 2;

        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived >= totalExpected) {
            // Re-fetch game to check isTransitioning (prevent race condition)
            const currentGame = await ctx.db.get(args.gameId);
            if (currentGame?.isTransitioning) {
                console.log(`[GAME] Skipping transition - already transitioning`);
                return;
            }

            // Set transitioning flag to prevent concurrent transitions
            await ctx.db.patch(args.gameId, { isTransitioning: true });

            console.log(`[GAME] All answers received! Moving to VOTING.`);

            // For Final round, we want the LATEST prompt (newest one created)
            // For other rounds, first prompt is fine
            const startPromptId = currentGame?.currentRound === 3
                ? allPrompts[allPrompts.length - 1]._id  // Latest prompt in Final
                : allPrompts[0]._id;                      // First prompt otherwise

            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: startPromptId,
                roundStatus: "VOTING",
                isTransitioning: false  // Clear flag after transition
            });
            // BOTS VOTE - check if bot-only for instant simulation
            const allPlayersForCheck = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
            const startPrompt = allPrompts.find(p => p._id === startPromptId);
            const botOnlyBattle = isBotOnlyBattle(startPrompt?.assignedTo, allPlayersForCheck);
            const delay = getBotDelay("VOTE", botOnlyBattle);
            console.log(`[SUBMIT ANSWER] Scheduling bot votes with delay ${delay}ms (botOnly: ${botOnlyBattle})`);
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: startPromptId });
        }
    }
});

export const submitVote = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string(),
        promptId: v.id("prompts"),
        submissionId: v.id("submissions")
    },
    handler: async (ctx, args) => {
        // Validate player session
        const player = await validatePlayer(ctx, args.playerId, args.sessionToken);

        // Validate prompt exists
        const prompt = await ctx.db.get(args.promptId);
        if (!prompt) {
            console.warn(`[VOTE] Prompt ${args.promptId} not found`);
            throw new Error("Prompt not found");
        }

        // Validate game is in VOTING phase
        const game = await ctx.db.get(args.gameId);
        if (!game) {
            throw new Error("Game not found");
        }
        if (game.status !== "VOTING") {
            console.warn(`[VOTE] Game ${args.gameId} is in ${game.status}, not VOTING`);
            throw new Error("Cannot vote at this time");
        }

        // Validate submission exists and belongs to this prompt
        const submission = await ctx.db.get(args.submissionId);
        if (!submission || submission.promptId !== args.promptId) {
            console.warn(`[VOTE] Submission ${args.submissionId} not found or doesn't belong to prompt ${args.promptId}`);
            throw new Error("Invalid submission");
        }

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
            // Re-fetch game to check isTransitioning (prevent race condition)
            const currentGame = await ctx.db.get(args.gameId);
            if (currentGame?.isTransitioning) {
                console.log(`[VOTE] Skipping transition - already transitioning`);
                return;
            }

            // Set transitioning flag
            await ctx.db.patch(args.gameId, { isTransitioning: true });

            console.log(`[VOTE] 🎉 All votes received! Advancing to REVEAL`);
            await ctx.db.patch(args.gameId, { roundStatus: "REVEAL", isTransitioning: false });
        }
    }
});

export const submitSuggestion = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string(),
        promptId: v.id("prompts"),
        text: v.string()
    },
    handler: async (ctx, args) => {
        // Validate player session
        const player = await validatePlayer(ctx, args.playerId, args.sessionToken);

        if (player.role !== "CORNER_MAN") throw new Error("Only Corner Men can suggest");
        if (!player.teamId) throw new Error("No team assigned");

        // Validate input
        const validatedText = validateTextInput(args.text, MAX_SUGGESTION_LENGTH, "Suggestion");

        // Validate target
        const target = await ctx.db.get(player.teamId);
        if (!target) throw new Error("Captain not found");

        await ctx.db.insert("suggestions", {
            gameId: args.gameId,
            promptId: args.promptId,
            senderId: args.playerId,
            targetId: player.teamId,
            text: validatedText
        });
    }
});

// Submit answer on behalf of a bot captain (corner man only)
export const submitAnswerForBot = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),  // The corner man's ID (for auth)
        sessionToken: v.string(),
        promptId: v.id("prompts"),
        text: v.string(),
        // Attack type for Final round (jab = 1x, haymaker = 2x, flyingKick = 3x dealt/4x received)
        attackType: v.optional(v.union(
            v.literal("jab"),
            v.literal("haymaker"),
            v.literal("flyingKick")
        ))
    },
    handler: async (ctx, args) => {
        // Validate corner man's session
        const cornerMan = await validatePlayer(ctx, args.playerId, args.sessionToken);

        if (cornerMan.role !== "CORNER_MAN") throw new Error("Only Corner Men can submit for bots");
        if (!cornerMan.teamId) throw new Error("No team assigned");

        // Validate prompt exists
        const prompt = await ctx.db.get(args.promptId);
        if (!prompt) {
            console.warn(`[GAME] submitAnswerForBot: Prompt ${args.promptId} not found`);
            throw new Error("Prompt not found");
        }

        // Validate game is in PROMPTS phase
        const game = await ctx.db.get(args.gameId);
        if (!game) {
            throw new Error("Game not found");
        }
        if (game.status !== "PROMPTS") {
            console.warn(`[GAME] submitAnswerForBot: Game ${args.gameId} is in ${game.status}, not PROMPTS`);
            throw new Error("Cannot submit answers at this time");
        }

        // Get the captain (bot)
        const captain = await ctx.db.get(cornerMan.teamId);
        if (!captain) throw new Error("Captain not found");
        if (!captain.isBot) throw new Error("Can only submit for bot captains");

        // Validate bot captain is assigned to this prompt
        if (!prompt.assignedTo?.includes(cornerMan.teamId)) {
            console.warn(`[GAME] submitAnswerForBot: Bot ${cornerMan.teamId} not assigned to prompt ${args.promptId}`);
            throw new Error("Bot is not assigned to this prompt");
        }

        // Validate input
        const validatedText = validateTextInput(args.text, MAX_ANSWER_LENGTH, "Answer");

        // Semi-Finals JAB enforcement: single word only
        if (game.currentRound === 2 && prompt.promptType === "jab") {
            const wordCount = validatedText.trim().split(/\s+/).length;
            if (wordCount > 1) {
                console.warn(`[GAME] JAB VIOLATION: Corner man ${cornerMan.name} tried to submit "${validatedText}" (${wordCount} words) for bot jab prompt`);
                throw new Error("Jab answers must be a single word!");
            }
        }

        // Check if bot already submitted for this prompt
        const existingSubmission = await ctx.db.query("submissions")
            .withIndex("by_prompt", q => q.eq("promptId", args.promptId))
            .filter(q => q.eq(q.field("playerId"), cornerMan.teamId))
            .first();

        if (existingSubmission) {
            throw new Error("Bot has already submitted for this prompt");
        }

        console.log(`[GAME] Corner man ${cornerMan.name} submitted answer for bot ${captain.name} on prompt ${args.promptId}${args.attackType ? ` (${args.attackType})` : ''}${prompt.promptType ? ` [${prompt.promptType}]` : ''}`);

        // Submit as the BOT, not the corner man
        await ctx.db.insert("submissions", {
            promptId: args.promptId,
            playerId: cornerMan.teamId,  // Use the BOT's ID
            text: validatedText,
            submittedAt: Date.now(),
            // Only include attackType in Final round (Round 3)
            ...(args.attackType && game.currentRound === 3 && { attackType: args.attackType })
        });

        // Check if all submissions are in (same logic as submitAnswer)
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const totalExpected = allPrompts.length * 2;

        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived >= totalExpected) {
            // Re-fetch game to check isTransitioning (prevent race condition)
            // Note: game was already fetched above for validation
            const currentGame = await ctx.db.get(args.gameId);
            if (currentGame?.isTransitioning) {
                console.log(`[GAME] Skipping transition - already transitioning`);
                return;
            }

            // Set transitioning flag to prevent concurrent transitions
            await ctx.db.patch(args.gameId, { isTransitioning: true });

            console.log(`[GAME] All answers received! Moving to VOTING.`);

            const startPromptId = currentGame?.currentRound === 3
                ? allPrompts[allPrompts.length - 1]._id
                : allPrompts[0]._id;

            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: startPromptId,
                roundStatus: "VOTING",
                isTransitioning: false  // Clear flag after transition
            });

            // BOTS VOTE - check if bot-only for instant simulation
            const allPlayersForCheck = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
            const startPrompt = allPrompts.find(p => p._id === startPromptId);
            const botOnlyBattle = isBotOnlyBattle(startPrompt?.assignedTo, allPlayersForCheck);
            const delay = getBotDelay("VOTE", botOnlyBattle);
            console.log(`[SUBMIT ANSWER FOR BOT] Scheduling bot votes with delay ${delay}ms (botOnly: ${botOnlyBattle})`);
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: startPromptId });
        }
    }
});
