import { GameState } from "@/lib/types";
import {
  TransitionDefinition,
  ITransitionRegistry,
} from "./types";

/**
 * Singleton registry for managing hot-swappable game transitions.
 *
 * Usage:
 * ```ts
 * import { transitionRegistry } from "./transitionRegistry";
 *
 * // Register a new transition
 * transitionRegistry.register({
 *   id: "round-start",
 *   name: "Round Start",
 *   trigger: (prev, curr) => prev?.currentRound !== curr.currentRound,
 *   priority: 10,
 *   component: RoundStartTransition
 * });
 *
 * // Find matching transition
 * const transition = transitionRegistry.findMatchingTransition(prevState, currentState);
 * ```
 */
class TransitionRegistry implements ITransitionRegistry {
  private transitions: Map<string, TransitionDefinition> = new Map();

  /**
   * Register a new transition definition.
   * If a transition with the same ID exists, it will be replaced.
   */
  register(transition: TransitionDefinition): void {
    if (!transition.id || !transition.trigger || !transition.component) {
      console.error(
        "[TransitionRegistry] Invalid transition definition:",
        transition
      );
      return;
    }

    const isReplacing = this.transitions.has(transition.id);
    this.transitions.set(transition.id, transition);

    if (isReplacing) {
      console.log(
        `[TransitionRegistry] Replaced transition: ${transition.id}`
      );
    } else {
      console.log(
        `[TransitionRegistry] Registered transition: ${transition.id} (priority: ${transition.priority})`
      );
    }
  }

  /**
   * Unregister a transition by ID.
   * Returns true if transition was found and removed.
   */
  unregister(id: string): boolean {
    const existed = this.transitions.delete(id);
    if (existed) {
      console.log(`[TransitionRegistry] Unregistered transition: ${id}`);
    }
    return existed;
  }

  /**
   * Get a transition by ID.
   */
  get(id: string): TransitionDefinition | undefined {
    return this.transitions.get(id);
  }

  /**
   * Find the highest-priority transition that matches the state change.
   * Returns null if no transitions match.
   */
  findMatchingTransition(
    prevState: GameState | null,
    currentState: GameState
  ): TransitionDefinition | null {
    const matchingTransitions = Array.from(this.transitions.values())
      .filter((t) => {
        try {
          return t.trigger(prevState, currentState);
        } catch (err) {
          console.error(
            `[TransitionRegistry] Error in trigger for ${t.id}:`,
            err
          );
          return false;
        }
      })
      .sort((a, b) => b.priority - a.priority); // Highest priority first

    if (matchingTransitions.length > 0) {
      const chosen = matchingTransitions[0];
      console.log(
        `[TransitionRegistry] Triggered transition: ${chosen.id} (${matchingTransitions.length} matched, priority ${chosen.priority})`
      );
      return chosen;
    }

    return null;
  }

  /**
   * Get all registered transition IDs.
   */
  getRegisteredIds(): string[] {
    return Array.from(this.transitions.keys());
  }

  /**
   * Check if a transition is registered.
   */
  has(id: string): boolean {
    return this.transitions.has(id);
  }

  /**
   * Clear all registered transitions (useful for testing).
   */
  clear(): void {
    this.transitions.clear();
    console.log("[TransitionRegistry] Cleared all transitions");
  }

  /**
   * Get count of registered transitions.
   */
  get size(): number {
    return this.transitions.size;
  }
}

// Singleton instance
export const transitionRegistry = new TransitionRegistry();

// Re-export types for convenience
export * from "./types";
