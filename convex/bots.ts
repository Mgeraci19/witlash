import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { BOT_WORDS } from "./lib/constants";
import { hasHumanCornerMan } from "./lib/phases";

export const autoAnswer = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        promptId: v.id("prompts"),
    },
    handler: async (ctx, args) => {
        const player = await ctx.db.get(args.playerId);
        if (!player) {
            console.log(`[BOTS] autoAnswer: Player not found ${args.playerId}`);
            return;
        }

        // Double check Human Corner Man status (in case it changed, though unlikely in ms)
        // We need all players to check team linkage
        const allPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        // Log corner men for this bot for debugging
        const cornerMenForThisBot = allPlayers.filter(p => p.role === "CORNER_MAN" && p.teamId === player._id);
        const humanCornerMen = cornerMenForThisBot.filter(p => !p.isBot);

        console.log(`[BOTS] autoAnswer check for ${player.name}:`, {
            totalCornerMen: cornerMenForThisBot.length,
            humanCornerMen: humanCornerMen.length,
            cornerMenNames: cornerMenForThisBot.map(p => ({ name: p.name, isBot: p.isBot }))
        });

        if (hasHumanCornerMan(player._id, allPlayers)) {
            console.log(`[BOTS] Skipping auto-answer for ${player.name} (Has Human Corner Man: ${humanCornerMen.map(p => p.name).join(', ')})`);
            return;
        }

        const text = `${player.name} ${BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)]}`;
        await ctx.db.insert("submissions", {
            promptId: args.promptId,
            playerId: args.playerId,
            text
        });

        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        // Determine expected.
        const totalExpected = allPrompts.length * 2;

        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived >= totalExpected) {
            console.log(`[BOTS] All answers received! Moving to VOTING.`);
            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: allPrompts[0]._id,
                roundStatus: "VOTING"
            });

            // Trigger Bot Votes for the first prompt (Scheduled)
            // We can schedule it here with a delay too!
            const delay = 200 + Math.random() * 300;
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, {
                gameId: args.gameId,
                promptId: allPrompts[0]._id
            });
        }
    }
});

export const sendSuggestions = mutation({
    args: {
        gameId: v.id("games"),
    },
    handler: async (ctx, args) => {
        console.log(`[BOTS] Sending suggestions for game ${args.gameId}`);

        const players = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        // Find all bot cornermen (bots with role CORNER_MAN and teamId pointing to a human)
        const botCornermen = players.filter((p) =>
            p.isBot &&
            p.role === "CORNER_MAN" &&
            p.teamId
        );

        for (const bot of botCornermen) {
            const captain = players.find((p) => p._id === bot.teamId);
            if (!captain || captain.isBot) continue; // Only help human captains

            // Find all prompts assigned to this captain
            const captainPrompts = await ctx.db
                .query("prompts")
                .withIndex("by_game", q => q.eq("gameId", args.gameId))
                .collect();

            const relevantPrompts = captainPrompts.filter((p) =>
                p.assignedTo && p.assignedTo.includes(captain._id)
            );

            // For each prompt, send 2-3 suggestions
            for (const prompt of relevantPrompts) {
                // Check if captain already submitted for this prompt
                const existingSubmission = await ctx.db
                    .query("submissions")
                    .withIndex("by_prompt", q => q.eq("promptId", prompt._id))
                    .filter(q => q.eq(q.field("playerId"), captain._id))
                    .first();

                if (existingSubmission) continue; // Skip if already answered

                // Generate 2-3 suggestions using BOT_WORDS
                const numSuggestions = 2 + Math.floor(Math.random() * 2); // 2 or 3

                for (let i = 0; i < numSuggestions; i++) {
                    const word1 = BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)];
                    const word2 = BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)];
                    const suggestionText = `${word1} ${word2}`;

                    // Check if this exact suggestion already exists
                    const existingSuggestion = await ctx.db
                        .query("suggestions")
                        .filter(q =>
                            q.and(
                                q.eq(q.field("promptId"), prompt._id),
                                q.eq(q.field("senderId"), bot._id),
                                q.eq(q.field("text"), suggestionText)
                            )
                        )
                        .first();

                    if (!existingSuggestion) {
                        await ctx.db.insert("suggestions", {
                            gameId: args.gameId,
                            promptId: prompt._id,
                            senderId: bot._id,
                            targetId: captain._id,
                            text: suggestionText
                        });
                    }
                }
            }
        }

        console.log(`[BOTS] Suggestions sent for ${botCornermen.length} bot cornermen`);
    }
});

export const castVotes = mutation({
    args: {
        gameId: v.id("games"),
        promptId: v.id("prompts"),
    },
    handler: async (ctx, args) => {
        console.log(`[BOTS] Casting votes for prompt ${args.promptId}`);

        // Safety check: Verify the prompt still exists and is current
        const prompt = await ctx.db.get(args.promptId);
        if (!prompt) {
            console.warn(`[BOTS] Prompt ${args.promptId} no longer exists, skipping vote`);
            return;
        }

        const game = await ctx.db.get(args.gameId);
        if (!game) {
            console.warn(`[BOTS] Game ${args.gameId} no longer exists, skipping vote`);
            return;
        }

        // Check if this is the current prompt (prevent voting on old prompts from scheduled calls)
        if (game.currentPromptId !== args.promptId) {
            console.warn(`[BOTS] Prompt ${args.promptId} is not the current prompt (current: ${game.currentPromptId}), skipping vote`);
            return;
        }

        const submissions = await ctx.db.query("submissions").withIndex("by_prompt", (q) => q.eq("promptId", args.promptId)).collect();
        if (submissions.length === 0) {
            console.warn(`[BOTS] No submissions found for prompt ${args.promptId}, skipping vote`);
            return;
        }

        const players = await ctx.db.query("players").withIndex("by_game", (q) => q.eq("gameId", args.gameId)).collect();
        const bots = players.filter((p) => p.isBot);

        const battlerIds = submissions.map((s) => s.playerId);

        for (const bot of bots) {
            // Each bot randomly picks a submission to vote for
            const targetSubmission = submissions[Math.floor(Math.random() * submissions.length)];
            // Skip if bot is battling
            if (battlerIds.includes(bot._id)) continue;

            // Skip if bot is a cornerman for one of the battlers (can't vote for own team)
            if (bot.teamId && battlerIds.includes(bot.teamId)) continue;

            const existing = await ctx.db.query("votes")
                .withIndex("by_prompt", (q) => q.eq("promptId", args.promptId))
                .filter((q) => q.eq(q.field("playerId"), bot._id))
                .first();

            if (!existing) {
                await ctx.db.insert("votes", {
                    promptId: args.promptId,
                    playerId: bot._id,
                    submissionId: targetSubmission._id
                });
            }
        }

        const currentVotes = await ctx.db.query("votes").withIndex("by_prompt", (q) => q.eq("promptId", args.promptId)).collect();

        const battlersAndTheirTeams = players.filter((p) => battlerIds.includes(p._id) || (p.teamId && battlerIds.includes(p.teamId)));
        const expectedVotes = Math.max(1, players.length - battlersAndTheirTeams.length);

        if (currentVotes.length >= expectedVotes) {
            console.log(`[BOTS] All votes in (including bots), moving to REVEAL`);
            await ctx.db.patch(args.gameId, { roundStatus: "REVEAL" });
        }
    }
});

// Need to define `api` for type safety (hacky fallback above `(api as any)`)
import { api } from "./_generated/api";
