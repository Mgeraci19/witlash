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

// Auto-register built-in transitions
import { transitionRegistry } from "./transitionRegistry";
import { RoundStartTransition } from "./RoundStartTransition";

/**
 * Register the round start transition
 * Triggers when currentRound changes
 */
transitionRegistry.register({
  id: "round-start",
  name: "Round Start",
  trigger: (prevState, currentState) => {
    // Only trigger on actual round changes (not initial load)
    return prevState !== null && prevState.currentRound !== currentState.currentRound;
  },
  priority: 10,
  component: RoundStartTransition,
});

console.log("[Transitions] Initialized with", transitionRegistry.size, "transitions");
