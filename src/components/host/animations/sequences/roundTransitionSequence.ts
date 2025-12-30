import type { AnimationSequence } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";

/**
 * ROUND_TRANSITION_SEQUENCE - Transition between rounds
 *
 * NOTE: The existing round transitions in TransitionOrchestrator.tsx work well.
 * This is a placeholder for when those transitions are migrated to this unified system.
 *
 * Current transitions (from transitionRegistry.ts):
 * - round-1-start: "ROUND 1: THE GRUDGE MATCH"
 * - round-2-start: "ROUND 2: THE CULL" + pairing displays
 * - round-3-start: "ROUND 3: SHOWDOWN"
 * - round-4-start: "SUDDEN DEATH"
 *
 * Each transition:
 * 1. Fades in round title with Street Fighter style
 * 2. Shows for ~3 seconds
 * 3. Fades out
 *
 * Total duration: ~3-4s per transition
 */
export const ROUND_TRANSITION_SEQUENCE: AnimationSequence = {
  id: "round-transition",
  name: "Round Transition",
  steps: [
    {
      animation: "round-transition-generic",
      duration: 3.0,
    },
  ],
};

// Auto-register sequence
animationRegistry.registerSequence(ROUND_TRANSITION_SEQUENCE);

/**
 * TODO: Migrate round transitions from TransitionOrchestrator to this system
 *
 * Steps:
 * 1. Extract transitions from transitionRegistry.ts
 * 2. Convert to AnimationDefinition format
 * 3. Register with animationRegistry
 * 4. Update this sequence to select appropriate transition based on round
 * 5. Replace TransitionOrchestrator with AnimationOrchestrator
 */
