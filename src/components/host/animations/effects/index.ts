import { animationRegistry } from "../registry";

// Import all effect animations
import { impactBurstAnimation, starburstAnimation, flashAnimation } from "./impact";
import { damageNumberAnimation, multiHitDamageAnimation, hpDrainAnimation } from "./damage";
import { koAnimation, doubleKOAnimation, dramaticKOAnimation } from "./ko";

/**
 * All available effect animations
 */
export const effects = {
  // Impact effects
  impactBurst: impactBurstAnimation,
  starburst: starburstAnimation,
  flash: flashAnimation,

  // Damage effects
  damageNumber: damageNumberAnimation,
  multiHitDamage: multiHitDamageAnimation,
  hpDrain: hpDrainAnimation,

  // KO effects
  ko: koAnimation,
  doubleKO: doubleKOAnimation,
  dramaticKO: dramaticKOAnimation,
} as const;

/**
 * Register all effect animations with the registry.
 * Call this once at app initialization.
 */
export function registerAllEffects(): void {
  Object.values(effects).forEach((effect) => {
    animationRegistry.register(effect);
  });

  console.log(
    `[effects] Registered ${Object.keys(effects).length} effect animations`
  );
}

// Re-export individual animations for direct access
export {
  impactBurstAnimation,
  starburstAnimation,
  flashAnimation,
  damageNumberAnimation,
  multiHitDamageAnimation,
  hpDrainAnimation,
  koAnimation,
  doubleKOAnimation,
  dramaticKOAnimation,
};
