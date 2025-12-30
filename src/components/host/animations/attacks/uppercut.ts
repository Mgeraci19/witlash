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
 * Classic uppercut - Shoryuken style
 *
 * Sequence:
 * 1. Crouch down low
 * 2. Explosive upward thrust forward
 * 3. Impact - defender launched upward
 * 4. Float down and recover
 */
export const uppercutAnimation: AnimationDefinition = {
  id: "uppercut",
  name: "Uppercut",
  category: "attack",
  duration: 0.9,

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
      console.warn("[uppercutAnimation] No attacker element found");
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Step 1: Crouch down low
    timeline.to(attackerEl, {
      y: 30,
      scaleY: 0.75,
      scaleX: 1.1,
      x: -10 * direction,
      duration: 0.15 * speed,
      ease: "power2.in",
    });

    // Step 2: Explosive upward thrust
    timeline.to(attackerEl, {
      y: -100,
      x: 80 * direction,
      scaleY: 1.2,
      scaleX: 0.9,
      rotation: 5 * direction,
      duration: 0.15 * speed,
      ease: "power4.out",
    });

    // Step 3: Impact
    timeline.call(() => {
      onImpact?.();
    });

    // Defender launched upward
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          y: -80,
          rotation: -20 * direction,
          duration: 0.2 * speed,
          ease: "power2.out",
        },
        "<"
      );

      // Defender falls back down
      timeline.to(defenderEl, {
        y: 0,
        rotation: 0,
        duration: 0.3 * speed,
        ease: "bounce.out",
      });
    }

    // Step 4: Attacker floats and recovers
    timeline.to(
      attackerEl,
      {
        y: -60,
        duration: 0.15 * speed,
        ease: "power1.out",
      },
      "-=0.3"
    );

    timeline.to(attackerEl, {
      y: 0,
      x: 0,
      scale: 1,
      rotation: 0,
      duration: 0.25 * speed,
      ease: "power2.in",
    });

    return timeline;
  },
};

/**
 * Dragon uppercut - spinning variation with multiple hits
 */
export const dragonUppercutAnimation: AnimationDefinition = {
  id: "dragon-uppercut",
  name: "Dragon Uppercut",
  category: "attack",
  duration: 1.1,

  create: (context: AnimationContext) => {
    const {
      attacker,
      defender,
      attackerSide,
      arenaContainer,
      onImpact,
      speedMultiplier = 1,
      shakeIntensity = 1,
    } = context;

    const attackerEl = resolveTarget(attacker);
    const defenderEl = resolveTarget(defender);
    const arenaEl = resolveTarget(arenaContainer);

    if (!attackerEl) {
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Deep crouch
    timeline.to(attackerEl, {
      y: 40,
      scaleY: 0.65,
      scaleX: 1.15,
      duration: 0.2 * speed,
      ease: "power3.in",
    });

    // Launch with spin
    timeline.to(attackerEl, {
      y: -120,
      x: 60 * direction,
      scaleY: 1.1,
      scaleX: 0.95,
      rotation: 180 * direction,
      duration: 0.2 * speed,
      ease: "power4.out",
    });

    // Continue spin and forward
    timeline.to(attackerEl, {
      y: -140,
      x: 100 * direction,
      rotation: 360 * direction,
      duration: 0.15 * speed,
      ease: "power2.out",
    });

    // Impact at peak
    timeline.call(() => {
      onImpact?.();

      // Quick screen flash/shake
      if (arenaEl) {
        gsap.to(arenaEl, {
          y: -5 * shakeIntensity,
          duration: 0.02,
          yoyo: true,
          repeat: 3,
          onComplete: () => { gsap.set(arenaEl, { y: 0 }); },
        });
      }
    });

    // Defender reaction
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          y: -100,
          rotation: -30 * direction,
          scale: 0.95,
          duration: 0.25 * speed,
          ease: "power2.out",
        },
        "-=0.15"
      );

      // Defender crash down
      timeline.to(defenderEl, {
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.35 * speed,
        ease: "bounce.out",
      });
    }

    // Attacker descend with style
    timeline.to(
      attackerEl,
      {
        y: -80,
        x: 80 * direction,
        rotation: 450 * direction,
        duration: 0.15 * speed,
        ease: "power1.in",
      },
      "-=0.35"
    );

    timeline.to(attackerEl, {
      y: 0,
      x: 0,
      rotation: 540 * direction, // End upright (540 = 360 + 180)
      scale: 1,
      duration: 0.25 * speed,
      ease: "power2.in",
    });

    // Reset rotation (since we ended at 540)
    timeline.set(attackerEl, { rotation: 0 });

    return timeline;
  },
};
