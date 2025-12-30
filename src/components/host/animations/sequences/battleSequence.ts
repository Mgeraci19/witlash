import type { AnimationSequence, AnimationContext } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";

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
    // ===== STEP 1: Entry Sequence (7.4s - SACRED) =====
    {
      animation: "battle-entry",
      duration: 7.4, // SACRED - do not change
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

    // ===== STEP 3: Slide Answers to Corners (0.5s) =====
    {
      animation: "slide-answers",
      duration: 0.5,
    },

    // ===== STEP 4: Pause for Reaction (0.8s) =====
    {
      animation: "pause",
      duration: 0.8,
    },

    // ===== STEP 5: Reveal Votes (0.6s) =====
    {
      animation: "reveal-votes",
      duration: 0.6,
    },

    // ===== STEP 6: Pause After Votes (1.0s) =====
    {
      animation: "pause",
      duration: 1.0,
    },

    // ===== STEP 7: Attack Animation (varies) =====
    // Conditional: Select attack variant based on game state
    {
      animation: "attack", // Placeholder - will be replaced by variant selector
      duration: 1.5, // Max duration (KO takes 1.05s)
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
  const { leftBattler, rightBattler, leftDamage, rightDamage } = context;

  if (!leftBattler || !rightBattler) {
    console.warn("[selectAttackVariant] Missing battler data, skipping attack");
    return false;
  }

  // Check if it's a tie
  const isTie = leftBattler.voteCount === rightBattler.voteCount;
  if (isTie) {
    // TODO: Implement tie attack animation
    console.log("[selectAttackVariant] Tie detected - using normal attack for now");
    return "attack-normal";
  }

  // Determine winner and loser
  const winner = leftBattler.isWinner ? leftBattler : rightBattler;
  const loser = leftBattler.isWinner ? rightBattler : leftBattler;
  const damage = leftBattler.isWinner ? rightDamage : leftDamage;

  // Check if this will KO the loser
  const loserNewHp = (loser.hp || 100) - damage;
  const isKO = loserNewHp <= 0;

  if (isKO) {
    // Check for combo KO (3-win streak)
    const winnerStreak = winner.winStreak || 0;
    const isComboKO = winnerStreak >= 2; // 3rd win (streak of 2 means 2 previous wins)

    if (isComboKO) {
      console.log(
        `[selectAttackVariant] Combo KO! ${winner.name} with ${winnerStreak + 1}-win streak`
      );
      return "attack-combo-ko";
    } else {
      console.log(`[selectAttackVariant] KO! ${winner.name} KOs ${loser.name}`);
      return "attack-ko";
    }
  } else {
    console.log(`[selectAttackVariant] Normal attack: ${winner.name} → ${loser.name} (${damage} damage)`);
    return "attack-normal";
  }
}

// Auto-register sequence
animationRegistry.registerSequence(BATTLE_SEQUENCE);
