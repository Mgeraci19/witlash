import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";

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
    const winnerIsLeft = context.leftBattler?.isWinner ?? false;
    const winner = winnerIsLeft ? context.leftBattler : context.rightBattler;
    const loser = winnerIsLeft ? context.rightBattler : context.leftBattler;
    const damage = winnerIsLeft ? context.rightDamage : context.leftDamage;
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
  duration: 1.05, // 0.25s attack + 0.8s spin-off
  canRunInParallel: false,
  priority: 10, // Higher priority than normal attack
  tags: ["attack", "ko"],

  create: (context) => {
    const winnerIsLeft = context.leftBattler?.isWinner ?? false;
    const damage = winnerIsLeft ? context.rightDamage : context.leftDamage;
    const direction = winnerIsLeft ? 1 : -1;

    const winnerRef = winnerIsLeft ? context.refs.leftFighter : context.refs.rightFighter;
    const loserRef = winnerIsLeft ? context.refs.rightFighter : context.refs.leftFighter;
    const arenaWidth = context.refs.arena.current?.clientWidth || 800;
    const offscreenDist = arenaWidth * 1.2;

    // Set attacking state
    context.setFighterState?.(winnerIsLeft ? "left" : "right", "attacking");

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
            context.setFighterState?.(winnerIsLeft ? "right" : "left", "ko");
            context.setPhase?.("complete");
            context.onComplete?.();
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

    // Hurt flash on loser + damage callback
    attackTimeline.call(
      () => {
        const loserSide = winnerIsLeft ? "right" : "left";
        context.setFighterState?.(loserSide, "hurt");
        context.onDamageApplied?.(loserSide, damage);
      },
      [],
      "+=0.05"
    );

    return attackTimeline;
  },
};

/**
 * attackComboKOAnimation - Combo KO attack (3-win streak = instant KO)
 *
 * Flow:
 * 1. Show "COMBO x3 INSTANT KO!" message
 * 2. Same as KO attack
 * 3. Clear combo message
 *
 * Total duration: ~1.05s (same as KO but with message overlay)
 */
export const attackComboKOAnimation: AnimationDefinition = {
  id: "attack-combo-ko",
  name: "Combo KO Attack",
  category: "effect",
  duration: 1.05,
  canRunInParallel: false,
  priority: 20, // Highest priority
  tags: ["attack", "ko", "combo"],

  create: (context) => {
    const winnerIsLeft = context.leftBattler?.isWinner ?? false;
    const winner = winnerIsLeft ? context.leftBattler : context.rightBattler;
    const winnerStreak = winner?.winStreak || 0;

    console.log(
      `[COMBO KO TRIGGERED!] ${winner?.name} with ${winnerStreak + 1}-win streak!`
    );

    // Show combo message
    context.setTieMessage?.(`COMBO x${winnerStreak + 1} INSTANT KO!`);

    // Use the KO animation
    const koTimeline = attackKOAnimation.create(context);

    // Wrap it to clear the message when complete
    const originalOnComplete = koTimeline.eventCallback("onComplete");
    koTimeline.eventCallback("onComplete", () => {
      context.setTieMessage?.(null);
      if (typeof originalOnComplete === "function") {
        originalOnComplete();
      }
    });

    return koTimeline;
  },

  onStart: (context) => {
    const winner = context.leftBattler?.isWinner
      ? context.leftBattler
      : context.rightBattler;
    console.log(`[attackComboKOAnimation] Combo KO by ${winner?.name}!`);
  },
};

// Auto-register all attack animations
animationRegistry.register(attackNormalAnimation);
animationRegistry.register(attackKOAnimation);
animationRegistry.register(attackComboKOAnimation);
