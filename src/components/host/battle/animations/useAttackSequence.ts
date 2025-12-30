import { gsap } from "../../animations/gsapConfig";
import { BattleRefs, BattleActions, BattlerInfo } from "../types";
import { BattleSide } from "../../animations/registry/types";

const DAMAGE_CAP = 35;

interface AttackSequenceOptions {
  refs: BattleRefs;
  actions: BattleActions;
  leftBattler: BattlerInfo;
  rightBattler: BattlerInfo;
  leftDamage: number;
  rightDamage: number;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
  onComplete?: () => void;
}

/**
 * playWinnerAttack - Plays attack animation when there's a clear winner
 *
 * - Winner lunges toward loser
 * - Loser flashes hurt
 * - If KO, loser spins offscreen
 */
export function playWinnerAttack({
  refs,
  actions,
  leftBattler,
  rightBattler,
  leftDamage,
  rightDamage,
  onDamageApplied,
  onComplete,
}: AttackSequenceOptions): void {
  const winner = leftBattler.isWinner ? leftBattler : rightBattler;
  const loser = leftBattler.isWinner ? rightBattler : leftBattler;
  const winnerIsLeft = leftBattler.isWinner;

  // Use exact damage passed from parent (calculated from votes)
  const damage = winnerIsLeft ? rightDamage : leftDamage;

  // Check if this will KO the loser
  const loserNewHp = (loser.hp || 100) - damage;
  const isKO = loserNewHp <= 0;

  // Check for combo KO (3-win streak triggers instant KO)
  const winnerStreak = winner.winStreak || 0;
  const isComboKO = isKO && winnerStreak >= 2; // 3rd win = instant KO

  // Set winner to attacking state
  if (winnerIsLeft) {
    actions.setLeftFighterState("attacking");
  } else {
    actions.setRightFighterState("attacking");
  }

  const winnerRef = winnerIsLeft ? refs.leftFighter : refs.rightFighter;
  const loserRef = winnerIsLeft ? refs.rightFighter : refs.leftFighter;
  // Get dynamic width for offscreen calculation
  const arenaWidth = refs.arena.current?.clientWidth || 800;
  const offscreenDist = arenaWidth * 1.2; // 120% of width to be safe
  const direction = winnerIsLeft ? 1 : -1;

  if (isKO) {
    // Show combo message if applicable
    if (isComboKO) {
      actions.setTieMessage(`COMBO x${winnerStreak + 1} INSTANT KO!`);
    }

    // KO animation - attack then bump off
    const attackTimeline = gsap.timeline({
      onComplete: () => {
        // Bump loser offscreen
        gsap.to(loserRef.current, {
          x: direction * offscreenDist,
          rotation: direction * 720,
          opacity: 0,
          duration: 0.8,
          ease: "power2.in",
          onComplete: () => {
            if (winnerIsLeft) {
              actions.setRightFighterState("ko");
            } else {
              actions.setLeftFighterState("ko");
            }
            // Clear combo message
            if (isComboKO) {
              actions.setTieMessage(null);
            }
            actions.setPhase("complete");
            onComplete?.();
          },
        });
      },
    });

    // Quick lunge
    attackTimeline.to(winnerRef.current, {
      x: direction * 150,
      duration: 0.15,
      ease: "power2.in",
    });
    attackTimeline.to(winnerRef.current, {
      x: direction * 100,
      duration: 0.1,
      ease: "power2.out",
    });

    // Hurt flash on loser + damage callback (0.2s after attack starts)
    attackTimeline.call(() => {
      if (winnerIsLeft) {
        actions.setRightFighterState("hurt");
      } else {
        actions.setLeftFighterState("hurt");
      }
      // Call damage callback 0.2s after attack animation starts
      onDamageApplied?.(winnerIsLeft ? "right" : "left", damage);
    }, [], "+=0.05"); // Happens 0.2s total from start (0.15s lunge + 0.05s)
  } else {
    // Normal attack (not KO) - use simpler animation
    const attackTimeline = gsap.timeline({
      onComplete: () => {
        actions.setPhase("complete");
        onComplete?.();
      },
    });

    // Lunge forward
    attackTimeline.to(winnerRef.current, {
      x: direction * 100,
      duration: 0.15,
      ease: "power2.in",
    });

    // Return
    attackTimeline.to(winnerRef.current, {
      x: 0,
      duration: 0.2,
      ease: "power2.out",
    });

    // Hurt flash + damage callback (0.2s after attack starts)
    attackTimeline.call(() => {
      if (winnerIsLeft) {
        actions.setRightFighterState("hurt");
        setTimeout(() => actions.setRightFighterState("idle"), 200);
      } else {
        actions.setLeftFighterState("hurt");
        setTimeout(() => actions.setLeftFighterState("idle"), 200);
      }
      // Call damage callback 0.2s after attack animation starts
      onDamageApplied?.(winnerIsLeft ? "right" : "left", damage);
    }, [], "+=0.05"); // Happens 0.2s total from start (0.15s lunge + 0.05s)
  }
}
