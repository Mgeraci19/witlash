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
    // Sort by votes (Ascending = Loser first)
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
            if (currentRound === 4) {
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
                if (opponentSub && (currentRound === 1 || currentRound === 2)) {
                    const winnerId = opponentSub.playerId;

                    // Check if winner already has a corner man (shouldn't happen if bye logic works)
                    const existingCornerMen = await ctx.db.query("players")
                        .withIndex("by_game", q => q.eq("gameId", gameId))
                        .filter(q => q.eq(q.field("teamId"), winnerId) && q.eq(q.field("role"), "CORNER_MAN"))
                        .collect();

                    if (existingCornerMen.length >= 1) {
                        // This shouldn't happen - captains should have byes in R2
                        console.warn(`[GAME] WARNING: ${player.name} lost to ${winnerId} who already has ${existingCornerMen.length} corner men! This violates bye logic. Assigning anyway as second corner man.`);
                        await ctx.db.patch(player._id, { role: "CORNER_MAN", teamId: winnerId, hp: newHp, knockedOut });
                    } else {
                        console.log(`[GAME] Round ${currentRound}: ${player.name} KO'd! Assigning as Corner Man for ${winnerId}`);
                        await ctx.db.patch(player._id, { role: "CORNER_MAN", teamId: winnerId, hp: newHp, knockedOut });
                    }
                } else {
                    console.log(`[GAME] Player ${player.name} KO'd in Round ${currentRound}!`);
                    await ctx.db.patch(player._id, { hp: newHp, knockedOut });
                }
            } else {
                await ctx.db.patch(player._id, { hp: newHp, knockedOut });
            }
        }
    }
}
