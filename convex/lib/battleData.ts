import { query } from "../_generated/server";
import { v } from "convex/values";

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
    const leftVoteCount = votes.filter(v => v.submissionId === leftSub._id).length;
    const rightVoteCount = votes.filter(v => v.submissionId === rightSub._id).length;

    const { leftDamage, rightDamage, isTie, tieWinner } = calculateBattleDamage({
      leftVotes: leftVoteCount,
      rightVotes: rightVoteCount,
      totalVotes: votes.length,
      leftPlayer,
      rightPlayer,
      currentRound: game.currentRound,
      leftSubmissionTime: leftSub._creationTime,
      rightSubmissionTime: rightSub._creationTime,
    });

    return {
      promptId: args.promptId,
      leftSubmission: leftSub,
      rightSubmission: rightSub,
      leftPlayer,
      rightPlayer,
      leftDamage,   // FROM BACKEND (single source of truth)
      rightDamage,  // FROM BACKEND (single source of truth)
      leftVotes: leftVoteCount,
      rightVotes: rightVoteCount,
      isTie,
      tieWinner,    // Which side wins the tiebreaker (if double KO tie)
    };
  },
});

/**
 * Calculate damage for a battle
 *
 * Extracted from gameLogic.ts resolveBattle() to be reusable
 * Includes tie-breaking logic: in double KO ties, faster submitter survives
 */
function calculateBattleDamage({
  leftVotes,
  rightVotes,
  totalVotes,
  leftPlayer,
  rightPlayer,
  currentRound,
  leftSubmissionTime,
  rightSubmissionTime,
}: {
  leftVotes: number;
  rightVotes: number;
  totalVotes: number;
  leftPlayer: { hp?: number; winStreak?: number };
  rightPlayer: { hp?: number; winStreak?: number };
  currentRound: number;
  leftSubmissionTime?: number;
  rightSubmissionTime?: number;
}): { leftDamage: number; rightDamage: number; isTie: boolean; tieWinner?: "left" | "right" } {
  const DAMAGE_CAP = 35;
  const COMBO_BONUS_DAMAGE = 15;

  // Round multipliers (matches gameLogic.ts)
  const getRoundMultiplier = (round: number): number => {
    switch (round) {
      case 1: return 1.0;   // 35 max damage (Main Round)
      case 2: return 1.3;   // 45.5 max damage (Semi-Finals)
      case 3: return 1.0;   // 35 max damage (Final)
      default: return 1.0;
    }
  };

  // Safety: no votes = no damage
  if (totalVotes === 0) {
    return { leftDamage: 0, rightDamage: 0, isTie: false };
  }

  const isTie = leftVotes === rightVotes;

  if (isTie) {
    // Tie: both would take 50% of DAMAGE_CAP with round multiplier
    const tieDamage = 0.5 * DAMAGE_CAP * getRoundMultiplier(currentRound);
    const leftHp = leftPlayer?.hp ?? 100;
    const rightHp = rightPlayer?.hp ?? 100;

    const leftNewHp = Math.max(0, Math.floor(leftHp - tieDamage));
    const rightNewHp = Math.max(0, Math.floor(rightHp - tieDamage));

    const leftWouldKO = leftNewHp === 0;
    const rightWouldKO = rightNewHp === 0;
    const bothKO = leftWouldKO && rightWouldKO;

    console.log(`[FE DAMAGE] TIE: leftHp=${leftHp}, rightHp=${rightHp}, tieDamage=${tieDamage}, leftWouldKO=${leftWouldKO}, rightWouldKO=${rightWouldKO}, bothKO=${bothKO}`);

    if (bothKO && leftSubmissionTime && rightSubmissionTime) {
      // Double KO tie: faster submitter survives with reduced damage
      const leftWasFaster = leftSubmissionTime < rightSubmissionTime;
      console.log(`[FE DAMAGE] Double KO tie! Faster: ${leftWasFaster ? 'left' : 'right'} (left=${leftSubmissionTime}, right=${rightSubmissionTime})`);

      if (leftWasFaster) {
        // Left survives (takes damage but not full KO), right gets KO'd
        return {
          leftDamage: Math.max(0, leftHp - 1), // Reduce to 1 HP
          rightDamage: Math.floor(tieDamage),
          isTie: true,
          tieWinner: "left",
        };
      } else {
        // Right survives, left gets KO'd
        return {
          leftDamage: Math.floor(tieDamage),
          rightDamage: Math.max(0, rightHp - 1), // Reduce to 1 HP
          isTie: true,
          tieWinner: "right",
        };
      }
    }

    // Normal tie or single KO: both take equal damage
    return {
      leftDamage: Math.floor(tieDamage),
      rightDamage: Math.floor(tieDamage),
      isTie: true,
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
      isTie: false,
    };
  }
}
