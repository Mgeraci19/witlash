import type { AnimationSequence, AnimationContext } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";
import { TIMINGS } from "../config";
import { selectRandomVariant, ATTACK_VARIANTS } from "../core/variantSelector";

/**
 * BATTLE_SEQUENCE - The complete battle animation flow
 *
 * This sequence defines the ORDER, TIMING, and PARALLELISM of battle animations.
 *
 * Flow:
 * 1. Entry: Question → Answer slams → Voting phase (7.4s - SACRED)
 * 2. Wait for reveal: Backend sets roundStatus to "REVEAL" (duration: null)
 * 3. Slide: Answers slide to corners (0.5s)
 * 4. Pause: Reaction time (0.8s)
 * 5. Reveal: Votes tick up (0.6s)
 * 6. Pause: After votes shown (1.0s)
 * 7. Attack: Winner attacks loser (varies by type)
 *
 * Total: 10.3s + attack time (or indefinite wait for reveal)
 */
export const BATTLE_SEQUENCE: AnimationSequence = {
  id: "battle",
  name: "Battle Sequence",
  steps: [
    // ===== STEP 1: Entry Sequence =====
    {
      animation: "battle-entry",
      duration: TIMINGS.entrySequence,
    },

    // ===== STEP 2: Wait for Reveal Signal =====
    // Backend sets game.roundStatus to "REVEAL" when all votes are in
    {
      animation: "voting-wait",
      duration: null, // Indefinite - waits for external signal
      waitFor: {
        gameState: (game) => game.roundStatus === "REVEAL",
        timeout: 120000, // 2 minute timeout (safety)
      },
    },

    // ===== STEP 3: Slide Answers to Corners =====
    {
      animation: "slide-answers",
      duration: TIMINGS.slideAnswers,
    },

    // ===== STEP 4: Pause for Reaction =====
    {
      animation: "pause",
      duration: TIMINGS.reactionPause,
    },

    // ===== STEP 5: Reveal Votes =====
    {
      animation: "reveal-votes",
      duration: TIMINGS.revealVotes,
    },

    // ===== STEP 6: Pause After Votes =====
    {
      animation: "pause",
      duration: TIMINGS.postVotePause,
    },

    // ===== STEP 7: Attack Animation (varies) =====
    // Conditional: Select attack variant based on game state
    {
      animation: "attack", // Placeholder - will be replaced by variant selector
      conditional: selectAttackVariant,
    },
  ],
};

/**
 * selectAttackVariant - Determine which attack animation to use
 *
 * Logic:
 * 1. If tie: use "attack-tie" (not implemented yet - falls back to normal)
 * 2. If winner will KO loser:
 *    a. If winner has 2-win streak (3rd win): use "attack-combo-ko"
 *    b. Otherwise: use "attack-ko"
 * 3. Otherwise: use "attack-normal"
 *
 * @param context The animation context
 * @returns The animation ID to use, or false to skip
 */
function selectAttackVariant(context: AnimationContext): boolean | string {
  // Use getter functions for CURRENT data (not stale captured values)
  const leftBattler = context.getLeftBattler?.() ?? context.leftBattler;
  const rightBattler = context.getRightBattler?.() ?? context.rightBattler;
  const leftDamage = context.getLeftDamage?.() ?? context.leftDamage;
  const rightDamage = context.getRightDamage?.() ?? context.rightDamage;

  if (!leftBattler || !rightBattler) {
    console.warn("[selectAttackVariant] Missing battler data, skipping attack");
    return false;
  }

  console.log(`[selectAttackVariant] Left: ${leftBattler.name} (${leftBattler.voteCount} votes, isWinner: ${leftBattler.isWinner}), Right: ${rightBattler.name} (${rightBattler.voteCount} votes, isWinner: ${rightBattler.isWinner})`);

  // Determine if there's a winner or a tie
  // True tie = equal votes AND neither battler is winner (no speed tiebreaker)
  const votesEqual = leftBattler.voteCount === rightBattler.voteCount;
  const hasWinner = leftBattler.isWinner || rightBattler.isWinner;
  const isTie = votesEqual && !hasWinner;

  if (isTie) {
    console.log("[selectAttackVariant] TIE (equal votes, no winner) - using tie attack animation");
    return "attack-tie";
  }

  // Not a tie - determine winner
  // Use isWinner flag first, fall back to vote counts
  let winner, loser, damage;
  if (leftBattler.isWinner) {
    winner = leftBattler;
    loser = rightBattler;
    damage = rightDamage;
    console.log(`[selectAttackVariant] Winner: ${winner.name} (LEFT) via isWinner flag`);
  } else if (rightBattler.isWinner) {
    winner = rightBattler;
    loser = leftBattler;
    damage = leftDamage;
    console.log(`[selectAttackVariant] Winner: ${winner.name} (RIGHT) via isWinner flag`);
  } else {
    // Fallback: Use vote counts (isWinner not set correctly)
    const leftWins = leftBattler.voteCount > rightBattler.voteCount;
    winner = leftWins ? leftBattler : rightBattler;
    loser = leftWins ? rightBattler : leftBattler;
    damage = leftWins ? rightDamage : leftDamage;
    console.warn(`[selectAttackVariant] isWinner not set, using vote counts as fallback - Winner: ${winner.name}`);
  }

  // Check if this will KO the loser
  // KO can happen via: 1) HP damage reducing HP to 0, or 2) Special bar reaching 3
  const loserCurrentHp = loser.hp || 100;
  const loserNewHp = loserCurrentHp - damage;
  const isHpKO = loserNewHp <= 0;

  // Special bar KO: winner's current bar + 1 (for this win) >= 3 triggers KO
  const winnerSpecialBar = winner.specialBar ?? 0;
  const isSpecialBarKO = winnerSpecialBar + 1 >= 3;

  const isKO = isHpKO || isSpecialBarKO;

  console.log(`[selectAttackVariant] KO Check:`, {
    loser: loser.name,
    currentHP: loserCurrentHp,
    damage: damage,
    newHP: loserNewHp,
    isHpKO: isHpKO,
    winner: winner.name,
    winnerSpecialBar: winnerSpecialBar,
    isSpecialBarKO: isSpecialBarKO,
    isKO: isKO,
    winnerStreak: winner.winStreak || 0,
  });

  if (isKO) {
    // Check for combo KO (3-win streak)
    const winnerStreak = winner.winStreak || 0;
    const isComboKO = winnerStreak >= 2; // 3rd win (streak of 2 means 2 previous wins)

    if (isComboKO) {
      const finisher = selectRandomVariant(ATTACK_VARIANTS.finisher);
      console.log(
        `[selectAttackVariant] FINISHER! ${winner.name} with ${winnerStreak + 1}-win streak → ${finisher}`
      );
      return finisher;
    } else {
      const koAttack = selectRandomVariant(ATTACK_VARIANTS.ko);
      console.log(`[selectAttackVariant] KO! ${winner.name} KOs ${loser.name} → ${koAttack}`);
      return koAttack;
    }
  } else {
    const normalAttack = selectRandomVariant(ATTACK_VARIANTS.normal);
    console.log(`[selectAttackVariant] Normal attack: ${winner.name} → ${loser.name} (${damage} damage) → ${normalAttack}`);
    return normalAttack;
  }
}

// Auto-register sequence
animationRegistry.registerSequence(BATTLE_SEQUENCE);
