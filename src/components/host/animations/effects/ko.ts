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
 * Creates KO text element
 */
function createKOText(container: HTMLElement): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = "K.O.";
  el.className = "ko-text";
  el.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) scale(0);
    font-family: 'Impact', 'Arial Black', sans-serif;
    font-size: 8rem;
    font-weight: bold;
    color: #ff0000;
    text-shadow:
      -4px -4px 0 #000,
      4px -4px 0 #000,
      -4px 4px 0 #000,
      4px 4px 0 #000,
      0 0 40px rgba(255,0,0,0.8);
    z-index: 1002;
    pointer-events: none;
    user-select: none;
    letter-spacing: 0.2em;
  `;
  container.appendChild(el);
  return el;
}

/**
 * Classic KO animation - loser spins off screen
 *
 * Sequence:
 * 1. Winner delivers final blow lunge
 * 2. Loser staggers
 * 3. K.O. text appears
 * 4. Loser spins off screen
 * 5. Winner returns to center with victory pose
 */
export const koAnimation: AnimationDefinition = {
  id: "ko",
  name: "Knockout",
  category: "effect",
  duration: 2.5,

  create: (context: AnimationContext, options?: AnimationOptions) => {
    const {
      attacker,
      defender,
      attackerSide,
      arenaContainer,
      onImpact,
      speedMultiplier = 1,
      shakeIntensity = 1,
    } = context;

    const winnerEl = resolveTarget(attacker);
    const loserEl = resolveTarget(defender);
    const arenaEl = resolveTarget(arenaContainer);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!winnerEl || !loserEl) {
      console.warn("[koAnimation] Missing winner or loser element");
      return timeline;
    }

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Step 1: Winner final blow lunge
    timeline.to(winnerEl, {
      x: 150 * direction,
      scaleX: 1.15,
      duration: 0.2 * speed,
      ease: "power4.out",
    });

    // Impact callback
    timeline.call(() => {
      onImpact?.();
    });

    // Step 2: Loser staggers back
    timeline.to(
      loserEl,
      {
        x: 50 * direction,
        rotation: -10 * direction,
        duration: 0.15 * speed,
      },
      "<"
    );

    // Loser recoils forward
    timeline.to(loserEl, {
      x: 30 * direction,
      rotation: 15 * direction,
      duration: 0.1 * speed,
    });

    // Screen shake
    if (arenaEl) {
      timeline.call(
        () => {
          gsap.to(arenaEl, {
            x: 15 * shakeIntensity,
            duration: 0.04,
            yoyo: true,
            repeat: 5,
            ease: "power1.inOut",
            onComplete: () => { gsap.set(arenaEl, { x: 0 }); },
          });
        },
        [],
        "<"
      );
    }

    // Loser wobbles
    timeline.to(loserEl, {
      x: 40 * direction,
      rotation: -5 * direction,
      scaleY: 0.95,
      duration: 0.2 * speed,
    });

    // Step 3: K.O. text appears
    if (arenaEl) {
      const koText = createKOText(arenaEl);

      // Pop in with shake
      timeline.to(koText, {
        scale: 1.2,
        duration: 0.2 * speed,
        ease: "back.out(2)",
      });

      timeline.to(koText, {
        scale: 1,
        rotation: -3,
        duration: 0.1 * speed,
      });

      timeline.to(koText, {
        rotation: 3,
        duration: 0.1 * speed,
      });

      timeline.to(koText, {
        rotation: 0,
        duration: 0.1 * speed,
      });

      // Hold K.O. text
      timeline.to(koText, {
        duration: 0.5 * speed,
      });

      // Step 4: Loser spins off screen
      timeline.to(
        loserEl,
        {
          x: 800 * direction,
          y: 100,
          rotation: 720 * direction,
          scale: 0.3,
          opacity: 0,
          duration: 0.8 * speed,
          ease: "power2.in",
        },
        "-=0.3"
      );

      // Fade out K.O. text
      timeline.to(
        koText,
        {
          opacity: 0,
          scale: 1.5,
          duration: 0.4 * speed,
          ease: "power2.out",
          onComplete: () => {
            koText.remove();
          },
        },
        "-=0.4"
      );
    } else {
      // No arena, just spin off
      timeline.to(loserEl, {
        x: 800 * direction,
        y: 100,
        rotation: 720 * direction,
        scale: 0.3,
        opacity: 0,
        duration: 0.8 * speed,
        ease: "power2.in",
      });
    }

    // Step 5: Winner returns with victory pose
    timeline.to(
      winnerEl,
      {
        x: 0,
        scale: 1.1,
        duration: 0.3 * speed,
        ease: "power2.out",
      },
      "-=0.3"
    );

    // Winner bounce
    timeline.to(winnerEl, {
      scaleY: 0.95,
      scaleX: 1.05,
      duration: 0.1 * speed,
    });

    timeline.to(winnerEl, {
      scale: 1,
      duration: 0.2 * speed,
      ease: "elastic.out(1, 0.5)",
    });

    return timeline;
  },
};

/**
 * Double KO animation - both fighters knocked out (tie)
 */
export const doubleKOAnimation: AnimationDefinition = {
  id: "double-ko",
  name: "Double KO",
  category: "effect",
  duration: 2.0,

  create: (context: AnimationContext) => {
    const {
      attacker,
      defender,
      arenaContainer,
      speedMultiplier = 1,
      shakeIntensity = 1,
    } = context;

    const fighter1 = resolveTarget(attacker);
    const fighter2 = resolveTarget(defender);
    const arenaEl = resolveTarget(arenaContainer);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!fighter1 || !fighter2) {
      return timeline;
    }

    const speed = 1 / speedMultiplier;

    // Both fighters stagger toward each other
    timeline.to(fighter1, {
      x: 50,
      rotation: 10,
      duration: 0.15 * speed,
    });

    timeline.to(
      fighter2,
      {
        x: -50,
        rotation: -10,
        duration: 0.15 * speed,
      },
      "<"
    );

    // Both collide and recoil
    timeline.to(fighter1, {
      x: -30,
      rotation: -15,
      duration: 0.1 * speed,
    });

    timeline.to(
      fighter2,
      {
        x: 30,
        rotation: 15,
        duration: 0.1 * speed,
      },
      "<"
    );

    // Screen shake
    if (arenaEl) {
      timeline.call(() => {
        gsap.to(arenaEl, {
          x: 20 * shakeIntensity,
          duration: 0.03,
          yoyo: true,
          repeat: 7,
          onComplete: () => { gsap.set(arenaEl, { x: 0 }); },
        });
      });

      // DRAW text
      const drawText = document.createElement("div");
      drawText.textContent = "DRAW!";
      drawText.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        font-family: 'Impact', 'Arial Black', sans-serif;
        font-size: 6rem;
        font-weight: bold;
        color: #888888;
        text-shadow:
          -3px -3px 0 #000,
          3px -3px 0 #000,
          -3px 3px 0 #000,
          3px 3px 0 #000;
        z-index: 1002;
        pointer-events: none;
      `;
      arenaEl.appendChild(drawText);

      timeline.to(drawText, {
        scale: 1,
        duration: 0.3 * speed,
        ease: "back.out(2)",
      });

      timeline.to(drawText, {
        duration: 0.8 * speed,
      });

      timeline.to(drawText, {
        opacity: 0,
        duration: 0.3 * speed,
        onComplete: () => {
          drawText.remove();
        },
      });
    }

    // Both fighters wobble in place
    timeline.to(
      fighter1,
      {
        rotation: "+=5",
        duration: 0.15 * speed,
        yoyo: true,
        repeat: 3,
      },
      "-=1"
    );

    timeline.to(
      fighter2,
      {
        rotation: "-=5",
        duration: 0.15 * speed,
        yoyo: true,
        repeat: 3,
      },
      "<"
    );

    // Reset positions
    timeline.to(fighter1, {
      x: 0,
      rotation: 0,
      duration: 0.3 * speed,
      ease: "power2.out",
    });

    timeline.to(
      fighter2,
      {
        x: 0,
        rotation: 0,
        duration: 0.3 * speed,
        ease: "power2.out",
      },
      "<"
    );

    return timeline;
  },
};

/**
 * Dramatic slow-mo KO - for final round
 */
export const dramaticKOAnimation: AnimationDefinition = {
  id: "dramatic-ko",
  name: "Dramatic KO",
  category: "effect",
  duration: 3.5,

  create: (context: AnimationContext) => {
    const {
      attacker,
      defender,
      attackerSide,
      arenaContainer,
      onImpact,
      shakeIntensity = 1,
    } = context;

    const winnerEl = resolveTarget(attacker);
    const loserEl = resolveTarget(defender);
    const arenaEl = resolveTarget(arenaContainer);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!winnerEl || !loserEl) {
      return timeline;
    }

    const direction = attackerSide === "left" ? 1 : -1;

    // Slow-mo wind up
    timeline.to(winnerEl, {
      x: -60 * direction,
      scaleY: 0.85,
      scaleX: 1.1,
      duration: 0.8, // Slow
      ease: "power2.in",
    });

    // Flash white briefly (freeze frame effect)
    if (arenaEl) {
      const flash = document.createElement("div");
      flash.style.cssText = `
        position: absolute;
        inset: 0;
        background: white;
        opacity: 0;
        z-index: 1001;
        pointer-events: none;
      `;
      arenaEl.appendChild(flash);

      timeline.to(flash, {
        opacity: 0.8,
        duration: 0.05,
      });

      timeline.to(flash, {
        opacity: 0,
        duration: 0.15,
        onComplete: () => flash.remove(),
      });
    }

    // EXPLOSIVE forward motion
    timeline.to(winnerEl, {
      x: 200 * direction,
      scaleY: 1.2,
      scaleX: 0.9,
      duration: 0.15,
      ease: "power4.out",
    });

    timeline.call(() => {
      onImpact?.();
    });

    // Massive screen shake
    if (arenaEl) {
      timeline.call(() => {
        gsap.to(arenaEl, {
          x: 25 * shakeIntensity,
          y: 15 * shakeIntensity,
          duration: 0.03,
          yoyo: true,
          repeat: 10,
          onComplete: () => { gsap.set(arenaEl, { x: 0, y: 0 }); },
        });
      });

      // Dramatic K.O. text with color
      const koText = createKOText(arenaEl);
      koText.style.fontSize = "10rem";
      koText.style.color = "#ff0000";

      timeline.to(koText, {
        scale: 1.5,
        duration: 0.3,
        ease: "elastic.out(1, 0.3)",
      });

      timeline.to(koText, {
        scale: 1.3,
        duration: 0.2,
      });

      // Hold
      timeline.to(koText, {
        duration: 0.8,
      });

      // Fade out
      timeline.to(koText, {
        opacity: 0,
        y: "-=50",
        duration: 0.4,
        onComplete: () => koText.remove(),
      });
    }

    // Loser dramatic spin off
    timeline.to(
      loserEl,
      {
        x: 1000 * direction,
        y: 200,
        rotation: 1080 * direction, // 3 full rotations
        scale: 0.2,
        opacity: 0,
        duration: 1.2,
        ease: "power2.in",
      },
      "-=1"
    );

    // Winner victory
    timeline.to(
      winnerEl,
      {
        x: 0,
        scale: 1.15,
        duration: 0.4,
        ease: "power2.out",
      },
      "-=0.5"
    );

    timeline.to(winnerEl, {
      scaleY: 1,
      scaleX: 1,
      duration: 0.3,
      ease: "elastic.out(1, 0.5)",
    });

    return timeline;
  },
};
