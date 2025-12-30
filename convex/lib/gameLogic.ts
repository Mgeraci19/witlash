import { MutationCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { api } from "../_generated/api";

// Helper function to ensure HP is always a valid number
export function sanitizeHP(hp: number | undefined | null): number {
    if (hp === undefined || hp === null || isNaN(hp)) {
        console.warn(`[GAME] Invalid HP detected: ${hp}, returning 100`);
        return 100;
    }
    return Math.max(0, Math.floor(hp));
}

export async function resolveBattle(
    ctx: MutationCtx,
    gameId: Id<"games">,
    promptId: Id<"prompts">,
    currentRound: number
) {
    const votes = await ctx.db.query("votes").withIndex("by_prompt", q => q.eq("promptId", promptId)).collect();
    const submissions = await ctx.db.query("submissions").withIndex("by_prompt", q => q.eq("promptId", promptId)).collect();

    const totalVotes = votes.length;
    const DAMAGE_CAP = 35;
    const COMBO_BONUS_DAMAGE = 15; // Bonus damage for 2-win combo

    // Round multipliers for damage scaling
    const getRoundMultiplier = (round: number): number => {
        switch (round) {
            case 1: return 1.0;   // 35 max damage
            case 2: return 1.3;   // 45.5 max damage (harder to survive)
            case 3: return 1.0;   // 35 max damage
            case 4: return 1.5;   // 52.5 max damage (sudden death)
            default: return 1.0;
        }
    };

    // Safety check: If no votes were cast, skip damage calculation
    if (totalVotes === 0) {
        console.warn(`[GAME] No votes cast for prompt ${promptId}. Skipping damage calculation.`);
        // Still need to update players to avoid stale state, but with 0 damage
        for (const sub of submissions) {
            const player = await ctx.db.get(sub.playerId);
            if (player) {
                const currentHp = sanitizeHP(player.hp);
                console.log(`[GAME] ${player.name}: HP unchanged at ${currentHp} (no votes)`);
                await ctx.db.patch(player._id, { hp: currentHp, knockedOut: false });
            }
        }
        return;
    }

    // Normal damage calculation when votes exist
    // Map submissions to vote counts and player data
    const subsWithVotes = await Promise.all(submissions.map(async sub => {
        const votesFor = votes.filter(v => v.submissionId === sub._id).length;
        const player = await ctx.db.get(sub.playerId);
        return { sub, votesFor, player };
    }));

    // Check for tie scenario (both have same votes)
    const isTie = subsWithVotes.length === 2 &&
        subsWithVotes[0].votesFor === subsWithVotes[1].votesFor;

    if (isTie) {
        // In a tie, both take equal damage (50% of DAMAGE_CAP)
        console.log("[TIE BATTLE] Both players received equal votes");
        const tieDamage = 0.5 * DAMAGE_CAP * getRoundMultiplier(currentRound);

        // Calculate if both would be KO'd
        const results = subsWithVotes.map(({ sub, player }) => {
            const currentHp = sanitizeHP(player?.hp);
            const newHp = Math.max(0, Math.floor(currentHp - tieDamage));
            return { sub, player, currentHp, newHp, wouldKO: newHp === 0 };
        });

        const [r1, r2] = results;
        const bothKO = results.every(r => r.wouldKO);
        const singleKO = results.some(r => r.wouldKO) && !bothKO;

        // Determine faster submission for tiebreaker
        const r1WasFaster = r1.sub._creationTime < r2.sub._creationTime;

        if (bothKO) {
            // DOUBLE KO TIE - Faster submission gets winStreak increment
            const winner = r1WasFaster ? r1 : r2;
            const loser = r1WasFaster ? r2 : r1;
            console.log(`[GAME] DOUBLE KO TIE! Faster submission wins: ${winner.player?.name} submitted first`);

            // Winner takes damage but survives with 1 HP and gets winStreak increment
            if (winner.player) {
                const currentStreak = winner.player.winStreak || 0;
                const newStreak = currentStreak + 1;
                await ctx.db.patch(winner.player._id, { hp: 1, knockedOut: false, winStreak: newStreak });
                console.log(`[GAME] ${winner.player.name}: survives with 1 HP, winStreak: ${currentStreak} → ${newStreak}`);
                if (newStreak === 2) {
                    console.log(`[COMBO WARNING] ${winner.player.name} is on a 2-win streak! Next win = INSTANT KO!`);
                }
            }

            // Loser gets KO'd and winStreak resets
            if (loser.player) {
                const opponentSub = submissions.find(s => s.playerId !== loser.player!._id);
                if (opponentSub && (currentRound === 1 || currentRound === 2)) {
                    const winnerId = opponentSub.playerId;
                    console.log(`[GAME] Round ${currentRound}: ${loser.player.name} KO'd! Assigning as Corner Man for ${winnerId}`);
                    await ctx.db.patch(loser.player._id, { role: "CORNER_MAN", teamId: winnerId, hp: 0, knockedOut: true, winStreak: 0 });
                } else {
                    console.log(`[GAME] Player ${loser.player.name} KO'd in Round ${currentRound}!`);
                    await ctx.db.patch(loser.player._id, { hp: 0, knockedOut: true, winStreak: 0 });
                }
                console.log(`[GAME] ${loser.player.name}: KO'd, winStreak reset to 0`);
            }
        } else if (singleKO) {
            // Single KO: survivor gets winStreak increment, KO'd resets
            const survivor = r1.wouldKO ? r2 : r1;
            const knocked = r1.wouldKO ? r1 : r2;
            console.log(`[GAME] SINGLE KO TIE! ${survivor.player?.name} survives, ${knocked.player?.name} KO'd`);

            // Survivor gets winStreak increment
            if (survivor.player) {
                const currentStreak = survivor.player.winStreak || 0;
                const newStreak = currentStreak + 1;
                await ctx.db.patch(survivor.player._id, { hp: survivor.newHp, knockedOut: false, winStreak: newStreak });
                console.log(`[GAME] ${survivor.player.name}: ${survivor.currentHp} HP - ${Math.floor(tieDamage)} damage = ${survivor.newHp} HP, winStreak: ${currentStreak} → ${newStreak}`);
                if (newStreak === 2) {
                    console.log(`[COMBO WARNING] ${survivor.player.name} is on a 2-win streak! Next win = INSTANT KO!`);
                }
            }

            // Knocked out player resets winStreak
            if (knocked.player) {
                const opponentSub = submissions.find(s => s.playerId !== knocked.player!._id);
                if (opponentSub && (currentRound === 1 || currentRound === 2)) {
                    const winnerId = opponentSub.playerId;
                    console.log(`[GAME] Round ${currentRound}: ${knocked.player.name} KO'd! Assigning as Corner Man for ${winnerId}`);
                    await ctx.db.patch(knocked.player._id, { role: "CORNER_MAN", teamId: winnerId, hp: 0, knockedOut: true, winStreak: 0 });
                } else {
                    console.log(`[GAME] Player ${knocked.player.name} KO'd in Round ${currentRound}!`);
                    await ctx.db.patch(knocked.player._id, { hp: 0, knockedOut: true, winStreak: 0 });
                }
                console.log(`[GAME] ${knocked.player.name}: KO'd, winStreak reset to 0`);
            }
        } else {
            // Normal tie (both survive) - both winStreaks reset to 0
            console.log("[GAME] NORMAL TIE - Both survive, both combos reset");
            for (const r of results) {
                if (r.player) {
                    console.log(`[GAME] TIE: ${r.player.name}: ${r.currentHp} HP - ${Math.floor(tieDamage)} damage = ${r.newHp} HP, winStreak reset to 0`);
                    await ctx.db.patch(r.player._id, { hp: r.newHp, knockedOut: false, winStreak: 0 });
                }
            }
        }
    } else {
        // Non-tie: Only the loser takes damage
        // Sort by votes (Ascending = Loser first)
        subsWithVotes.sort((a, b) => a.votesFor - b.votesFor);

        const loser = subsWithVotes[0];
        const winner = subsWithVotes[1];

        // Get winner's current win streak for combo bonuses
        const winnerStreak = winner.player?.winStreak || 0;
        const newWinnerStreak = winnerStreak + 1;

        // Calculate base damage for loser based on vote proportions
        const votesAgainst = totalVotes - loser.votesFor;
        let damage = (votesAgainst / totalVotes) * DAMAGE_CAP * getRoundMultiplier(currentRound);

        // Apply combo bonuses BEFORE taking damage
        if (winnerStreak === 2) {
            // 3rd win in a row = instant KO (works in ALL rounds)
            damage = 999; // Ensure KO regardless of HP
            console.log(`[COMBO x3 INSTANT KO!] ${winner.player?.name} gets instant KO on ${loser.player?.name}`);
        } else if (winnerStreak === 1) {
            // 2nd win in a row = bonus damage
            damage += COMBO_BONUS_DAMAGE;
            console.log(`[COMBO x2 BONUS!] ${winner.player?.name} deals +${COMBO_BONUS_DAMAGE} bonus damage`);
        }

        // Apply damage to loser
        if (loser.player) {
            const currentHp = sanitizeHP(loser.player.hp);
            const newHp = Math.max(0, Math.floor(currentHp - damage));
            const knockedOut = newHp === 0;

            console.log(`[GAME] ${loser.player.name}: ${currentHp} HP - ${Math.floor(damage)} damage = ${newHp} HP (${loser.votesFor}/${totalVotes} votes, winStreak reset to 0)`);

            if (knockedOut) {
                const opponentSub = submissions.find(s => s.playerId !== loser.player!._id);

                // Corner Man Assignment for Rounds 1 and 2
                if (opponentSub && (currentRound === 1 || currentRound === 2)) {
                    const winnerId = opponentSub.playerId;

                    const existingCornerMen = await ctx.db.query("players")
                        .withIndex("by_game", q => q.eq("gameId", gameId))
                        .filter(q => q.eq(q.field("teamId"), winnerId) && q.eq(q.field("role"), "CORNER_MAN"))
                        .collect();

                    if (existingCornerMen.length >= 1) {
                        console.warn(`[GAME] WARNING: ${loser.player.name} lost to ${winnerId} who already has ${existingCornerMen.length} corner men! This violates bye logic. Assigning anyway as second corner man.`);
                        await ctx.db.patch(loser.player._id, { role: "CORNER_MAN", teamId: winnerId, hp: newHp, knockedOut, winStreak: 0 });
                        console.log(`[CORNER MAN ASSIGNED] ${loser.player.name} (ID: ${loser.player._id}) → Supporting ${winnerId}`);
                    } else {
                        console.log(`[GAME] Round ${currentRound}: ${loser.player.name} KO'd! Assigning as Corner Man for ${winnerId}`);
                        await ctx.db.patch(loser.player._id, { role: "CORNER_MAN", teamId: winnerId, hp: newHp, knockedOut, winStreak: 0 });
                        console.log(`[CORNER MAN ASSIGNED] ${loser.player.name} (ID: ${loser.player._id}) → Supporting ${winnerId}`);
                    }
                } else {
                    console.log(`[GAME] Player ${loser.player.name} KO'd in Round ${currentRound}!`);
                    await ctx.db.patch(loser.player._id, { hp: newHp, knockedOut, winStreak: 0 });
                }
            } else {
                // Not KO'd - update HP and reset winStreak
                await ctx.db.patch(loser.player._id, { hp: newHp, knockedOut, winStreak: 0 });
            }
        }

        // Winner takes no damage - increment winStreak
        if (winner.player) {
            const currentHp = sanitizeHP(winner.player.hp);
            console.log(`[GAME] ${winner.player.name}: ${currentHp} HP (WINNER - no damage, ${winner.votesFor}/${totalVotes} votes, winStreak: ${winnerStreak} → ${newWinnerStreak})`);
            await ctx.db.patch(winner.player._id, { hp: currentHp, knockedOut: false, winStreak: newWinnerStreak });
            if (newWinnerStreak === 2) {
                console.log(`[COMBO WARNING] ${winner.player.name} is on a 2-win streak! Next win = INSTANT KO!`);
            }
        }
    }
}
