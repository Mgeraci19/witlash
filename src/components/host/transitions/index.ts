/**
 * Transitions Module
 *
 * Decoupled, hot-swappable game transitions using registry pattern.
 *
 * Usage:
 * ```tsx
 * import { TransitionOrchestrator } from "@/components/host/transitions";
 *
 * <TransitionOrchestrator gameState={game} />
 * ```
 */

// Core exports
export { TransitionOrchestrator } from "./TransitionOrchestrator";
export { transitionRegistry } from "./transitionRegistry";
export * from "./types";

// Transition components
export { RoundStartTransition } from "./RoundStartTransition";
export { SuddenDeathIntro } from "./SuddenDeathIntro";
export { CornerMenReveal } from "./CornerMenReveal";
export { PairingReveal } from "./PairingReveal";

// Auto-register built-in transitions
import { transitionRegistry } from "./transitionRegistry";
import { RoundStartTransition } from "./RoundStartTransition";
import { SuddenDeathIntro } from "./SuddenDeathIntro";
import { CornerMenReveal } from "./CornerMenReveal";
import { PairingReveal } from "./PairingReveal";

/**
 * Register the sudden death intro transition
 * Triggers when entering Round 4 (higher priority than generic round start)
 */
transitionRegistry.register({
  id: "sudden-death-intro",
  name: "Sudden Death Intro",
  trigger: (prevState, currentState) => {
    // Only trigger when transitioning TO round 4 (not initial load)
    return (
      prevState !== null &&
      prevState.currentRound === 3 &&
      currentState.currentRound === 4
    );
  },
  priority: 20, // Higher priority than generic round start
  component: SuddenDeathIntro,
});

/**
 * Register the pairing reveal transition
 * Triggers when entering Round 3 (shows Round 2 results)
 * Highest priority for round 2->3 transition
 */
transitionRegistry.register({
  id: "pairing-reveal",
  name: "Pairing Reveal",
  trigger: (prevState, currentState) => {
    // Only trigger when transitioning TO round 3 (not initial load)
    // AND we have pairing data
    return Boolean(
      prevState !== null &&
      prevState.currentRound === 2 &&
      currentState.currentRound === 3 &&
      currentState.round2Pairings &&
      currentState.round2Pairings.length > 0
    );
  },
  priority: 16, // Highest priority for round 3 transitions
  component: PairingReveal,
});

/**
 * Register the corner men reveal transition
 * Triggers when entering Round 3 (shows team structure)
 * Lower priority than pairing reveal (fallback if no pairings)
 */
transitionRegistry.register({
  id: "corner-men-reveal",
  name: "Corner Men Reveal",
  trigger: (prevState, currentState) => {
    // Only trigger when transitioning TO round 3 (not initial load)
    // AND we don't have pairing data (fallback)
    return (
      prevState !== null &&
      prevState.currentRound === 2 &&
      currentState.currentRound === 3 &&
      (!currentState.round2Pairings || currentState.round2Pairings.length === 0)
    );
  },
  priority: 15, // Lower than pairing reveal
  component: CornerMenReveal,
});

/**
 * Register the round start transition (generic, for rounds 1-3)
 * Triggers when currentRound changes (except for Round 4, which uses sudden death)
 */
transitionRegistry.register({
  id: "round-start",
  name: "Round Start",
  trigger: (prevState, currentState) => {
    // Only trigger on actual round changes (not initial load or Round 4)
    return (
      prevState !== null &&
      prevState.currentRound !== currentState.currentRound &&
      currentState.currentRound !== 4 // Round 4 uses sudden death intro
    );
  },
  priority: 10,
  component: RoundStartTransition,
});

console.log("[Transitions] Initialized with", transitionRegistry.size, "transitions");
