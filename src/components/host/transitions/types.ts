import { GameState } from "@/lib/types";

/**
 * Transition trigger function
 * Determines if a transition should activate based on game state changes
 */
export type TransitionTrigger = (
  prevState: GameState | null,
  currentState: GameState
) => boolean;

/**
 * Props passed to transition components
 */
export interface TransitionProps {
  gameState: GameState;
  onComplete: () => void;
}

/**
 * Transition definition for registry
 */
export interface TransitionDefinition {
  /** Unique identifier for this transition */
  id: string;

  /** Human-readable name */
  name: string;

  /** Function that determines if this transition should trigger */
  trigger: TransitionTrigger;

  /** Priority (higher = shown first if multiple transitions match) */
  priority: number;

  /** React component to render */
  component: React.ComponentType<TransitionProps>;
}

/**
 * Registry interface for managing transitions
 */
export interface ITransitionRegistry {
  register(transition: TransitionDefinition): void;
  unregister(id: string): boolean;
  get(id: string): TransitionDefinition | undefined;
  findMatchingTransition(
    prevState: GameState | null,
    currentState: GameState
  ): TransitionDefinition | null;
  getRegisteredIds(): string[];
  has(id: string): boolean;
  clear(): void;
  readonly size: number;
}
