import { gsap } from "gsap";

/**
 * Target element reference for animations
 * Can be a DOM element, ref object, or CSS selector
 */
export type AnimationTarget =
  | HTMLElement
  | React.RefObject<HTMLElement | null>
  | string
  | null;

/**
 * Side of the battle arena (affects animation direction)
 */
export type BattleSide = "left" | "right";

/**
 * Fighter state during battle
 */
export type FighterState = "idle" | "attacking" | "hurt" | "ko" | "victory";

/**
 * Animation category for filtering and selection
 */
export type AnimationCategory = "attack" | "effect" | "transition";

/**
 * Context passed to animation creators
 */
export interface AnimationContext {
  /** The attacking fighter's element */
  attacker: AnimationTarget;
  /** The defending fighter's element */
  defender: AnimationTarget;
  /** Which side the attacker is on */
  attackerSide: BattleSide;
  /** Container element for the battle arena */
  arenaContainer?: AnimationTarget;
  /** Callback when impact occurs (for damage display, sound, etc.) */
  onImpact?: () => void;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Speed multiplier (from round theme) */
  speedMultiplier?: number;
  /** Screen shake intensity (from round theme) */
  shakeIntensity?: number;
}

/**
 * Options for customizing animation behavior
 */
export interface AnimationOptions {
  /** Duration override in seconds */
  duration?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Number of attacks (for multi-hit) */
  hitCount?: number;
  /** Damage amount (affects intensity) */
  damage?: number;
  /** Whether this attack results in a KO */
  isKO?: boolean;
  /** Custom easing function */
  ease?: string;
}

/**
 * Definition for a registered animation
 */
export interface AnimationDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Category for filtering */
  category: AnimationCategory;
  /** Base duration in seconds */
  duration: number;
  /** Creates the GSAP timeline for this animation */
  create: (context: AnimationContext, options?: AnimationOptions) => gsap.core.Timeline;
}

/**
 * Interface for the animation registry
 */
export interface IAnimationRegistry {
  /** Register a new animation (replaces if ID exists) */
  register(animation: AnimationDefinition): void;
  /** Unregister an animation by ID */
  unregister(id: string): boolean;
  /** Get animation by ID */
  get(id: string): AnimationDefinition | undefined;
  /** Get all animations in a category */
  getByCategory(category: AnimationCategory): AnimationDefinition[];
  /** Get a random attack animation */
  getRandomAttack(): AnimationDefinition | undefined;
  /** Get all registered animation IDs */
  getRegisteredIds(): string[];
  /** Check if an animation is registered */
  has(id: string): boolean;
}

/**
 * Battle sequence step types
 */
export type SequenceStepType =
  | "idle"
  | "attack"
  | "impact"
  | "damage"
  | "ko"
  | "victory"
  | "transition";

/**
 * A step in a battle sequence
 */
export interface SequenceStep {
  type: SequenceStepType;
  animationId?: string;
  target?: BattleSide;
  options?: AnimationOptions;
  duration?: number;
}

/**
 * Battle result data
 */
export interface BattleResult {
  winnerId: string;
  winnerSide: BattleSide;
  loserId: string;
  loserSide: BattleSide;
  damage: number;
  isKO: boolean;
  voteCount: number;
}

/**
 * Props for battle sequencer
 */
export interface BattleSequenceProps {
  leftFighter: AnimationTarget;
  rightFighter: AnimationTarget;
  arenaContainer: AnimationTarget;
  result: BattleResult;
  onSequenceComplete?: () => void;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
}
