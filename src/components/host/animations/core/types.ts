import type { Timeline } from "gsap";
import type { GameState } from "@/lib/types";
import type { BattlerInfo, BattleRefs, RevealPhase } from "../../battle/types";
import type { BattleSide } from "../registry/types";
import type { FighterState } from "../../AvatarFighter";

/**
 * AnimationContext - Data available to all animations
 *
 * This context is passed to every animation's create() function,
 * providing access to DOM refs, game data, and callbacks.
 */
export interface AnimationContext {
  // DOM refs for animation targets
  refs: BattleRefs;

  // Battle data
  leftBattler: BattlerInfo | null;
  rightBattler: BattlerInfo | null;
  promptText: string;
  promptId?: string;

  // Damage from backend (single source of truth)
  leftDamage: number;
  rightDamage: number;

  // Full game state for conditional logic
  gameState: GameState;

  // Callbacks for state updates
  onDamageApplied?: (side: BattleSide, damage: number) => void;
  onComplete?: () => void;

  // State setters (optional - animations can update phase/fighter state)
  setPhase?: (phase: RevealPhase) => void;
  setFighterState?: (side: BattleSide, state: FighterState) => void;
  setDisplayedVotes?: (votes: { left: number; right: number }) => void;
  setTieMessage?: (message: string | null) => void;
}

/**
 * AnimationDefinition - Defines a single animation
 *
 * Animations are self-contained units that:
 * - Know their own duration
 * - Can run independently
 * - Register themselves on module load
 */
export interface AnimationDefinition {
  // Unique identifier (e.g., "battle-entry", "attack-normal")
  id: string;

  // Human-readable name for debugging
  name: string;

  // Category for filtering/organization
  category: "transition" | "battle" | "effect";

  // Duration in seconds (null = wait for external event)
  duration: number | null;

  // Can this run alongside other animations?
  canRunInParallel: boolean;

  // Priority when multiple animations match (higher = preferred)
  priority?: number;

  // Tags for filtering/debugging
  tags?: string[];

  // Create GSAP timeline for this animation
  create: (context: AnimationContext) => Timeline;

  // Optional lifecycle hooks
  onStart?: (context: AnimationContext) => void;
  onComplete?: (context: AnimationContext) => void;
}

/**
 * AnimationSequenceStep - A step in an animation sequence
 *
 * Steps define:
 * - Which animation to play
 * - Timing (duration, delay, parallel)
 * - Conditions (when to run, what to wait for)
 */
export interface AnimationSequenceStep {
  // Animation ID to play
  animation: string;

  // Duration override (null = use animation's duration)
  duration?: number | null;

  // Parallel animations (play at same time as this step)
  parallel?: AnimationSequenceStep[];

  // Condition to check before running
  conditional?: (context: AnimationContext) => boolean | string;

  // Wait for condition before proceeding
  waitFor?: {
    gameState?: (game: GameState) => boolean;
    timeout?: number;
  };

  // Delay before starting (seconds)
  delay?: number;
}

/**
 * AnimationSequence - A complete animation sequence
 *
 * Sequences define the ORDER, TIMING, and PARALLELISM of animations.
 * Examples:
 * - BATTLE_SEQUENCE: Entry → Voting → Slide → Reveal → Attack
 * - ROUND_TRANSITION_SEQUENCE: Fade out → Show round title → Fade in
 */
export interface AnimationSequence {
  id: string;
  name: string;
  steps: AnimationSequenceStep[];
}

/**
 * AnimationSelectionResult - Result of selecting an animation variant
 *
 * Used when a step needs to select between multiple animation variants
 * (e.g., attack-normal vs attack-ko vs attack-combo-ko)
 */
export interface AnimationSelectionResult {
  animationId: string;
  reason?: string; // For debugging
}
