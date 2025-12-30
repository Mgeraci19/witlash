import { gsap } from "../../animations/gsapConfig";
import { BattleRefs, BattleActions, BattlerInfo } from "../types";
import { BattleSide } from "../../animations/registry/types";

const DAMAGE_CAP = 35;

interface AttackSequenceOptions {
  refs: BattleRefs;
  actions: BattleActions;
  leftBattler: BattlerInfo;
  rightBattler: BattlerInfo;
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
  onDamageApplied,
  onComplete,
}: AttackSequenceOptions): void {
  const winner = leftBattler.isWinner ? leftBattler : rightBattler;
  const loser = leftBattler.isWinner ? rightBattler : leftBattler;
  const winnerIsLeft = leftBattler.isWinner;

  const totalVotes = leftBattler.voteCount + rightBattler.voteCount;
  const loserVotes = winnerIsLeft ? rightBattler.voteCount : leftBattler.voteCount;
  const damage = totalVotes > 0 ? Math.floor((loserVotes / totalVotes) * DAMAGE_CAP) : 0;

  // Check if this will KO the loser
  const loserNewHp = (loser.hp || 100) - damage;
  const isKO = loserNewHp <= 0;

  // Set winner to attacking state
  if (winnerIsLeft) {
    actions.setLeftFighterState("attacking");
  } else {
    actions.setRightFighterState("attacking");
  }

  const winnerRef = winnerIsLeft ? refs.leftFighter : refs.rightFighter;
  const loserRef = winnerIsLeft ? refs.rightFighter : refs.leftFighter;
  const direction = winnerIsLeft ? 1 : -1;

  if (isKO) {
    // KO animation - attack then bump off
    const attackTimeline = gsap.timeline({
      onComplete: () => {
        // Bump loser offscreen
        gsap.to(loserRef.current, {
          x: direction * 800,
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

    // Hurt flash on loser
    attackTimeline.call(() => {
      if (winnerIsLeft) {
        actions.setRightFighterState("hurt");
      } else {
        actions.setLeftFighterState("hurt");
      }
      onDamageApplied?.(winnerIsLeft ? "right" : "left", damage);
    }, [], "-=0.1");
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

    // Hurt flash
    attackTimeline.call(() => {
      if (winnerIsLeft) {
        actions.setRightFighterState("hurt");
        setTimeout(() => actions.setRightFighterState("idle"), 200);
      } else {
        actions.setLeftFighterState("hurt");
        setTimeout(() => actions.setLeftFighterState("idle"), 200);
      }
      onDamageApplied?.(winnerIsLeft ? "right" : "left", damage);
    }, [], "-=0.2");
  }
}
