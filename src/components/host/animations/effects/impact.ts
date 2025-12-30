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
 * Creates a temporary impact text element (POW!, BAM!, etc.)
 */
function createImpactText(
  container: HTMLElement,
  text: string,
  x: number,
  y: number,
  color: string = "#ffff00"
): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.className = "impact-text";
  el.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    transform: translate(-50%, -50%) scale(0);
    font-family: 'Impact', 'Arial Black', sans-serif;
    font-size: 4rem;
    font-weight: bold;
    color: ${color};
    text-shadow:
      -3px -3px 0 #000,
      3px -3px 0 #000,
      -3px 3px 0 #000,
      3px 3px 0 #000,
      0 0 20px rgba(255,255,0,0.5);
    z-index: 1000;
    pointer-events: none;
    user-select: none;
  `;
  container.appendChild(el);
  return el;
}

/**
 * Impact burst effect - "POW!" text that pops and fades
 */
export const impactBurstAnimation: AnimationDefinition = {
  id: "impact-burst",
  name: "Impact Burst",
  category: "effect",
  duration: 0.5,

  create: (context: AnimationContext, options?: AnimationOptions) => {
    const { defender, attackerSide } = context;
    const defenderEl = resolveTarget(defender);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!defenderEl || !defenderEl.parentElement) {
      return timeline;
    }

    // Get defender position
    const rect = defenderEl.getBoundingClientRect();
    const parentRect = defenderEl.parentElement.getBoundingClientRect();

    // Position slightly offset from center based on attack direction
    const offsetX = attackerSide === "left" ? -30 : 30;
    const x = rect.left - parentRect.left + rect.width / 2 + offsetX;
    const y = rect.top - parentRect.top + rect.height / 2 - 20;

    // Choose random impact word
    const impactWords = ["POW!", "BAM!", "WHAM!", "CRACK!", "SMASH!"];
    const word = impactWords[Math.floor(Math.random() * impactWords.length)];

    // Create the text element
    const textEl = createImpactText(defenderEl.parentElement, word, x, y);

    // Pop in with scale and rotation
    timeline.fromTo(
      textEl,
      {
        scale: 0,
        rotation: -15 + Math.random() * 30,
        opacity: 1,
      },
      {
        scale: 1.2,
        rotation: -5 + Math.random() * 10,
        duration: 0.12,
        ease: "back.out(3)",
      }
    );

    // Hold briefly
    timeline.to(textEl, {
      scale: 1.1,
      duration: 0.08,
    });

    // Fade out and drift upward
    timeline.to(textEl, {
      opacity: 0,
      y: "-=30",
      scale: 0.8,
      duration: 0.25,
      ease: "power2.out",
      onComplete: () => {
        textEl.remove();
      },
    });

    return timeline;
  },
};

/**
 * Starburst effect - multiple lines radiating from impact point
 */
export const starburstAnimation: AnimationDefinition = {
  id: "starburst",
  name: "Starburst",
  category: "effect",
  duration: 0.4,

  create: (context: AnimationContext) => {
    const { defender, attackerSide } = context;
    const defenderEl = resolveTarget(defender);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!defenderEl || !defenderEl.parentElement) {
      return timeline;
    }

    const rect = defenderEl.getBoundingClientRect();
    const parentRect = defenderEl.parentElement.getBoundingClientRect();
    const offsetX = attackerSide === "left" ? -20 : 20;
    const centerX = rect.left - parentRect.left + rect.width / 2 + offsetX;
    const centerY = rect.top - parentRect.top + rect.height / 2;

    // Create starburst container
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 0;
      height: 0;
      z-index: 999;
      pointer-events: none;
    `;
    defenderEl.parentElement.appendChild(container);

    // Create rays
    const rayCount = 8;
    const rays: HTMLDivElement[] = [];

    for (let i = 0; i < rayCount; i++) {
      const ray = document.createElement("div");
      const angle = (360 / rayCount) * i;
      ray.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: 4px;
        height: 0;
        background: linear-gradient(to bottom, #ffff00, transparent);
        transform: rotate(${angle}deg);
        transform-origin: top center;
      `;
      container.appendChild(ray);
      rays.push(ray);
    }

    // Animate rays outward
    timeline.to(rays, {
      height: 80,
      duration: 0.15,
      ease: "power2.out",
      stagger: 0.01,
    });

    // Fade out
    timeline.to(
      rays,
      {
        opacity: 0,
        height: 100,
        duration: 0.2,
        ease: "power1.out",
        onComplete: () => {
          container.remove();
        },
      },
      "-=0.05"
    );

    return timeline;
  },
};

/**
 * Flash effect - quick white flash overlay
 */
export const flashAnimation: AnimationDefinition = {
  id: "flash",
  name: "Flash",
  category: "effect",
  duration: 0.15,

  create: (context: AnimationContext) => {
    const { arenaContainer } = context;
    const arenaEl = resolveTarget(arenaContainer);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!arenaEl) {
      return timeline;
    }

    // Create flash overlay
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
      opacity: 0.6,
      duration: 0.03,
    });

    timeline.to(flash, {
      opacity: 0,
      duration: 0.12,
      ease: "power2.out",
      onComplete: () => {
        flash.remove();
      },
    });

    return timeline;
  },
};
