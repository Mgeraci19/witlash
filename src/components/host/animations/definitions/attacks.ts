import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";
import { TIMINGS } from "../config";

/**
 * attackNormalAnimation - Standard attack when winner doesn't KO the loser
 *
 * Flow:
 * 1. Winner lunges forward (0.15s)
 * 2. Winner returns to position (0.2s)
 * 3. Loser shows hurt flash
 * 4. Damage is applied
 *
 * Total duration: ~0.35s
 */
export const attackNormalAnimation: AnimationDefinition = {
  id: "attack-normal",
  name: "Normal Attack",
  category: "battle",
  duration: 0.35,
  canRunInParallel: true, // Can run with damage number effects
  priority: 1,
  tags: ["attack", "damage"],

  create: (context) => {
    // Use getter functions for CURRENT data (not stale captured values)
    const leftBattler = context.getLeftBattler?.() ?? context.leftBattler;
    const rightBattler = context.getRightBattler?.() ?? context.rightBattler;
    const leftDamage = context.getLeftDamage?.() ?? context.leftDamage;
    const rightDamage = context.getRightDamage?.() ?? context.rightDamage;

    // Determine winner using isWinner flag or vote counts as fallback
    let winnerIsLeft: boolean;
    if (leftBattler?.isWinner) {
      winnerIsLeft = true;
    } else if (rightBattler?.isWinner) {
      winnerIsLeft = false;
    } else {
      // Fallback: use vote counts
      const leftVotes = leftBattler?.voteCount || 0;
      const rightVotes = rightBattler?.voteCount || 0;
      winnerIsLeft = leftVotes > rightVotes;
      console.warn("[attackNormalAnimation] isWinner not set, using vote counts as fallback");
    }

    const damage = winnerIsLeft ? rightDamage : leftDamage;
    const direction = winnerIsLeft ? 1 : -1;

    const winnerRef = winnerIsLeft ? context.refs.leftFighter : context.refs.rightFighter;

    const timeline = gsap.timeline({
      onComplete: () => {
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Set attacking state
    context.setFighterState?.(winnerIsLeft ? "left" : "right", "attacking");

    // Lunge forward
    timeline.to(winnerRef.current, {
      x: direction * 100,
      duration: 0.15,
      ease: "power2.in",
    });

    // Return
    timeline.to(winnerRef.current, {
      x: 0,
      duration: 0.2,
      ease: "power2.out",
    });

    // Hurt flash + damage callback
    timeline.call(
      () => {
        const loserSide = winnerIsLeft ? "right" : "left";
        console.log(`[attackNormalAnimation] Applying ${damage} damage to ${loserSide}`);
        context.setFighterState?.(loserSide, "hurt");
        context.onDamageApplied?.(loserSide, damage);

        // Return to idle after hurt flash
        setTimeout(() => {
          context.setFighterState?.(loserSide, "idle");
        }, 200);
      },
      [],
      "+=0.05"
    ); // Happens 0.2s total from start (0.15s lunge + 0.05s)

    return timeline;
  },
};

/**
 * attackKOAnimation - KO attack when winner reduces loser's HP to 0
 *
 * Flow:
 * 1. Winner quick lunge (0.25s)
 * 2. Loser hurt flash
 * 3. Loser spins offscreen (0.8s)
 * 4. Damage is applied
 *
 * Total duration: ~1.05s
 */
export const attackKOAnimation: AnimationDefinition = {
  id: "attack-ko",
  name: "KO Attack",
  category: "battle",
  duration: 2.5, // Extended for dramatic KO reveal (0.25s attack + 0.8s spin-off + 1.45s KO display)
  canRunInParallel: false,
  priority: 10, // Higher priority than normal attack
  tags: ["attack", "ko"],

  create: (context) => {
    // Use getter functions for CURRENT data (not stale captured values)
    const leftBattler = context.getLeftBattler?.() ?? context.leftBattler;
    const rightBattler = context.getRightBattler?.() ?? context.rightBattler;
    const leftDamage = context.getLeftDamage?.() ?? context.leftDamage;
    const rightDamage = context.getRightDamage?.() ?? context.rightDamage;

    // Determine winner using isWinner flag or vote counts as fallback
    let winnerIsLeft: boolean;
    if (leftBattler?.isWinner) {
      winnerIsLeft = true;
    } else if (rightBattler?.isWinner) {
      winnerIsLeft = false;
    } else {
      // Fallback: use vote counts
      const leftVotes = leftBattler?.voteCount || 0;
      const rightVotes = rightBattler?.voteCount || 0;
      winnerIsLeft = leftVotes > rightVotes;
      console.warn("[attackKOAnimation] isWinner not set, using vote counts as fallback");
    }

    const loserIsLeft = !winnerIsLeft;
    const loser = loserIsLeft ? leftBattler : rightBattler;
    const damage = winnerIsLeft ? rightDamage : leftDamage;
    const direction = winnerIsLeft ? 1 : -1;

    const winnerRef = winnerIsLeft ? context.refs.leftFighter : context.refs.rightFighter;
    const loserRef = winnerIsLeft ? context.refs.rightFighter : context.refs.leftFighter;
    const arenaWidth = context.refs.arena.current?.clientWidth || 800;
    const offscreenDist = arenaWidth * 1.2;

    // Set attacking state
    context.setFighterState?.(winnerIsLeft ? "left" : "right", "attacking");

    // Timeline completes AFTER spin-off + KO display
    const attackTimeline = gsap.timeline({
      onComplete: () => {
        context.setTieMessage?.(null); // Clear KO message
        context.setFighterState?.(loserIsLeft ? "left" : "right", "ko");
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Quick lunge
    attackTimeline.to(winnerRef.current, {
      x: direction * 150,
      duration: TIMINGS.attackLunge,
      ease: "power2.in",
    });

    attackTimeline.to(winnerRef.current, {
      x: direction * 100,
      duration: TIMINGS.attackReturn,
      ease: "power2.out",
    });

    // Hurt flash on loser + damage callback
    attackTimeline.call(
      () => {
        const loserSide = winnerIsLeft ? "right" : "left";
        console.log(`[attackKOAnimation] Applying ${damage} KO damage to ${loserSide}`);
        context.setFighterState?.(loserSide, "hurt");
        context.onDamageApplied?.(loserSide, damage);
      },
      [],
      `+=${TIMINGS.damageDelay}`
    );

    // Loser spins off screen
    attackTimeline.to(
      loserRef.current,
      {
        x: direction * offscreenDist,
        rotation: direction * 720,
        opacity: 0,
        duration: TIMINGS.koSpinOff,
        ease: "power2.in",
      },
      `+=${TIMINGS.koDelay}`
    );

    // Show BIG K.O. message after spin-off
    attackTimeline.call(
      () => {
        console.log(`[attackKOAnimation] Showing K.O. message for ${loser?.name}`);
        context.setTieMessage?.(`K.O.`);
      },
      [],
      "+=0.1" // Small delay after spin starts
    );

    // Hold K.O. message for dramatic effect
    attackTimeline.to({}, { duration: 1.35 });

    return attackTimeline;
  },
};

/**
 * attackComboKOAnimation - FINISHER attack (3-win streak = instant KO)
 *
 * Flow:
 * 1. Show "FINISHER!" message with dramatic golden styling
 * 2. Extended KO attack with more dramatic effects
 * 3. Clear finisher message
 *
 * Total duration: ~3.5s (extended for dramatic effect)
 */
export const attackComboKOAnimation: AnimationDefinition = {
  id: "attack-combo-ko",
  name: "Finisher Attack",
  category: "effect",
  duration: 3.5, // Extended duration for dramatic FINISHER
  canRunInParallel: false,
  priority: 20, // Highest priority
  tags: ["attack", "ko", "combo", "finisher"],

  create: (context) => {
    // Use getter functions for CURRENT data (not stale captured values)
    const leftBattler = context.getLeftBattler?.() ?? context.leftBattler;
    const rightBattler = context.getRightBattler?.() ?? context.rightBattler;
    const leftDamage = context.getLeftDamage?.() ?? context.leftDamage;
    const rightDamage = context.getRightDamage?.() ?? context.rightDamage;

    // Determine winner using isWinner flag or vote counts as fallback
    let winnerIsLeft: boolean;
    if (leftBattler?.isWinner) {
      winnerIsLeft = true;
    } else if (rightBattler?.isWinner) {
      winnerIsLeft = false;
    } else {
      // Fallback: use vote counts
      const leftVotes = leftBattler?.voteCount || 0;
      const rightVotes = rightBattler?.voteCount || 0;
      winnerIsLeft = leftVotes > rightVotes;
      console.warn("[attackComboKOAnimation] isWinner not set, using vote counts as fallback");
    }

    const winner = winnerIsLeft ? leftBattler : rightBattler;
    const loser = winnerIsLeft ? rightBattler : leftBattler;
    const damage = winnerIsLeft ? rightDamage : leftDamage;
    const direction = winnerIsLeft ? 1 : -1;

    const winnerRef = winnerIsLeft ? context.refs.leftFighter : context.refs.rightFighter;
    const loserRef = winnerIsLeft ? context.refs.rightFighter : context.refs.leftFighter;
    const arenaWidth = context.refs.arena.current?.clientWidth || 800;
    const offscreenDist = arenaWidth * 1.2;

    console.log(`[FINISHER TRIGGERED!] ${winner?.name} with 3-win streak!`);

    // Show FINISHER message (will be styled golden in BattleLayout)
    context.setTieMessage?.("FINISHER!");

    // Set attacking state
    context.setFighterState?.(winnerIsLeft ? "left" : "right", "attacking");

    const timeline = gsap.timeline({
      onComplete: () => {
        context.setTieMessage?.(null);
        context.setFighterState?.(winnerIsLeft ? "right" : "left", "ko");
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Hold FINISHER message for dramatic effect
    timeline.to({}, { duration: 1.0 });

    // Quick dramatic lunge (faster than normal)
    timeline.to(winnerRef.current, {
      x: direction * 200, // Bigger lunge for finisher
      duration: 0.2,
      ease: "power3.in",
    });

    // Return with power
    timeline.to(winnerRef.current, {
      x: direction * 150,
      duration: 0.15,
      ease: "power2.out",
    });

    // Hurt flash on loser + damage callback
    timeline.call(
      () => {
        const loserSide = winnerIsLeft ? "right" : "left";
        console.log(`[FINISHER] Applying instant KO damage to ${loserSide}`);
        context.setFighterState?.(loserSide, "hurt");
        context.onDamageApplied?.(loserSide, damage);
      },
      [],
      "+=0.05"
    );

    // Loser spins off screen dramatically
    timeline.to(
      loserRef.current,
      {
        x: direction * offscreenDist,
        rotation: direction * 1080, // More spins for finisher (3 rotations)
        opacity: 0,
        scale: 0.5, // Shrink as they fly off
        duration: 0.9,
        ease: "power2.in",
      },
      "+=0.1"
    );

    // Return winner to position
    timeline.to(winnerRef.current, {
      x: 0,
      duration: 0.3,
      ease: "power2.out",
    }, "-=0.4");

    // Hold for dramatic effect after KO
    timeline.to({}, { duration: 0.8 });

    return timeline;
  },

  onStart: (context) => {
    // Use vote counts as fallback if isWinner not set
    let winner;
    if (context.leftBattler?.isWinner) {
      winner = context.leftBattler;
    } else if (context.rightBattler?.isWinner) {
      winner = context.rightBattler;
    } else {
      const leftVotes = context.leftBattler?.voteCount || 0;
      const rightVotes = context.rightBattler?.voteCount || 0;
      winner = leftVotes > rightVotes ? context.leftBattler : context.rightBattler;
    }
    console.log(`[FINISHER] ${winner?.name} lands the FINISHER!`);
  },
};

/**
 * attackTieAnimation - Tie attack when both players receive equal votes
 *
 * Flow:
 * 1. Both players lunge forward simultaneously (0.15s)
 * 2. Both return to position (0.2s)
 * 3. Both show hurt flash
 * 4. Damage is applied to both
 *
 * Total duration: ~0.35s
 */
export const attackTieAnimation: AnimationDefinition = {
  id: "attack-tie",
  name: "Tie Attack",
  category: "battle",
  duration: 0.35,
  canRunInParallel: true,
  priority: 1,
  tags: ["attack", "tie", "damage"],

  create: (context) => {
    // Use getter functions for CURRENT data (not stale captured values)
    const leftDamage = context.getLeftDamage?.() ?? context.leftDamage;
    const rightDamage = context.getRightDamage?.() ?? context.rightDamage;

    const leftRef = context.refs.leftFighter;
    const rightRef = context.refs.rightFighter;

    const timeline = gsap.timeline({
      onComplete: () => {
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Set both to attacking state
    context.setFighterState?.("left", "attacking");
    context.setFighterState?.("right", "attacking");

    // Both lunge forward simultaneously
    timeline.to(
      leftRef.current,
      {
        x: 100, // Left player moves right
        duration: 0.15,
        ease: "power2.in",
      },
      0 // Start at time 0
    );

    timeline.to(
      rightRef.current,
      {
        x: -100, // Right player moves left
        duration: 0.15,
        ease: "power2.in",
      },
      0 // Start at time 0 (parallel with left)
    );

    // Both return to position
    timeline.to(
      leftRef.current,
      {
        x: 0,
        duration: 0.2,
        ease: "power2.out",
      },
      0.15 // Start after lunge
    );

    timeline.to(
      rightRef.current,
      {
        x: 0,
        duration: 0.2,
        ease: "power2.out",
      },
      0.15 // Start after lunge (parallel with left)
    );

    // Hurt flash + damage callback for both
    timeline.call(
      () => {
        // Both take damage
        console.log(`[attackTieAnimation] Applying damage - Left: ${leftDamage}, Right: ${rightDamage}`);
        context.setFighterState?.("left", "hurt");
        context.setFighterState?.("right", "hurt");
        context.onDamageApplied?.("left", leftDamage);
        context.onDamageApplied?.("right", rightDamage);

        // Return both to idle after hurt flash
        setTimeout(() => {
          context.setFighterState?.("left", "idle");
          context.setFighterState?.("right", "idle");
        }, 200);
      },
      [],
      "+=0.05"
    ); // Happens 0.2s total from start (0.15s lunge + 0.05s)

    return timeline;
  },

  onStart: (context) => {
    console.log(
      `[attackTieAnimation] Tie battle! Both players take damage: Left ${context.leftDamage}, Right ${context.rightDamage}`
    );
  },
};

// Auto-register all attack animations
animationRegistry.register(attackNormalAnimation);
animationRegistry.register(attackKOAnimation);
animationRegistry.register(attackComboKOAnimation);
animationRegistry.register(attackTieAnimation);
