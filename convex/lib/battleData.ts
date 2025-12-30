import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * getBattleData - Returns all battle data for a prompt including calculated damage
 *
 * This is the SINGLE SOURCE OF TRUTH for damage calculation.
 * Frontend should use this instead of calculating damage locally.
 */
export const getBattleData = query({
  args: { promptId: v.id("prompts") },
  handler: async (ctx, args) => {
    // Fetch prompt
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) return null;

    // Fetch submissions for this prompt
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_prompt", q => q.eq("promptId", args.promptId))
      .collect();

    if (submissions.length !== 2) return null;

    // Fetch votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_prompt", q => q.eq("promptId", args.promptId))
      .collect();

    const [leftSub, rightSub] = submissions;
    const leftPlayer = await ctx.db.get(leftSub.playerId);
    const rightPlayer = await ctx.db.get(rightSub.playerId);

    // Get game for round info
    const game = await ctx.db.get(prompt.gameId);
    if (!game || !leftPlayer || !rightPlayer) return null;

    // Calculate damage (matches backend logic in gameLogic.ts)
    const { leftDamage, rightDamage } = calculateBattleDamage({
      leftVotes: votes.filter(v => v.submissionId === leftSub._id).length,
      rightVotes: votes.filter(v => v.submissionId === rightSub._id).length,
      totalVotes: votes.length,
      leftPlayer,
      rightPlayer,
      currentRound: game.currentRound,
    });

    return {
      promptId: args.promptId,
      leftSubmission: leftSub,
      rightSubmission: rightSub,
      leftPlayer,
      rightPlayer,
      leftDamage,   // FROM BACKEND (single source of truth)
      rightDamage,  // FROM BACKEND (single source of truth)
      leftVotes: votes.filter(v => v.submissionId === leftSub._id).length,
      rightVotes: votes.filter(v => v.submissionId === rightSub._id).length,
    };
  },
});

/**
 * Calculate damage for a battle
 *
 * Extracted from gameLogic.ts resolveBattle() to be reusable
 */
function calculateBattleDamage({
  leftVotes,
  rightVotes,
  totalVotes,
  leftPlayer,
  rightPlayer,
  currentRound,
}: {
  leftVotes: number;
  rightVotes: number;
  totalVotes: number;
  leftPlayer: any;
  rightPlayer: any;
  currentRound: number;
}): { leftDamage: number; rightDamage: number } {
  const DAMAGE_CAP = 35;
  const COMBO_BONUS_DAMAGE = 15;

  // Round multipliers (matches gameLogic.ts)
  const getRoundMultiplier = (round: number): number => {
    switch (round) {
      case 1: return 1.0;   // 35 max damage
      case 2: return 1.3;   // 45.5 max damage
      case 3: return 1.0;   // 35 max damage
      case 4: return 1.5;   // 52.5 max damage
      default: return 1.0;
    }
  };

  // Safety: no votes = no damage
  if (totalVotes === 0) {
    return { leftDamage: 0, rightDamage: 0 };
  }

  const isTie = leftVotes === rightVotes;

  if (isTie) {
    // Tie: both take 50% of DAMAGE_CAP with round multiplier
    const damage = 0.5 * DAMAGE_CAP * getRoundMultiplier(currentRound);
    return {
      leftDamage: Math.floor(damage),
      rightDamage: Math.floor(damage),
    };
  } else {
    // Non-tie: only loser takes damage
    const loserIsLeft = leftVotes < rightVotes;
    const winnerPlayer = loserIsLeft ? rightPlayer : leftPlayer;
    const winnerStreak = winnerPlayer?.winStreak || 0;
    const loserVotes = loserIsLeft ? leftVotes : rightVotes;
    const votesAgainst = totalVotes - loserVotes;

    // Base damage
    let damage = (votesAgainst / totalVotes) * DAMAGE_CAP * getRoundMultiplier(currentRound);

    // Apply combo bonuses
    if (winnerStreak === 2) {
      // 3rd win = instant KO
      damage = 999;
    } else if (winnerStreak === 1) {
      // 2nd win = bonus damage
      damage += COMBO_BONUS_DAMAGE;
    }

    return {
      leftDamage: loserIsLeft ? Math.floor(damage) : 0,
      rightDamage: loserIsLeft ? 0 : Math.floor(damage),
    };
  }
}
