import {
  AnimationDefinition,
  AnimationCategory,
  IAnimationRegistry,
} from "./types";

/**
 * Singleton registry for managing hot-swappable animations.
 *
 * Usage:
 * ```ts
 * import { animationRegistry } from "./registry";
 *
 * // Register a new animation
 * animationRegistry.register({
 *   id: "punch",
 *   name: "Punch",
 *   category: "attack",
 *   duration: 0.5,
 *   create: (context, options) => { ... }
 * });
 *
 * // Get random attack for battle
 * const attack = animationRegistry.getRandomAttack();
 * ```
 */
class AnimationRegistry implements IAnimationRegistry {
  private animations: Map<string, AnimationDefinition> = new Map();

  /**
   * Register a new animation definition.
   * If an animation with the same ID exists, it will be replaced.
   */
  register(animation: AnimationDefinition): void {
    if (!animation.id || !animation.create) {
      console.error("[AnimationRegistry] Invalid animation definition:", animation);
      return;
    }

    const isReplacing = this.animations.has(animation.id);
    this.animations.set(animation.id, animation);

    if (isReplacing) {
      console.log(`[AnimationRegistry] Replaced animation: ${animation.id}`);
    } else {
      console.log(`[AnimationRegistry] Registered animation: ${animation.id} (${animation.category})`);
    }
  }

  /**
   * Unregister an animation by ID.
   * Returns true if animation was found and removed.
   */
  unregister(id: string): boolean {
    const existed = this.animations.delete(id);
    if (existed) {
      console.log(`[AnimationRegistry] Unregistered animation: ${id}`);
    }
    return existed;
  }

  /**
   * Get an animation by ID.
   */
  get(id: string): AnimationDefinition | undefined {
    return this.animations.get(id);
  }

  /**
   * Get all animations in a specific category.
   */
  getByCategory(category: AnimationCategory): AnimationDefinition[] {
    return Array.from(this.animations.values()).filter(
      (anim) => anim.category === category
    );
  }

  /**
   * Get a random attack animation.
   * Returns undefined if no attacks are registered.
   */
  getRandomAttack(): AnimationDefinition | undefined {
    const attacks = this.getByCategory("attack");
    if (attacks.length === 0) {
      console.warn("[AnimationRegistry] No attack animations registered");
      return undefined;
    }
    return attacks[Math.floor(Math.random() * attacks.length)];
  }

  /**
   * Get all registered animation IDs.
   */
  getRegisteredIds(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Check if an animation is registered.
   */
  has(id: string): boolean {
    return this.animations.has(id);
  }

  /**
   * Clear all registered animations (useful for testing).
   */
  clear(): void {
    this.animations.clear();
    console.log("[AnimationRegistry] Cleared all animations");
  }

  /**
   * Get count of registered animations.
   */
  get size(): number {
    return this.animations.size;
  }
}

// Singleton instance
export const animationRegistry = new AnimationRegistry();

// Re-export types for convenience
export * from "./types";
