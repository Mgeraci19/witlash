import { gsap } from "../gsapConfig";
import {
  AnimationDefinition,
  AnimationContext,
  AnimationOptions,
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
 * Classic straight punch animation
 *
 * Sequence:
 * 1. Windup - pull back slightly (0.1s)
 * 2. Lunge - dash toward defender (0.15s)
 * 3. Impact - trigger callback + defender recoil
 * 4. Recovery - return to starting position (0.2s)
 */
export const punchAnimation: AnimationDefinition = {
  id: "punch",
  name: "Punch",
  category: "attack",
  duration: 0.6,

  create: (context: AnimationContext, options?: AnimationOptions) => {
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
      console.warn("[punchAnimation] No attacker element found");
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    // Calculate movement direction based on side
    const lungeDistance = 120;
    const windupDistance = 20;
    const direction = attackerSide === "left" ? 1 : -1;

    // Apply speed multiplier
    const speed = 1 / speedMultiplier;

    // Step 1: Windup - pull back slightly
    timeline.to(attackerEl, {
      x: -windupDistance * direction,
      scale: 0.95,
      duration: 0.1 * speed,
      ease: "power1.in",
    });

    // Step 2: Lunge - dash toward defender
    timeline.to(attackerEl, {
      x: lungeDistance * direction,
      scale: 1.05,
      duration: 0.15 * speed,
      ease: "power3.out",
    });

    // Step 3: Impact - callback and defender recoil
    timeline.call(() => {
      onImpact?.();
    });

    // Defender recoil (if defender exists)
    if (defenderEl) {
      // Quick shake on defender
      timeline.to(
        defenderEl,
        {
          x: 15 * direction,
          duration: 0.05 * speed,
          ease: "power1.out",
        },
        "<"
      );
      timeline.to(defenderEl, {
        x: -10 * direction,
        duration: 0.05 * speed,
        ease: "power1.out",
      });
      timeline.to(defenderEl, {
        x: 0,
        duration: 0.1 * speed,
        ease: "power1.out",
      });
    }

    // Step 4: Recovery - return to starting position
    timeline.to(
      attackerEl,
      {
        x: 0,
        scale: 1,
        duration: 0.2 * speed,
        ease: "power2.out",
      },
      defenderEl ? "-=0.1" : undefined
    );

    return timeline;
  },
};

/**
 * Heavy punch - slower but more impactful
 */
export const heavyPunchAnimation: AnimationDefinition = {
  id: "heavy-punch",
  name: "Heavy Punch",
  category: "attack",
  duration: 0.8,

  create: (context: AnimationContext, options?: AnimationOptions) => {
    const {
      attacker,
      defender,
      attackerSide,
      onImpact,
      speedMultiplier = 1,
      shakeIntensity = 1,
    } = context;

    const attackerEl = resolveTarget(attacker);
    const defenderEl = resolveTarget(defender);
    const arenaEl = resolveTarget(context.arenaContainer);

    if (!attackerEl) {
      console.warn("[heavyPunchAnimation] No attacker element found");
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Step 1: Dramatic windup - crouch and pull back
    timeline.to(attackerEl, {
      x: -40 * direction,
      scaleX: 0.9,
      scaleY: 1.1,
      duration: 0.2 * speed,
      ease: "power2.in",
    });

    // Step 2: Explosive lunge
    timeline.to(attackerEl, {
      x: 160 * direction,
      scaleX: 1.15,
      scaleY: 0.9,
      duration: 0.12 * speed,
      ease: "power4.out",
    });

    // Step 3: Impact with screen shake
    timeline.call(() => {
      onImpact?.();

      // Screen shake on arena
      if (arenaEl) {
        gsap.to(arenaEl, {
          x: 8 * shakeIntensity,
          duration: 0.04,
          yoyo: true,
          repeat: 3,
          ease: "power1.inOut",
          onComplete: () => { gsap.set(arenaEl, { x: 0 }); },
        });
      }
    });

    // Defender heavy recoil
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          x: 30 * direction,
          rotation: 5 * direction,
          duration: 0.08 * speed,
          ease: "power2.out",
        },
        "<"
      );
      timeline.to(defenderEl, {
        x: -15 * direction,
        rotation: -3 * direction,
        duration: 0.1 * speed,
      });
      timeline.to(defenderEl, {
        x: 0,
        rotation: 0,
        duration: 0.15 * speed,
        ease: "power1.out",
      });
    }

    // Step 4: Recovery with slight bounce
    timeline.to(
      attackerEl,
      {
        x: -10 * direction,
        scaleX: 1,
        scaleY: 1,
        duration: 0.15 * speed,
        ease: "power2.out",
      },
      "-=0.15"
    );

    timeline.to(attackerEl, {
      x: 0,
      duration: 0.15 * speed,
      ease: "elastic.out(1, 0.5)",
    });

    return timeline;
  },
};
