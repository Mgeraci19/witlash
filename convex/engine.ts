import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
    setupMainRound,
    setupSemiFinals,
    setupFinal,
    performTheCut,
    createFinalPrompt
} from "./lib/phases";
import { resolveBattle } from "./lib/gameLogic";
import { api } from "./_generated/api";
import { validateVipPlayer } from "./lib/auth";
import { getBotDelay, isBotOnlyBattle } from "./lib/constants";

/**
 * NEW GAME FLOW (3 Rounds):
 *
 * Round 1: MAIN ROUND
 * - 5 prompts per matchup
 * - Special bar mechanic
 * - Losers become corner men
 *
 * THE CUT (transition to Round 2):
 * - Top 4 by HP advance
 * - Others assigned as corner men
 *
 * Round 2: SEMI-FINALS
 * - 4 prompts per match (3 jabs + 1 haymaker)
 * - 2 semi-final matches
 * - Winners advance to Final
 *
 * Round 3: FINAL
 * - 200 HP each
 * - Infinite prompts until KO
 * - Attack type selection
 */

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

        // Check for game end conditions
        const playersAfterBattle = await ctx.db.query("players")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();
        const activeFighters = playersAfterBattle.filter(
            p => p.role === "FIGHTER" && !p.knockedOut
        );

        // Game ends if only 1 (or 0) fighters remain
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
            const cleanupDelay = 60 * 60 * 1000; // 1 Hour
            await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
            return;
        }

        // Round 3 (Final): Check for winner
        if (game.currentRound === 3) {
            const survivors = playersAfterBattle.filter(p => !p.knockedOut && p.role === "FIGHTER");
            if (survivors.length === 1) {
                console.log(`[FINAL] Winner: ${survivors[0].name}!`);
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                const cleanupDelay = 60 * 60 * 1000;
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
                return;
            }
        }

        // Find next prompt
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const currentIndex = allPrompts.findIndex(p => p._id === game.currentPromptId);

        // Refresh players for KO check
        const currentPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const knockedOutIds = new Set(currentPlayers.filter(p => p.knockedOut).map(p => p._id));

        let nextPromptId = null;

        // Find next prompt where no assigned player is knocked out
        // EXCEPT in Semi-Finals (Round 2), allow the 4th prompt of a matchup to play as "bragging round"
        for (let i = currentIndex + 1; i < allPrompts.length; i++) {
            const p = allPrompts[i];
            const assignedIds = p.assignedTo || [];
            const isMatchupDead = assignedIds.some(id => knockedOutIds.has(id));

            if (!isMatchupDead) {
                nextPromptId = p._id;
                break;
            } else if (game.currentRound === 2) {
                // In Semi-Finals, check if this is the 4th (final) prompt for this matchup
                // by counting how many prompts have the same assignedTo before this one
                const sameMatchupPrompts = allPrompts.filter(op =>
                    op.assignedTo &&
                    op.assignedTo.length === 2 &&
                    assignedIds.length === 2 &&
                    op.assignedTo[0] === assignedIds[0] &&
                    op.assignedTo[1] === assignedIds[1]
                );
                const promptIndexInMatchup = sameMatchupPrompts.findIndex(op => op._id === p._id);

                // If this is the 4th prompt (index 3) of the matchup, play it as bragging round
                if (promptIndexInMatchup === 3) {
                    console.log(`[SEMI-FINALS] Playing prompt 4 as BRAGGING ROUND for ${p._id}`);
                    nextPromptId = p._id;
                    break;
                } else {
                    console.log(`[GAME] Skipping prompt ${p._id} because a player is knocked out.`);
                }
            } else {
                console.log(`[GAME] Skipping prompt ${p._id} because a player is knocked out.`);
            }
        }

        if (nextPromptId) {
            await ctx.db.patch(args.gameId, {
                currentPromptId: nextPromptId,
                roundStatus: "VOTING"
            });
            // Bot voting - check if it's a bot-only battle for instant simulation
            const nextPrompt = allPrompts.find(p => p._id === nextPromptId);
            const botOnlyBattle = isBotOnlyBattle(nextPrompt?.assignedTo, currentPlayers);
            const delay = getBotDelay("VOTE", botOnlyBattle);
            console.log(`[NEXT BATTLE] Scheduling bot votes with delay ${delay}ms (botOnly: ${botOnlyBattle})`);
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: nextPromptId });
        } else {
            // No more prompts in this round
            if (game.currentRound === 3) {
                // Final: Create new sudden death prompt if both survive
                const survivors = currentPlayers.filter(p => !p.knockedOut && p.role === "FIGHTER");
                if (survivors.length === 2) {
                    console.log(`[FINAL] Both finalists survived, creating new prompt...`);
                    await createFinalPrompt(ctx, args.gameId, survivors[0], survivors[1], currentPlayers);
                    return;
                }
            }

            // End of Round - transition to ROUND_RESULTS
            const maxRounds = game.maxRounds || 3;
            if (game.currentRound < maxRounds) {
                await ctx.db.patch(args.gameId, {
                    status: "ROUND_RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
            } else {
                // Game Over
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                const cleanupDelay = 60 * 60 * 1000;
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

        const targetRound = game.currentRound + 1;
        console.log(`[NEXT ROUND] Transitioning from Round ${game.currentRound} to Round ${targetRound}`);

        // Clean old prompts
        const oldPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        for (const p of oldPrompts) await ctx.db.delete(p._id);

        // Get all players
        const players = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        // Reset win streaks and special bars at round boundaries (except for Final entry)
        for (const player of players) {
            if (player.role === "FIGHTER" && !player.knockedOut) {
                await ctx.db.patch(player._id, { winStreak: 0 });
                // Special bar is reset in performTheCut and setupFinal
            }
        }

        // Update current round
        await ctx.db.patch(args.gameId, { currentRound: targetRound });

        if (targetRound === 2) {
            // Transition: Main Round → Semi-Finals
            console.log(`[GAME] Performing The Cut...`);

            // Perform The Cut (determine semi-finalists, assign corner men)
            const { semifinalists } = await performTheCut(ctx, args.gameId);

            if (semifinalists.length < 2) {
                console.log(`[GAME] Not enough semifinalists, ending game`);
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                const cleanupDelay = 60 * 60 * 1000;
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
                return;
            }

            // Setup Semi-Finals
            console.log(`[GAME] Setting up Semi-Finals with ${semifinalists.length} fighters`);
            await setupSemiFinals(ctx, args.gameId, semifinalists);

        } else if (targetRound === 3) {
            // Transition: Semi-Finals → Final
            console.log(`[GAME] Setting up Final Showdown`);

            // Get remaining fighters (semi-final winners)
            const updatedPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
            const finalists = updatedPlayers.filter(p => p.role === "FIGHTER" && !p.knockedOut);

            if (finalists.length !== 2) {
                console.error(`[GAME] Expected 2 finalists, got ${finalists.length}`);
                // Take top 2 by HP
                finalists.sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0));
            }

            await setupFinal(ctx, args.gameId, finalists.slice(0, 2));

        } else {
            // Round 1 or fallback: Main Round setup
            console.log(`[GAME] Starting Round ${targetRound} (Main Round)`);
            await setupMainRound(ctx, args.gameId, players);
        }

        // Check if we can auto-advance to VOTING (all bots answered)
        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        if (allPrompts.length === 0) {
            console.log(`[GAME] No prompts created, advancing to Round Results`);
            await ctx.db.patch(args.gameId, {
                status: "ROUND_RESULTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });
            return;
        }

        const totalExpected = allPrompts.length * 2;
        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived > 0 && totalReceived >= totalExpected) {
            console.log(`[GAME] Round ${targetRound} Auto-Advance: All answers received. Starting VOTING.`);
            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: allPrompts[0]._id,
                roundStatus: "VOTING"
            });
            // Check if first prompt is bot-only for instant simulation
            const firstPromptBotOnly = isBotOnlyBattle(allPrompts[0].assignedTo, players);
            const delay = getBotDelay("VOTE", firstPromptBotOnly);
            console.log(`[GAME] Scheduling bot votes with delay ${delay}ms (botOnly: ${firstPromptBotOnly})`);
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: allPrompts[0]._id });
        } else {
            console.log(`[GAME] Round ${targetRound} Starting: Waiting for answers.`);
            await ctx.db.patch(args.gameId, {
                status: "PROMPTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });

            // Schedule bots to send suggestions (use normal delay for suggestions)
            const suggestionDelay = getBotDelay("SUGGESTION", false);
            await ctx.scheduler.runAfter(suggestionDelay, api.bots.sendSuggestions, { gameId: args.gameId });
        }
    }
});

// Host-triggered mutations for auto-advance (validates hostToken instead of VIP)
export const hostTriggerNextBattle = mutation({
    args: {
        gameId: v.id("games"),
        hostToken: v.string()
    },
    handler: async (ctx, args) => {
        const game = await ctx.db.get(args.gameId);
        if (!game || game.hostToken !== args.hostToken) {
            throw new Error("Invalid host token");
        }

        // Only proceed if still in REVEAL state
        if (game.status !== "VOTING" || game.roundStatus !== "REVEAL") {
            console.log("[AUTO-ADVANCE] Skipping nextBattle - state already changed");
            return;
        }

        console.log(`[AUTO-ADVANCE] Host triggered nextBattle for round ${game.currentRound}`);

        // Same logic as nextBattle
        if (game.currentPromptId) {
            await resolveBattle(ctx, args.gameId, game.currentPromptId, game.currentRound);
        }

        const playersAfterBattle = await ctx.db.query("players")
            .withIndex("by_game", q => q.eq("gameId", args.gameId))
            .collect();
        const activeFighters = playersAfterBattle.filter(
            p => p.role === "FIGHTER" && !p.knockedOut
        );

        if (activeFighters.length <= 1) {
            if (activeFighters.length === 1) {
                console.log(`[GAME] Winner: ${activeFighters[0].name}!`);
            }
            await ctx.db.patch(args.gameId, {
                status: "RESULTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });
            const cleanupDelay = 60 * 60 * 1000;
            await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
            return;
        }

        if (game.currentRound === 3) {
            const survivors = playersAfterBattle.filter(p => !p.knockedOut && p.role === "FIGHTER");
            if (survivors.length === 1) {
                console.log(`[FINAL] Winner: ${survivors[0].name}!`);
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                const cleanupDelay = 60 * 60 * 1000;
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
                return;
            }
        }

        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const currentIndex = allPrompts.findIndex(p => p._id === game.currentPromptId);

        const currentPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        const knockedOutIds = new Set(currentPlayers.filter(p => p.knockedOut).map(p => p._id));

        let nextPromptId = null;

        // Find next prompt where no assigned player is knocked out
        // EXCEPT in Semi-Finals (Round 2), allow the 4th prompt of a matchup to play as "bragging round"
        for (let i = currentIndex + 1; i < allPrompts.length; i++) {
            const p = allPrompts[i];
            const assignedIds = p.assignedTo || [];
            const isMatchupDead = assignedIds.some(id => knockedOutIds.has(id));

            if (!isMatchupDead) {
                nextPromptId = p._id;
                break;
            } else if (game.currentRound === 2) {
                // In Semi-Finals, check if this is the 4th (final) prompt for this matchup
                const sameMatchupPrompts = allPrompts.filter(op =>
                    op.assignedTo &&
                    op.assignedTo.length === 2 &&
                    assignedIds.length === 2 &&
                    op.assignedTo[0] === assignedIds[0] &&
                    op.assignedTo[1] === assignedIds[1]
                );
                const promptIndexInMatchup = sameMatchupPrompts.findIndex(op => op._id === p._id);

                // If this is the 4th prompt (index 3) of the matchup, play it as bragging round
                if (promptIndexInMatchup === 3) {
                    console.log(`[SEMI-FINALS] Host auto-advance: Playing prompt 4 as BRAGGING ROUND for ${p._id}`);
                    nextPromptId = p._id;
                    break;
                } else {
                    console.log(`[HOST AUTO-ADVANCE] Skipping prompt ${p._id} because a player is knocked out.`);
                }
            } else {
                console.log(`[HOST AUTO-ADVANCE] Skipping prompt ${p._id} because a player is knocked out.`);
            }
        }

        if (nextPromptId) {
            await ctx.db.patch(args.gameId, {
                currentPromptId: nextPromptId,
                roundStatus: "VOTING"
            });
            // Check if next prompt is bot-only for instant simulation
            const nextPrompt = allPrompts.find(p => p._id === nextPromptId);
            const botOnlyBattle = isBotOnlyBattle(nextPrompt?.assignedTo, currentPlayers);
            const delay = getBotDelay("VOTE", botOnlyBattle);
            console.log(`[HOST AUTO-ADVANCE] Scheduling bot votes with delay ${delay}ms (botOnly: ${botOnlyBattle})`);
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: nextPromptId });
        } else {
            if (game.currentRound === 3) {
                const survivors = currentPlayers.filter(p => !p.knockedOut && p.role === "FIGHTER");
                if (survivors.length === 2) {
                    console.log(`[FINAL] Both finalists survived, creating new prompt...`);
                    await createFinalPrompt(ctx, args.gameId, survivors[0], survivors[1], currentPlayers);
                    return;
                }
            }

            const maxRounds = game.maxRounds || 3;
            if (game.currentRound < maxRounds) {
                await ctx.db.patch(args.gameId, {
                    status: "ROUND_RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
            } else {
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                const cleanupDelay = 60 * 60 * 1000;
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
            }
        }
    }
});

export const hostTriggerNextRound = mutation({
    args: {
        gameId: v.id("games"),
        hostToken: v.string()
    },
    handler: async (ctx, args) => {
        const game = await ctx.db.get(args.gameId);
        if (!game || game.hostToken !== args.hostToken) {
            throw new Error("Invalid host token");
        }

        // Only proceed if still in ROUND_RESULTS
        if (game.status !== "ROUND_RESULTS") {
            console.log("[AUTO-ADVANCE] Skipping nextRound - state already changed");
            return;
        }

        console.log(`[AUTO-ADVANCE] Host triggered nextRound from round ${game.currentRound}`);

        const targetRound = game.currentRound + 1;

        // Clean old prompts
        const oldPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
        for (const p of oldPrompts) await ctx.db.delete(p._id);

        const players = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        // Reset win streaks
        for (const player of players) {
            if (player.role === "FIGHTER" && !player.knockedOut) {
                await ctx.db.patch(player._id, { winStreak: 0 });
            }
        }

        await ctx.db.patch(args.gameId, { currentRound: targetRound });

        if (targetRound === 2) {
            console.log(`[GAME] Performing The Cut...`);
            const { semifinalists } = await performTheCut(ctx, args.gameId);

            if (semifinalists.length < 2) {
                await ctx.db.patch(args.gameId, {
                    status: "RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                const cleanupDelay = 60 * 60 * 1000;
                await ctx.scheduler.runAfter(cleanupDelay, api.admin.deleteGame, { gameId: args.gameId });
                return;
            }

            await setupSemiFinals(ctx, args.gameId, semifinalists);

        } else if (targetRound === 3) {
            const updatedPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();
            const finalists = updatedPlayers.filter(p => p.role === "FIGHTER" && !p.knockedOut);
            finalists.sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0));
            await setupFinal(ctx, args.gameId, finalists.slice(0, 2));

        } else {
            await setupMainRound(ctx, args.gameId, players);
        }

        const allPrompts = await ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        if (allPrompts.length === 0) {
            await ctx.db.patch(args.gameId, {
                status: "ROUND_RESULTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });
            return;
        }

        const totalExpected = allPrompts.length * 2;
        let totalReceived = 0;
        for (const prompt of allPrompts) {
            const subs = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", prompt._id)).collect();
            totalReceived += subs.length;
        }

        if (totalReceived > 0 && totalReceived >= totalExpected) {
            await ctx.db.patch(args.gameId, {
                status: "VOTING",
                currentPromptId: allPrompts[0]._id,
                roundStatus: "VOTING"
            });
            // Check if first prompt is bot-only for instant simulation
            const firstPromptBotOnly = isBotOnlyBattle(allPrompts[0].assignedTo, players);
            const delay = getBotDelay("VOTE", firstPromptBotOnly);
            console.log(`[HOST NEXT ROUND] Scheduling bot votes with delay ${delay}ms (botOnly: ${firstPromptBotOnly})`);
            await ctx.scheduler.runAfter(delay, api.bots.castVotes, { gameId: args.gameId, promptId: allPrompts[0]._id });
        } else {
            await ctx.db.patch(args.gameId, {
                status: "PROMPTS",
                currentPromptId: undefined,
                roundStatus: undefined
            });

            // Schedule bots to send suggestions (use normal delay for suggestions)
            const suggestionDelay = getBotDelay("SUGGESTION", false);
            await ctx.scheduler.runAfter(suggestionDelay, api.bots.sendSuggestions, { gameId: args.gameId });
        }
    }
});
