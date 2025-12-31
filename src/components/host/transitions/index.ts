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
export { TheCutReveal } from "./TheCutReveal";

// Auto-register built-in transitions
import { transitionRegistry } from "./transitionRegistry";
import { RoundStartTransition } from "./RoundStartTransition";
import { SuddenDeathIntro } from "./SuddenDeathIntro";
import { TheCutReveal } from "./TheCutReveal";

/**
 * Register "The Cut" reveal transition
 * Triggers when transitioning from Round 1 (Main Round) to Round 2 (Semi-Finals)
 * Shows all fighters ranked by HP, with top 4 advancing and rest becoming corner men
 */
transitionRegistry.register({
  id: "the-cut-reveal",
  name: "The Cut Reveal",
  trigger: (prevState, currentState) => {
    // Only trigger when transitioning from Round 1 to Round 2
    return (
      prevState !== null &&
      prevState.currentRound === 1 &&
      currentState.currentRound === 2
    );
  },
  priority: 18, // Higher priority than round-robin-reveal
  component: TheCutReveal,
});

/**
 * Register the Final intro transition (formerly sudden death)
 * Triggers when entering Round 3 (Final) from Semi-Finals
 */
transitionRegistry.register({
  id: "final-intro",
  name: "Final Showdown Intro",
  trigger: (prevState, currentState) => {
    // Only trigger when transitioning TO Round 3 (Final)
    return (
      prevState !== null &&
      prevState.currentRound === 2 &&
      currentState.currentRound === 3
    );
  },
  priority: 20, // Higher priority than generic round start
  component: SuddenDeathIntro,
});

/**
 * Register the round start transition (generic)
 * Triggers when currentRound changes OR when game starts (LOBBY → PROMPTS)
 */
transitionRegistry.register({
  id: "round-start",
  name: "Round Start",
  trigger: (prevState, currentState) => {
    // Trigger on round changes
    if (prevState !== null && prevState.currentRound !== currentState.currentRound) {
      return true;
    }

    // Also trigger when starting Round 1 (LOBBY → PROMPTS)
    if (
      prevState !== null &&
      prevState.status === "LOBBY" &&
      currentState.status === "PROMPTS" &&
      currentState.currentRound === 1
    ) {
      return true;
    }

    return false;
  },
  priority: 10,
  component: RoundStartTransition,
});

console.log("[Transitions] Initialized with", transitionRegistry.size, "transitions");
