import { MutationCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Helper function to ensure HP is always a valid number
export function sanitizeHP(hp: number | undefined | null): number {
    if (hp === undefined || hp === null || isNaN(hp)) {
        console.warn(`[GAME] Invalid HP detected: ${hp}, returning 100`);
        return 100;
    }
    return Math.max(0, Math.floor(hp));
}

// Attack type multipliers for Final round
const ATTACK_MULTIPLIERS = {
    jab: { dealt: 1, received: 1 },
    haymaker: { dealt: 2, received: 2 },
    flyingKick: { dealt: 3, received: 4 }
} as const;

type AttackType = keyof typeof ATTACK_MULTIPLIERS;

/**
 * NEW GAME MECHANICS (3 Rounds):
 *
 * Round 1 (Main Round):
 * - 5 prompts per matchup
 * - Special bar: +1.0 per win, triggers at 3.0 = instant KO
 * - HP damage at 0.5x multiplier (for seeding only, can't kill)
 * - Once KO'd by special bar, loser can't deal damage
 * - Post-KO: Winner heals based on vote margin
 *
 * Round 2 (Semi-Finals):
 * - 4 prompts (3 jabs + 1 haymaker)
 * - Special bar: +1.0 per win, triggers at 3.0 = instant KO
 * - NO HP damage (HP carries through unchanged)
 * - Haymaker (prompt 4) is for bragging only if someone already won
 *
 * Round 3 (Final):
 * - 200 HP each, infinite prompts until KO
 * - Attack types: jab (1x/1x), haymaker (2x/2x), flyingKick (3x/4x)
 * - Loser takes HIGHER multiplier between winner's dealt and loser's received
 * - Special bar: 3 consecutive wins = auto KO (RESETS on non-win)
 */

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
        for (const sub of submissions) {
            const player = await ctx.db.get(sub.playerId);
            if (player) {
                const currentHp = sanitizeHP(player.hp);
                console.log(`[GAME] ${player.name}: HP unchanged at ${currentHp} (no votes)`);
            }
        }
        return;
    }

    // Map submissions to vote counts and player data
    const subsWithVotes = await Promise.all(submissions.map(async sub => {
        const votesFor = votes.filter(v => v.submissionId === sub._id).length;
        const player = await ctx.db.get(sub.playerId);
        return { sub, votesFor, player };
    }));

    // Sort by votes (Ascending = Loser first)
    subsWithVotes.sort((a, b) => a.votesFor - b.votesFor);

    // Check for tie scenario
    const isTie = subsWithVotes.length === 2 &&
        subsWithVotes[0].votesFor === subsWithVotes[1].votesFor;

    if (isTie) {
        await handleTie(ctx, gameId, subsWithVotes, currentRound, DAMAGE_CAP, submissions);
    } else {
        await handleNonTie(ctx, gameId, subsWithVotes, currentRound, DAMAGE_CAP, submissions, totalVotes);
    }
}

async function handleTie(
    ctx: MutationCtx,
    gameId: Id<"games">,
    subsWithVotes: Array<{ sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> | null }>,
    currentRound: number,
    DAMAGE_CAP: number,
    submissions: Doc<"submissions">[]
) {
    console.log(`[TIE BATTLE] Both players received equal votes - using speed tiebreaker`);

    // Speed tiebreaker: whoever submitted first wins
    // Sort by submittedAt (ascending = fastest first)
    const sortedBySpeed = [...subsWithVotes].sort((a, b) => {
        const aTime = a.sub.submittedAt ?? Infinity;
        const bTime = b.sub.submittedAt ?? Infinity;
        return aTime - bTime;
    });

    const winner = sortedBySpeed[0];
    const loser = sortedBySpeed[1];

    if (!winner?.player || !loser?.player) {
        console.error(`[TIE] Missing player data for speed tiebreaker`);
        return;
    }

    console.log(`[SPEED WIN] ${winner.player.name} submitted faster (${winner.sub.submittedAt}) vs ${loser.player.name} (${loser.sub.submittedAt})`);

    // Mark the winning submission as won by speed
    await ctx.db.patch(winner.sub._id, { wonBySpeed: true });

    // Get total votes for damage calculation (even though tied, we still need totalVotes)
    const totalVotes = subsWithVotes.reduce((sum, s) => sum + s.votesFor, 0);

    // Type guard: Ensure both players are non-null
    const winnerWithPlayer = { ...winner, player: winner.player! };
    const loserWithPlayer = { ...loser, player: loser.player! };

    // Route to appropriate round handler (same as non-tie)
    if (currentRound === 1) {
        await handleMainRound(ctx, gameId, winnerWithPlayer, loserWithPlayer, DAMAGE_CAP, totalVotes, submissions);
    } else if (currentRound === 2) {
        await handleSemiFinals(ctx, gameId, winnerWithPlayer, loserWithPlayer, submissions);
    } else if (currentRound === 3) {
        await handleFinal(ctx, gameId, winnerWithPlayer, loserWithPlayer, DAMAGE_CAP, totalVotes, submissions);
    } else {
        throw new Error(`[TIE] Invalid round number: ${currentRound}. Game only supports rounds 1-3.`);
    }
}

async function handleNonTie(
    ctx: MutationCtx,
    gameId: Id<"games">,
    subsWithVotes: Array<{ sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> | null }>,
    currentRound: number,
    DAMAGE_CAP: number,
    submissions: Doc<"submissions">[],
    totalVotes: number
) {
    const loser = subsWithVotes[0];
    const winner = subsWithVotes[1];

    if (!winner.player || !loser.player) {
        console.error(`[GAME] Missing player data for battle resolution`);
        return;
    }

    console.log(`[BATTLE] ${winner.player.name} (${winner.votesFor} votes) beats ${loser.player.name} (${loser.votesFor} votes)`);

    // Check if loser is already KO'd (post-KO prompts)
    if (loser.player.knockedOut) {
        console.log(`[POST-KO] ${loser.player.name} already KO'd, processing healing for winner`);
        // Type guard for winner.player
        const winnerWithPlayer = { ...winner, player: winner.player! };
        await handlePostKOHealing(ctx, winnerWithPlayer, loser, currentRound, DAMAGE_CAP, totalVotes);
        return;
    }

    // Type guard: Ensure both players are non-null
    const winnerWithPlayer = { ...winner, player: winner.player! };
    const loserWithPlayer = { ...loser, player: loser.player! };

    // Route to appropriate round handler
    if (currentRound === 1) {
        await handleMainRound(ctx, gameId, winnerWithPlayer, loserWithPlayer, DAMAGE_CAP, totalVotes, submissions);
    } else if (currentRound === 2) {
        await handleSemiFinals(ctx, gameId, winnerWithPlayer, loserWithPlayer, submissions);
    } else if (currentRound === 3) {
        await handleFinal(ctx, gameId, winnerWithPlayer, loserWithPlayer, DAMAGE_CAP, totalVotes, submissions);
    } else {
        throw new Error(`[GAME] Invalid round number: ${currentRound}. Game only supports rounds 1-3.`);
    }
}

/**
 * MAIN ROUND (Round 1):
 * - Special bar: +1.0 per win, triggers at 3.0 = instant KO
 * - HP damage at 0.5x (for seeding, can't kill)
 * - Loser becomes corner man on KO
 */
async function handleMainRound(
    ctx: MutationCtx,
    _gameId: Id<"games">,
    winner: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    loser: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    DAMAGE_CAP: number,
    totalVotes: number,
    _submissions: Doc<"submissions">[]
) {
    const MAIN_ROUND_MULTIPLIER = 0.5;
    const SPECIAL_BAR_PER_WIN = 1.0;
    const SPECIAL_BAR_TRIGGER = 3.0;

    // Update winner's special bar
    const winnerCurrentBar = winner.player.specialBar || 0;
    const newWinnerBar = winnerCurrentBar + SPECIAL_BAR_PER_WIN;

    console.log(`[MAIN ROUND] ${winner.player.name}: Special bar ${winnerCurrentBar} → ${newWinnerBar}`);

    // Check if special triggers
    if (newWinnerBar >= SPECIAL_BAR_TRIGGER) {
        console.log(`[SPECIAL KO!] ${winner.player.name} triggers special bar at ${newWinnerBar}!`);

        // Winner: Update special bar
        await ctx.db.patch(winner.player._id, {
            specialBar: newWinnerBar,
            winStreak: (winner.player.winStreak || 0) + 1
        });

        // Loser: KO'd, becomes corner man
        await ctx.db.patch(loser.player._id, {
            hp: 0,
            knockedOut: true,
            role: "CORNER_MAN",
            teamId: winner.player._id,
            becameCornerManInRound: 1,
            specialBar: loser.player.specialBar || 0 // Keep their bar
        });

        console.log(`[CORNER MAN] ${loser.player.name} → Supporting ${winner.player.name}`);
    } else {
        // No KO - apply HP damage for seeding (0.5x, can't kill)
        const votesAgainst = totalVotes - loser.votesFor;
        const damage = Math.floor((votesAgainst / totalVotes) * DAMAGE_CAP * MAIN_ROUND_MULTIPLIER);

        const loserCurrentHp = sanitizeHP(loser.player.hp);
        // HP can't go below 1 in Main Round (only special bar kills)
        const newLoserHp = Math.max(1, loserCurrentHp - damage);

        console.log(`[MAIN ROUND] ${loser.player.name}: ${loserCurrentHp} HP - ${damage} damage = ${newLoserHp} HP`);

        // Update winner
        await ctx.db.patch(winner.player._id, {
            specialBar: newWinnerBar,
            winStreak: (winner.player.winStreak || 0) + 1
        });

        // Update loser (reset their special bar progress on loss? No, per plan it accumulates)
        // Actually re-reading plan: "Does NOT reset on loss (cumulative)" for semi-finals
        // For Main Round, let's keep it cumulative too
        await ctx.db.patch(loser.player._id, {
            hp: newLoserHp,
            winStreak: 0 // Reset win streak on loss
        });
    }
}

/**
 * SEMI-FINALS (Round 2):
 * - Special bar: +1.0 per win, triggers at 3.0 = instant KO
 * - NO HP damage (HP carries through unchanged)
 * - Bar does NOT reset on loss (cumulative)
 * - Prompt 4 plays as "bragging round" after KO
 */
async function handleSemiFinals(
    ctx: MutationCtx,
    gameId: Id<"games">,
    winner: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    loser: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    _submissions: Doc<"submissions">[]
) {
    const SPECIAL_BAR_PER_WIN = 1.0;
    const SPECIAL_BAR_TRIGGER = 3.0;

    // Check if this is a BRAGGING ROUND (one player already KO'd)
    const winnerAlreadyKOd = winner.player.knockedOut;
    const loserAlreadyKOd = loser.player.knockedOut;

    if (winnerAlreadyKOd || loserAlreadyKOd) {
        // BRAGGING ROUND: Don't update any state, just determine message
        if (loserAlreadyKOd) {
            // KO'd player lost again: "Stop! He's already dead!"
            console.log(`[BRAGGING ROUND] ${loser.player.name} (already KO'd) lost again - "Stop! He's already dead!"`);
            await ctx.db.patch(gameId, { braggingRoundMessage: "STOP_ALREADY_DEAD" });
        } else {
            // KO'd player won: "How did you miss a guy knocked out on the floor?"
            console.log(`[BRAGGING ROUND] ${winner.player.name} (already KO'd) won! - "How did you miss?"`);
            await ctx.db.patch(gameId, { braggingRoundMessage: "HOW_DID_YOU_MISS" });
        }
        return;
    }

    // Normal Semi-Finals logic - clear any previous bragging round message
    await ctx.db.patch(gameId, { braggingRoundMessage: undefined });

    // Update winner's special bar
    const winnerCurrentBar = winner.player.specialBar || 0;
    const newWinnerBar = winnerCurrentBar + SPECIAL_BAR_PER_WIN;

    console.log(`[SEMI-FINALS] ${winner.player.name}: Special bar ${winnerCurrentBar} → ${newWinnerBar}`);

    // Check if special triggers
    if (newWinnerBar >= SPECIAL_BAR_TRIGGER) {
        console.log(`[SPECIAL KO!] ${winner.player.name} triggers special bar at ${newWinnerBar}! Advances to Final!`);

        // Winner: Update special bar
        await ctx.db.patch(winner.player._id, {
            specialBar: newWinnerBar,
            winStreak: (winner.player.winStreak || 0) + 1
        });

        // Loser: KO'd (no corner man assignment in semi-finals, just eliminated)
        await ctx.db.patch(loser.player._id, {
            knockedOut: true,
            specialBar: loser.player.specialBar || 0
        });

        console.log(`[SEMI-FINALS] ${loser.player.name} eliminated from tournament`);
    } else {
        // No KO yet - just update special bars, NO HP change
        console.log(`[SEMI-FINALS] No KO yet, HP unchanged`);

        // Update winner's bar
        await ctx.db.patch(winner.player._id, {
            specialBar: newWinnerBar,
            winStreak: (winner.player.winStreak || 0) + 1
        });

        // Loser: bar unchanged (cumulative, doesn't reset on loss)
        await ctx.db.patch(loser.player._id, {
            winStreak: 0
        });
    }
}

/**
 * FINAL (Round 3):
 * - 200 HP each, infinite prompts until KO
 * - Attack types determine damage multiplier
 * - Loser takes HIGHER multiplier (winner's dealt vs loser's received)
 * - Special bar: 3 consecutive wins = auto KO (RESETS on non-win)
 */
async function handleFinal(
    ctx: MutationCtx,
    _gameId: Id<"games">,
    winner: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    loser: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    DAMAGE_CAP: number,
    totalVotes: number,
    _submissions: Doc<"submissions">[]
) {
    const SPECIAL_BAR_TRIGGER = 3.0; // 3 consecutive wins

    // Get attack types from submissions
    const winnerAttack: AttackType = (winner.sub.attackType as AttackType) || "jab";
    const loserAttack: AttackType = (loser.sub.attackType as AttackType) || "jab";

    // Calculate damage multiplier (loser takes HIGHER of winner's dealt or loser's received)
    const winnerDealt = ATTACK_MULTIPLIERS[winnerAttack].dealt;
    const loserReceived = ATTACK_MULTIPLIERS[loserAttack].received;
    const damageMultiplier = Math.max(winnerDealt, loserReceived);

    console.log(`[FINAL] Attack types: ${winner.player.name}=${winnerAttack} (${winnerDealt}x dealt), ${loser.player.name}=${loserAttack} (${loserReceived}x received)`);
    console.log(`[FINAL] Damage multiplier: ${damageMultiplier}x (max of ${winnerDealt} and ${loserReceived})`);

    // Update winner's special bar (consecutive wins)
    const winnerCurrentBar = winner.player.specialBar || 0;
    const newWinnerBar = winnerCurrentBar + 1; // +1 per consecutive win

    // Reset loser's bar (resets on non-win in Final)
    const newLoserBar = 0;

    console.log(`[FINAL] ${winner.player.name}: Consecutive wins ${winnerCurrentBar} → ${newWinnerBar}`);

    // Check if special triggers (3 consecutive wins = auto KO)
    if (newWinnerBar >= SPECIAL_BAR_TRIGGER) {
        console.log(`[FINISHER!] ${winner.player.name} wins 3 in a row! INSTANT KO!`);

        await ctx.db.patch(winner.player._id, {
            specialBar: newWinnerBar,
            winStreak: (winner.player.winStreak || 0) + 1
        });

        await ctx.db.patch(loser.player._id, {
            hp: 0,
            knockedOut: true,
            specialBar: 0
        });

        console.log(`[FINAL] ${winner.player.name} wins the game!`);
    } else {
        // Calculate damage
        const votesAgainst = totalVotes - loser.votesFor;
        const baseDamage = (votesAgainst / totalVotes) * DAMAGE_CAP;
        const damage = Math.floor(baseDamage * damageMultiplier);

        const loserCurrentHp = sanitizeHP(loser.player.hp);
        const newLoserHp = Math.max(0, loserCurrentHp - damage);
        const knockedOut = newLoserHp === 0;

        console.log(`[FINAL] ${loser.player.name}: ${loserCurrentHp} HP - ${damage} damage (${damageMultiplier}x) = ${newLoserHp} HP`);

        // Update winner
        await ctx.db.patch(winner.player._id, {
            specialBar: newWinnerBar,
            winStreak: (winner.player.winStreak || 0) + 1
        });

        // Update loser
        await ctx.db.patch(loser.player._id, {
            hp: newLoserHp,
            knockedOut,
            specialBar: newLoserBar,
            winStreak: 0
        });

        if (knockedOut) {
            console.log(`[FINAL] ${loser.player.name} KO'd! ${winner.player.name} wins!`);
        }
    }
}

/**
 * POST-KO HEALING:
 * After a KO in Main Round, remaining prompts still play.
 * Winner heals based on vote margin (same formula as damage).
 */
async function handlePostKOHealing(
    ctx: MutationCtx,
    winner: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> },
    loser: { sub: Doc<"submissions">; votesFor: number; player: Doc<"players"> | null },
    currentRound: number,
    DAMAGE_CAP: number,
    totalVotes: number
) {
    if (currentRound !== 1) {
        // Only Main Round has post-KO healing
        console.log(`[POST-KO] Round ${currentRound}: No healing (only Main Round heals post-KO)`);
        return;
    }

    const MAIN_ROUND_MULTIPLIER = 0.5;

    // Healing = damage they would've dealt (based on vote margin)
    const votesFor = winner.votesFor;
    const healing = Math.floor((votesFor / totalVotes) * DAMAGE_CAP * MAIN_ROUND_MULTIPLIER);

    const winnerCurrentHp = sanitizeHP(winner.player.hp);
    const maxHp = winner.player.maxHp || 100;
    const newWinnerHp = Math.min(maxHp, winnerCurrentHp + healing);

    console.log(`[POST-KO HEALING] ${winner.player.name}: ${winnerCurrentHp} HP + ${healing} healing = ${newWinnerHp} HP`);

    await ctx.db.patch(winner.player._id, {
        hp: newWinnerHp,
        winStreak: (winner.player.winStreak || 0) + 1
    });
}

