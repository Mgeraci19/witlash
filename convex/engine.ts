import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { setupPhase1, setupPhase2, setupPhase3, setupPhase4, resolvePhase2, createSuddenDeathPrompt } from "./lib/phases";
import { api } from "./_generated/api";
import { validateVipPlayer } from "./lib/auth";

// Helper function to ensure HP is always a valid number
function sanitizeHP(hp: number | undefined | null): number {
    if (hp === undefined || hp === null || isNaN(hp)) {
        console.warn(`[GAME] Invalid HP detected: ${hp}, returning 100`);
        return 100;
    }
    return Math.max(0, Math.floor(hp));
}


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

        // Damage Calculation
        if (game.currentPromptId) {
            const votes = await ctx.db.query("votes").withIndex("by_prompt", q => q.eq("promptId", game.currentPromptId!)).collect();
            const submissions = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", game.currentPromptId!)).collect();

            const totalVotes = votes.length;
            const DAMAGE_CAP = 35;

            // Safety check: If no votes were cast, skip damage calculation
            if (totalVotes === 0) {
                console.warn(`[GAME] No votes cast for prompt ${game.currentPromptId}. Skipping damage calculation.`);
                // Still need to update players to avoid stale state, but with 0 damage
                for (const sub of submissions) {
                    const player = await ctx.db.get(sub.playerId);
                    if (player) {
                        const currentHp = sanitizeHP(player.hp);
                        console.log(`[GAME] ${player.name}: HP unchanged at ${currentHp} (no votes)`);
                        await ctx.db.patch(player._id, { hp: currentHp, knockedOut: false });
                    }
                }
            } else {
                // Normal damage calculation when votes exist
                // Sort by votes (Ascending = Loser first)
                // We need to map submissions to vote counts first to sort securely
                const subsWithVotes = submissions.map(sub => {
                    const votesFor = votes.filter(v => v.submissionId === sub._id).length;
                    return { sub, votesFor };
                });

                subsWithVotes.sort((a, b) => a.votesFor - b.votesFor);

                let opponentDied = false;

                for (const { sub, votesFor } of subsWithVotes) {
                    const votesAgainst = totalVotes - votesFor;
                    let damage = 0;

                    // If the opponent already died this round, you take NO damage (they can't hit back)
                    if (opponentDied) {
                        damage = 0;
                    } else {
                        damage = (votesAgainst / totalVotes) * DAMAGE_CAP;
                        // Round 4 (Showdown) Multiplier
                        if (game.currentRound === 4) {
                            damage *= 1.5;
                        }
                    }

                    const player = await ctx.db.get(sub.playerId);
                    if (player) {
                        const currentHp = sanitizeHP(player.hp);
                        const newHp = Math.max(0, Math.floor(currentHp - damage));
                        const knockedOut = newHp === 0;

                        console.log(`[GAME] ${player.name}: ${currentHp} HP - ${Math.floor(damage)} damage = ${newHp} HP (${votesFor}/${totalVotes} votes)`);

                        if (knockedOut) {
                            opponentDied = true; // Mark that someone died
                            const opponentSub = submissions.find(s => s.playerId !== player._id);

                            // Corner Man Assignment for Rounds 1 and 2
                            // Round 1: KO creates team, winner gets Round 2 bye
                            // Round 2: Pairs up remaining players into teams
                            // Round 3+: No team assignment
                            if (opponentSub && (game.currentRound === 1 || game.currentRound === 2)) {
                                const winnerId = opponentSub.playerId;

                                // Check if winner already has a corner man (shouldn't happen if bye logic works)
                                const existingCornerMen = await ctx.db.query("players")
                                    .withIndex("by_game", q => q.eq("gameId", args.gameId))
                                    .filter(q => q.eq(q.field("teamId"), winnerId) && q.eq(q.field("role"), "CORNER_MAN"))
                                    .collect();

                                if (existingCornerMen.length >= 1) {
                                    // This shouldn't happen - captains should have byes in R2
                                    console.warn(`[GAME] WARNING: ${player.name} lost to ${winnerId} who already has ${existingCornerMen.length} corner men! This violates bye logic. Assigning anyway as second corner man.`);
                                    await ctx.db.patch(player._id, { role: "CORNER_MAN", teamId: winnerId, hp: newHp, knockedOut });
                                } else {
                                    console.log(`[GAME] Round ${game.currentRound}: ${player.name} KO'd! Assigning as Corner Man for ${winnerId}`);
                                    await ctx.db.patch(player._id, { role: "CORNER_MAN", teamId: winnerId, hp: newHp, knockedOut });
                                }
                            } else {
                                console.log(`[GAME] Player ${player.name} KO'd in Round ${game.currentRound}!`);
                                await ctx.db.patch(player._id, { hp: newHp, knockedOut });
                            }
                        } else {
                            await ctx.db.patch(player._id, { hp: newHp, knockedOut });
                        }
                    }
                }
            }
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

        // Check for Round 3 Early Exit (Top 2 Teams)
        if (game.currentRound === 3) {
            const activePlayers = await ctx.db.query("players").withIndex("by_game", (q) => q.eq("gameId", args.gameId)).collect();
            const survivorCount = activePlayers.filter((p) => !p.knockedOut).length;

            if (survivorCount <= 2) {
                console.log(`[GAME] Round 3 Early Exit: Only ${survivorCount} participants remain.`);
                await ctx.db.patch(args.gameId, {
                    status: "ROUND_RESULTS",
                    currentPromptId: undefined,
                    roundStatus: undefined
                });
                // Cleanup prompts now or let nextRound do it
                return;
            }
        }

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
