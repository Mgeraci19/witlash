import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { setupPhase1, setupPhase2, setupPhase3, setupPhase4, resolvePhase2, createSuddenDeathPrompt } from "./lib/phases";
import { resolveBattle } from "./lib/gameLogic";
import { api } from "./_generated/api";
import { validateVipPlayer } from "./lib/auth";




export const nextBattle = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string()
    },
    handler: async (ctx, args) => {
        // Validate that the player is VIP
        await validateVipPlayer(ctx, args.playerId, args.sessionToken);

        const game = await ctx.db.get(args.gameId);
        if (!game) return;

        console.log(`[NEXT BATTLE] Called for round ${game.currentRound}, promptId: ${game.currentPromptId}`);

        // Damage Calculation
        if (game.currentPromptId) {
            await resolveBattle(ctx, args.gameId, game.currentPromptId, game.currentRound);
        }

        // Generic check: If only 1 fighter remains, game ends immediately
        const playersAfterBattle = await ctx.db.query("players")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();
        const activeFighters = playersAfterBattle.filter(
            p => p.role === "FIGHTER" && !p.knockedOut
        );

        if (activeFighters.length <= 1) {
            if (activeFighters.length === 1) {
                console.log(`[GAME] Only 1 fighter remains: ${activeFighters[0].name} wins! Ending game.`);
            } else {
                console.log(`[GAME] No fighters remain! Ending game (draw).`);
            }
            await ctx.db.patch(args.gameId, {
                status: "RESULTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });
            // Cleanup
            const cleanupDelay = 60 * 60 * 1000; // 1 Hour
            await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
            return;
        }

        // Check for Round 4 Winner (Sudden Death)
        if (game.currentRound === 4) {
            const activePlayers = await ctx.db.query("players").withIndex("by_game", (q) => q.eq("gameId", args.gameId)).collect();
            const survivors = activePlayers.filter((p) => !p.knockedOut);

            if (survivors.length === 1) {
                console.log(`[GAME] Round 4 Ended: Winner is ${survivors[0].name}`);
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                // Cleanup
                const cleanupDelay = 60 * 60 * 1000; // 1 Hour
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
                return;
            }
        }

        // NOTE: Removed Round 3 early exit check here (G2 fix).
        // The round should complete all remaining prompts first.
        // Prompts with KO'd players are already skipped by the logic below (lines 93+).
        // The ≤1 fighter check above handles the "only 1 survivor" case.

        // Move to NEXT prompt
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const currentIndex = allPrompts.findIndex(p => p._id === game.currentPromptId);

        // Refresh players to check for knockouts
        const currentPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const knockedOutIds = new Set(currentPlayers.filter(p => p.knockedOut).map(p => p._id));

        let nextPromptId = null;

        // Find the next prompt where NO assigned player is knocked out
        for (let i = currentIndex + 1; i < allPrompts.length; i++) {
            const p = allPrompts[i];
            const assignedIds = p.assignedTo || [];

            // If any player in this prompt is knocked out, we skip it (unless it's empty/everyone is somehow KO'd, but assuming pairing logic holds)
            const isMatchupDead = assignedIds.some(id => knockedOutIds.has(id));

            if (!isMatchupDead) {
                nextPromptId = p._id;
                break;
            } else {
                console.log(`[GAME] Skipping prompt ${p._id} because a player is knocked out.`);
            }
        }

        if (nextPromptId) {
            await ctx.db.patch(args.gameId, {
                currentPromptId: nextPromptId,
                roundStatus: "VOTING"
            });
            // BOTS VOTE
            const delay = 300 + Math.random() * 400;
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: nextPromptId });
        } else {
            // If no next prompt found
            if (game.currentRound === 4) {
                // Round 4 Continuous Sudden Death Logic
                const updatedPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
                const survivors = updatedPlayers.filter(p => !p.knockedOut);

                if (survivors.length === 2) {
                    console.log(`[GAME] Round 4: No winner yet, starting next Sudden Death prompt!`);
                    await createSuddenDeathPrompt(ctx, args.gameId, survivors[0], survivors[1], updatedPlayers);
                    return;
                }
            }

            // End of Round
            const maxRounds = game.maxRounds || 3;
            if (game.currentRound < maxRounds) {
                await ctx.db.patch(args.gameId, {
                    status: "ROUND_RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
            } else {
                // Game Over
                await ctx.db.patch(args.gameId, { status: "RESULTS", currentPromptId: undefined, roundStatus: undefined });
                // Cleanup
                const cleanupDelay = 60 * 60 * 1000; // 1 Hour
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
            }
        }
    }
});

export const nextRound = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string()
    },
    handler: async (ctx, args) => {
        // Validate that the player is VIP
        await validateVipPlayer(ctx, args.playerId, args.sessionToken);

        const game = await ctx.db.get(args.gameId);
        if (!game) return;

        // Depending on Round Number, pick Phase
        const targetRound = game.currentRound + 1;

        if (targetRound === 3) {
            console.log("[GAME] Starting Phase 3: The Gauntlet");
            // 1. Resolve Phase 2 Eliminations (Needs OLD prompts to determine pairings)
            await resolvePhase2(ctx, args.gameId);
        }

        await ctx.db.patch(args.gameId, { currentRound: targetRound });

        // Reset all winStreaks at round boundaries
        const allPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        for (const player of allPlayers) {
            if (player.winStreak && player.winStreak > 0) {
                console.log(`[ROUND RESET] Resetting ${player.name}'s winStreak from ${player.winStreak} to 0`);
                await ctx.db.patch(player._id, { winStreak: 0 });
            }
        }

        // Clean old data 
        const oldPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        for (const p of oldPrompts) await ctx.db.delete(p._id);

        const players = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        if (targetRound === 2) {
            console.log("[GAME] Starting Phase 2: The Cull");
            await setupPhase2(ctx, args.gameId, players);

            // Check if any matchups were actually created (It's possible everyone has a Bye)
            const promptsAfterSetup = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
            if (promptsAfterSetup.length === 0) {
                console.log("[GAME] Round 2 Auto-Pass: No matchups needed (All survivors have Byes). Advancing to Results.");
                await ctx.db.patch(args.gameId, {
                    status: "ROUND_RESULTS", // Go straight to results so Host sees recap/next button
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                return; // Exit here, do not set status to PROMPTS below
            }
        } else if (targetRound === 3) {
            // 2. Refetch players to get updated KO status
            const updatedPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

            // 3. Setup Phase 3
            await setupPhase3(ctx, args.gameId, updatedPlayers);
        } else if (targetRound === 4) {
            const updatedPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
            await setupPhase4(ctx, args.gameId, updatedPlayers);
        } else {
            // Default back to Phase 1 setup (or Final Showdown TBD)
            console.log(`[GAME] Starting Round ${targetRound} (Default Setup)`);
            await setupPhase1(ctx, args.gameId, players);
        }

        // Check if we can auto-advance to VOTING (e.g. if all active players are bots who auto-answered)
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const totalExpected = allPrompts.length * 2; // Assuming 2 players per pair

        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived > 0 && totalReceived >= totalExpected) {
            console.log(`[GAME] Round ${targetRound} Auto-Advance: All answers received (Bots). Starting VOTING.`);
            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: allPrompts[0]._id,
                roundStatus: "VOTING"
            });
            // Trigger Bot Votes for the first prompt
            const delay = 300 + Math.random() * 400;
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: allPrompts[0]._id });
        } else {
            console.log(`[GAME] Round ${targetRound} Starting: Waiting for answers.`);
            await ctx.db.patch(args.gameId, {
                status: "PROMPTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });

            // Schedule bots to send suggestions to their human captains
            const suggestionDelay = 500 + Math.random() * 500;
            await ctx.scheduler.runAfter(suggestionDelay, api.bots.sendSuggestions, { gameId: args.gameId });
        }
    }
});
