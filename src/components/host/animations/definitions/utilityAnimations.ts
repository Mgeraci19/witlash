import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";

/**
 * pauseAnimation - Simple pause/delay animation
 *
 * Used for creating pauses between animation steps in a sequence.
 * Duration is typically overridden by the sequence step.
 */
export const pauseAnimation: AnimationDefinition = {
  id: "pause",
  name: "Pause",
  category: "effect",
  duration: 1.0, // Default - usually overridden
  canRunInParallel: true,
  priority: 0,
  tags: ["utility", "pause"],

  create: (context) => {
    const timeline = gsap.timeline({ onComplete: context.onComplete });
    // Empty timeline - just waits for duration
    return timeline;
  },
};

/**
 * votingWaitAnimation - Wait for voting to complete
 *
 * This is a null animation that serves as a placeholder while waiting
 * for the game state to change (roundStatus === "REVEAL").
 *
 * The AnimationSequencer will handle the waitFor logic.
 */
export const votingWaitAnimation: AnimationDefinition = {
  id: "voting-wait",
  name: "Wait for Voting",
  category: "effect",
  duration: null, // Indefinite - waits for external event
  canRunInParallel: false,
  priority: 0,
  tags: ["utility", "wait"],

  create: (context) => {
    const timeline = gsap.timeline({ onComplete: context.onComplete });
    // Empty timeline - AnimationSequencer will handle the waiting
    console.log("[votingWaitAnimation] Waiting for votes to complete...");
    return timeline;
  },
};

// Auto-register utility animations
animationRegistry.register(pauseAnimation);
animationRegistry.register(votingWaitAnimation);
