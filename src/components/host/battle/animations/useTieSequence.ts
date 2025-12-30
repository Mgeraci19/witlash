import { gsap } from "../../animations/gsapConfig";
import { BattleRefs, BattleActions, BattlerInfo } from "../types";
import { BattleSide } from "../../animations/registry/types";

const DAMAGE_CAP = 35;

interface TieSequenceOptions {
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
  leftDamage,
  rightDamage,
  onDamageApplied,
  onComplete,
}: TieSequenceOptions): void {
  actions.setLeftFighterState("attacking");
  actions.setRightFighterState("attacking");

  // Use exact damage passed from parent (calculated from votes)
  // Check for double KO
  const leftNewHp = (leftBattler.hp || 100) - leftDamage;
  const rightNewHp = (rightBattler.hp || 100) - rightDamage;
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

  // Both flash hurt + damage callback (0.2s after attack starts)
  tieTimeline.call(() => {
    actions.setLeftFighterState("hurt");
    actions.setRightFighterState("hurt");
    // Call damage callbacks 0.2s after attack animation starts
    onDamageApplied?.("left", leftDamage);
    onDamageApplied?.("right", rightDamage);
  }, [], "+=0.05"); // Happens 0.2s total from start (0.15s lunge + 0.05s)

  tieTimeline.to({}, { duration: 0.3 });

  // Handle KO scenarios in ties
  if (leftKO && rightKO) {
    // Double KO - shorter/faster answer wins
    const leftLen = leftBattler.answer.length;
    const rightLen = rightBattler.answer.length;

    let winner: "left" | "right";
    let message: string;

    // Check for combo KO (winner's streak determines combo status)
    const leftStreak = leftBattler.winStreak || 0;
    const rightStreak = rightBattler.winStreak || 0;
    const bothCombo = leftStreak >= 2 && rightStreak >= 2; // Both have 3-win potential

    if (leftLen !== rightLen) {
      // Shorter answer wins!
      winner = leftLen < rightLen ? "left" : "right";
      message = bothCombo ? "DOUBLE COMBO KO!" : "THE QUICKER WIT SURVIVES!";
    } else {
      // Same length - faster submission wins
      const leftTime = leftBattler.submissionTime || 0;
      const rightTime = rightBattler.submissionTime || 0;
      winner = leftTime < rightTime ? "left" : "right";
      message = bothCombo ? "DOUBLE COMBO KO!" : "SPEED WINS!";
    }

    const loserRef = winner === "left" ? refs.rightFighter : refs.leftFighter;
    const direction = winner === "left" ? 1 : -1;

    tieTimeline.call(() => {
      actions.setTieMessage(message);
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
      if (winner === "left") {
        actions.setLeftFighterState("victory");
        actions.setRightFighterState("ko");
      } else {
        actions.setRightFighterState("victory");
        actions.setLeftFighterState("ko");
      }
      actions.setPhase("complete");
      onComplete?.();
    });
  } else if (leftKO || rightKO) {
    // Single KO in a tie - one player survives
    const winner = leftKO ? "right" : "left";
    const loser = leftKO ? leftBattler : rightBattler;
    const loserRef = leftKO ? refs.leftFighter : refs.rightFighter;
    const direction = leftKO ? -1 : 1;

    // In single KO tie, survivor gets combo increment
    const survivorBattler = leftKO ? rightBattler : leftBattler;
    const winnerStreak = survivorBattler.winStreak || 0;
    const isComboKO = winnerStreak >= 2; // Will be 3rd win

    tieTimeline.call(() => {
      actions.setTieMessage(isComboKO ? `COMBO x${winnerStreak + 1} INSTANT KO!` : "KNOCKOUT!");
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
      if (winner === "left") {
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
    // Normal tie - no KO
    tieTimeline.call(() => {
      actions.setLeftFighterState("idle");
      actions.setRightFighterState("idle");
      actions.setPhase("complete");
      onComplete?.();
    });
  }
}
