import { gsap } from "../../animations/gsapConfig";
import { BattleRefs, BattleActions, BattlerInfo } from "../types";
import { BattleSide } from "../../animations/registry/types";

const DAMAGE_CAP = 35;

interface TieSequenceOptions {
  refs: BattleRefs;
  actions: BattleActions;
  leftBattler: BattlerInfo;
  rightBattler: BattlerInfo;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
  onComplete?: () => void;
}

/**
 * playTieAttack - Both fighters attack simultaneously
 *
 * Handles:
 * - Simultaneous lunge and recoil
 * - Both flash hurt
 * - Double KO with shorter answer winning
 * - Mutual destruction if same length
 */
export function playTieAttack({
  refs,
  actions,
  leftBattler,
  rightBattler,
  onDamageApplied,
  onComplete,
}: TieSequenceOptions): void {
  actions.setLeftFighterState("attacking");
  actions.setRightFighterState("attacking");

  const totalVotes = leftBattler.voteCount + rightBattler.voteCount;
  const damage = totalVotes > 0 ? Math.floor(0.5 * DAMAGE_CAP) : 0;

  // Check for double KO
  const leftNewHp = (leftBattler.hp || 100) - damage;
  const rightNewHp = (rightBattler.hp || 100) - damage;
  const leftKO = leftNewHp <= 0;
  const rightKO = rightNewHp <= 0;

  const tieTimeline = gsap.timeline();

  // Both lunge toward each other
  tieTimeline.to(refs.leftFighter.current, {
    x: 80,
    duration: 0.15,
    ease: "power2.in",
  }, 0);
  tieTimeline.to(refs.rightFighter.current, {
    x: -80,
    duration: 0.15,
    ease: "power2.in",
  }, 0);

  // Both recoil
  tieTimeline.to(refs.leftFighter.current, {
    x: 50,
    duration: 0.1,
    ease: "power2.out",
  });
  tieTimeline.to(refs.rightFighter.current, {
    x: -50,
    duration: 0.1,
    ease: "power2.out",
  }, "<");

  // Both flash hurt
  tieTimeline.call(() => {
    actions.setLeftFighterState("hurt");
    actions.setRightFighterState("hurt");
    onDamageApplied?.("left", damage);
    onDamageApplied?.("right", damage);
  });

  tieTimeline.to({}, { duration: 0.3 });

  // Handle double KO - shorter answer wins
  if (leftKO && rightKO) {
    const leftLen = leftBattler.answer.length;
    const rightLen = rightBattler.answer.length;

    if (leftLen !== rightLen) {
      // Shorter answer wins!
      const shorterWins = leftLen < rightLen ? "left" : "right";
      const loserRef = shorterWins === "left" ? refs.rightFighter : refs.leftFighter;
      const direction = shorterWins === "left" ? 1 : -1;

      tieTimeline.call(() => {
        actions.setTieMessage("THE QUICKER WIT SURVIVES!");
      });

      tieTimeline.to({}, { duration: 0.8 });

      // Bump loser offscreen
      tieTimeline.to(loserRef.current, {
        x: direction * 800,
        rotation: direction * 720,
        opacity: 0,
        duration: 0.8,
        ease: "power2.in",
      });

      tieTimeline.call(() => {
        if (shorterWins === "left") {
          actions.setLeftFighterState("victory");
          actions.setRightFighterState("ko");
        } else {
          actions.setRightFighterState("victory");
          actions.setLeftFighterState("ko");
        }
        actions.setPhase("complete");
        onComplete?.();
      });
    } else {
      // Exact same length - true mutual destruction
      tieTimeline.call(() => {
        actions.setTieMessage("MUTUAL DESTRUCTION!");
      });

      tieTimeline.to({}, { duration: 0.5 });

      // Both fly off
      tieTimeline.to(refs.leftFighter.current, {
        x: -800,
        rotation: -720,
        opacity: 0,
        duration: 0.8,
        ease: "power2.in",
      }, "ko");
      tieTimeline.to(refs.rightFighter.current, {
        x: 800,
        rotation: 720,
        opacity: 0,
        duration: 0.8,
        ease: "power2.in",
      }, "ko");

      tieTimeline.call(() => {
        actions.setLeftFighterState("ko");
        actions.setRightFighterState("ko");
        actions.setPhase("complete");
        onComplete?.();
      });
    }
  } else {
    // Normal tie - no KO
    tieTimeline.call(() => {
      actions.setLeftFighterState("idle");
      actions.setRightFighterState("idle");
      actions.setPhase("complete");
      onComplete?.();
    });
  }
}
