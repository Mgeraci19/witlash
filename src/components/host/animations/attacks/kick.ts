import { gsap } from "../gsapConfig";
import {
  AnimationDefinition,
  AnimationContext,
} from "../registry/types";

/**
 * Resolves an animation target to a DOM element
 */
function resolveTarget(target: AnimationContext["attacker"] | undefined): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (typeof target === "string") return document.querySelector(target);
  if ("current" in target) return target.current;
  return null;
}

/**
 * Roundhouse kick animation
 *
 * Sequence:
 * 1. Crouch and rotate back (windup)
 * 2. Spin and lunge forward
 * 3. Impact with rotation
 * 4. Land and recover
 */
export const kickAnimation: AnimationDefinition = {
  id: "kick",
  name: "Roundhouse Kick",
  category: "attack",
  duration: 0.7,

  create: (context: AnimationContext) => {
    const {
      attacker,
      defender,
      attackerSide,
      onImpact,
      speedMultiplier = 1,
    } = context;

    const attackerEl = resolveTarget(attacker);
    const defenderEl = resolveTarget(defender);

    if (!attackerEl) {
      console.warn("[kickAnimation] No attacker element found");
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Step 1: Crouch and rotate back
    timeline.to(attackerEl, {
      x: -15 * direction,
      rotation: -15 * direction,
      scaleY: 0.9,
      duration: 0.12 * speed,
      ease: "power2.in",
    });

    // Step 2: Spin forward with kick
    timeline.to(attackerEl, {
      x: 100 * direction,
      rotation: 20 * direction,
      scaleY: 1,
      duration: 0.18 * speed,
      ease: "power3.out",
    });

    // Step 3: Impact
    timeline.call(() => {
      onImpact?.();
    });

    // Defender spin reaction
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          x: 25 * direction,
          rotation: -15 * direction,
          duration: 0.1 * speed,
          ease: "power2.out",
        },
        "<"
      );
      timeline.to(defenderEl, {
        x: 0,
        rotation: 0,
        duration: 0.2 * speed,
        ease: "power1.out",
      });
    }

    // Step 4: Land and recover
    timeline.to(
      attackerEl,
      {
        x: 20 * direction,
        rotation: 5 * direction,
        scaleY: 0.95,
        duration: 0.1 * speed,
        ease: "power2.in",
      },
      "-=0.1"
    );

    timeline.to(attackerEl, {
      x: 0,
      rotation: 0,
      scaleY: 1,
      duration: 0.2 * speed,
      ease: "power2.out",
    });

    return timeline;
  },
};

/**
 * Low sweep kick - quick and low
 */
export const sweepKickAnimation: AnimationDefinition = {
  id: "sweep-kick",
  name: "Sweep Kick",
  category: "attack",
  duration: 0.55,

  create: (context: AnimationContext) => {
    const {
      attacker,
      defender,
      attackerSide,
      onImpact,
      speedMultiplier = 1,
    } = context;

    const attackerEl = resolveTarget(attacker);
    const defenderEl = resolveTarget(defender);

    if (!attackerEl) {
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Quick crouch
    timeline.to(attackerEl, {
      scaleY: 0.7,
      y: 20,
      duration: 0.08 * speed,
    });

    // Sweep forward
    timeline.to(attackerEl, {
      x: 80 * direction,
      rotation: 10 * direction,
      duration: 0.15 * speed,
      ease: "power3.out",
    });

    // Impact
    timeline.call(() => {
      onImpact?.();
    });

    // Defender staggers
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          y: -10,
          rotation: -8 * direction,
          duration: 0.08 * speed,
        },
        "<"
      );
      timeline.to(defenderEl, {
        y: 0,
        rotation: 0,
        duration: 0.15 * speed,
        ease: "bounce.out",
      });
    }

    // Recover
    timeline.to(attackerEl, {
      x: 0,
      y: 0,
      rotation: 0,
      scaleY: 1,
      duration: 0.2 * speed,
      ease: "power2.out",
    });

    return timeline;
  },
};
