import { animationRegistry } from "../registry";

// Import all attack animations
import { punchAnimation, heavyPunchAnimation } from "./punch";
import { kickAnimation, sweepKickAnimation } from "./kick";
import { slamAnimation, groundPoundAnimation } from "./slam";
import { uppercutAnimation, dragonUppercutAnimation } from "./uppercut";

/**
 * All available attack animations
 */
export const attacks = {
  punch: punchAnimation,
  heavyPunch: heavyPunchAnimation,
  kick: kickAnimation,
  sweepKick: sweepKickAnimation,
  slam: slamAnimation,
  groundPound: groundPoundAnimation,
  uppercut: uppercutAnimation,
  dragonUppercut: dragonUppercutAnimation,
} as const;

/**
 * Register all attack animations with the registry.
 * Call this once at app initialization.
 */
export function registerAllAttacks(): void {
  Object.values(attacks).forEach((attack) => {
    animationRegistry.register(attack);
  });

  console.log(
    `[attacks] Registered ${Object.keys(attacks).length} attack animations`
  );
}

// Re-export individual animations for direct access
export {
  punchAnimation,
  heavyPunchAnimation,
  kickAnimation,
  sweepKickAnimation,
  slamAnimation,
  groundPoundAnimation,
  uppercutAnimation,
  dragonUppercutAnimation,
};
