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
 * Overhead slam animation
 *
 * Sequence:
 * 1. Jump up and wind up
 * 2. Crash down onto defender
 * 3. Impact with screen shake
 * 4. Bounce recovery
 */
export const slamAnimation: AnimationDefinition = {
  id: "slam",
  name: "Overhead Slam",
  category: "attack",
  duration: 0.85,

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
      console.warn("[slamAnimation] No attacker element found");
      return gsap.timeline();
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: context.onComplete,
    });

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Step 1: Jump up and wind up
    timeline.to(attackerEl, {
      y: -80,
      x: 40 * direction,
      scale: 1.1,
      rotation: -10 * direction,
      duration: 0.2 * speed,
      ease: "power2.out",
    });

    // Hold at peak briefly
    timeline.to(attackerEl, {
      y: -85,
      duration: 0.05 * speed,
      ease: "power1.out",
    });

    // Step 2: Crash down
    timeline.to(attackerEl, {
      y: 0,
      x: 100 * direction,
      scale: 1.15,
      rotation: 5 * direction,
      duration: 0.12 * speed,
      ease: "power4.in",
    });

    // Step 3: Impact with screen shake
    timeline.call(() => {
      onImpact?.();

      // Heavy screen shake
      if (arenaEl) {
        gsap.to(arenaEl, {
          y: 12 * shakeIntensity,
          duration: 0.03,
          yoyo: true,
          repeat: 5,
          ease: "power1.inOut",
          onComplete: () => { gsap.set(arenaEl, { y: 0 }); },
        });
      }
    });

    // Squash on impact
    timeline.to(attackerEl, {
      scaleX: 1.2,
      scaleY: 0.85,
      duration: 0.05 * speed,
    });

    // Defender gets crushed down
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          y: 15,
          scaleY: 0.85,
          duration: 0.08 * speed,
        },
        "<"
      );
      timeline.to(defenderEl, {
        y: -5,
        scaleY: 1.05,
        duration: 0.1 * speed,
      });
      timeline.to(defenderEl, {
        y: 0,
        scaleY: 1,
        duration: 0.15 * speed,
        ease: "bounce.out",
      });
    }

    // Step 4: Bounce recovery
    timeline.to(
      attackerEl,
      {
        scaleX: 0.95,
        scaleY: 1.1,
        y: -20,
        duration: 0.1 * speed,
      },
      "-=0.1"
    );

    timeline.to(attackerEl, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: 0.25 * speed,
      ease: "power2.out",
    });

    return timeline;
  },
};

/**
 * Ground pound - multiple impacts
 */
export const groundPoundAnimation: AnimationDefinition = {
  id: "ground-pound",
  name: "Ground Pound",
  category: "attack",
  duration: 1.0,

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

    // Jump forward
    timeline.to(attackerEl, {
      x: 80 * direction,
      y: -60,
      scale: 1.1,
      duration: 0.15 * speed,
      ease: "power2.out",
    });

    // Slam down - hit 1
    timeline.to(attackerEl, {
      y: 0,
      scale: 1.2,
      duration: 0.1 * speed,
      ease: "power4.in",
    });

    timeline.call(() => {
      if (arenaEl) {
        gsap.to(arenaEl, {
          y: 8 * shakeIntensity,
          duration: 0.02,
          yoyo: true,
          repeat: 2,
          onComplete: () => { gsap.set(arenaEl, { y: 0 }); },
        });
      }
    });

    // Small bounce up
    timeline.to(attackerEl, {
      y: -30,
      scale: 1.05,
      duration: 0.08 * speed,
    });

    // Slam again - hit 2
    timeline.to(attackerEl, {
      y: 0,
      scale: 1.15,
      duration: 0.08 * speed,
      ease: "power4.in",
    });

    timeline.call(() => {
      if (arenaEl) {
        gsap.to(arenaEl, {
          y: 10 * shakeIntensity,
          duration: 0.02,
          yoyo: true,
          repeat: 3,
          onComplete: () => { gsap.set(arenaEl, { y: 0 }); },
        });
      }
    });

    // Final big bounce up
    timeline.to(attackerEl, {
      y: -40,
      scale: 1.1,
      duration: 0.1 * speed,
    });

    // Final slam - hit 3 (main impact)
    timeline.to(attackerEl, {
      y: 0,
      scale: 1.25,
      x: 100 * direction,
      duration: 0.1 * speed,
      ease: "power4.in",
    });

    timeline.call(() => {
      onImpact?.();

      if (arenaEl) {
        gsap.to(arenaEl, {
          y: 15 * shakeIntensity,
          duration: 0.03,
          yoyo: true,
          repeat: 5,
          onComplete: () => { gsap.set(arenaEl, { y: 0 }); },
        });
      }
    });

    // Defender reaction
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          y: 25,
          scaleY: 0.8,
          duration: 0.1 * speed,
        },
        "<"
      );
      timeline.to(defenderEl, {
        y: -10,
        scaleY: 1.1,
        duration: 0.15 * speed,
      });
      timeline.to(defenderEl, {
        y: 0,
        scaleY: 1,
        duration: 0.2 * speed,
        ease: "bounce.out",
      });
    }

    // Recovery
    timeline.to(
      attackerEl,
      {
        x: 0,
        scale: 1,
        duration: 0.25 * speed,
        ease: "power2.out",
      },
      "-=0.2"
    );

    return timeline;
  },
};
