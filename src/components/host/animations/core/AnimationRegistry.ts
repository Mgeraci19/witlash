import type { AnimationDefinition, AnimationSequence } from './types';

/**
 * AnimationRegistry - Singleton registry for all animations and sequences
 *
 * Animations and sequences register themselves on module load.
 * The orchestrator looks up animations from this registry.
 *
 * Usage:
 * ```typescript
 * // In animation definition file:
 * const myAnimation: AnimationDefinition = { ... };
 * animationRegistry.register(myAnimation);
 *
 * // In orchestrator:
 * const animation = animationRegistry.get('my-animation');
 * ```
 */
class AnimationRegistry {
  private animations = new Map<string, AnimationDefinition>();
  private sequences = new Map<string, AnimationSequence>();

  /**
   * Register an animation definition
   * @param animation The animation to register
   */
  register(animation: AnimationDefinition): void {
    if (this.animations.has(animation.id)) {
      console.warn(`[AnimationRegistry] Replacing animation: ${animation.id}`);
    }
    this.animations.set(animation.id, animation);
    console.log(
      `[AnimationRegistry] Registered: ${animation.id} (${animation.category}, ${animation.duration}s)`
    );
  }

  /**
   * Register a sequence definition
   * @param sequence The sequence to register
   */
  registerSequence(sequence: AnimationSequence): void {
    if (this.sequences.has(sequence.id)) {
      console.warn(`[AnimationRegistry] Replacing sequence: ${sequence.id}`);
    }
    this.sequences.set(sequence.id, sequence);
    console.log(`[AnimationRegistry] Registered sequence: ${sequence.id}`);
  }

  /**
   * Get an animation by ID
   * @param id The animation ID
   * @returns The animation definition, or undefined if not found
   */
  get(id: string): AnimationDefinition | undefined {
    return this.animations.get(id);
  }

  /**
   * Get a sequence by ID
   * @param id The sequence ID
   * @returns The sequence definition, or undefined if not found
   */
  getSequence(id: string): AnimationSequence | undefined {
    return this.sequences.get(id);
  }

  /**
   * Get all animations in a category
   * @param category The category to filter by
   * @returns Array of animations in that category
   */
  getByCategory(category: string): AnimationDefinition[] {
    return Array.from(this.animations.values())
      .filter(anim => anim.category === category);
  }

  /**
   * Get all animations with a specific tag
   * @param tag The tag to filter by
   * @returns Array of animations with that tag
   */
  getByTag(tag: string): AnimationDefinition[] {
    return Array.from(this.animations.values())
      .filter(anim => anim.tags?.includes(tag));
  }

  /**
   * Get all registered animations
   * @returns Array of all animations
   */
  getAllAnimations(): AnimationDefinition[] {
    return Array.from(this.animations.values());
  }

  /**
   * Get all registered sequences
   * @returns Array of all sequences
   */
  getAllSequences(): AnimationSequence[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Select best animation from multiple candidates
   *
   * When multiple animations could apply (e.g., attack-normal, attack-ko, attack-combo-ko),
   * select the one with highest priority.
   *
   * @param candidates Array of animation IDs to choose from
   * @returns The highest priority animation ID, or null if none found
   */
  selectBestAnimation(candidates: string[]): string | null {
    const animations = candidates
      .map(id => this.get(id))
      .filter((anim): anim is AnimationDefinition => anim !== undefined);

    if (animations.length === 0) return null;

    // Sort by priority (highest first), then by ID for stability
    animations.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return a.id.localeCompare(b.id);
    });

    return animations[0].id;
  }

  /**
   * Clear all registered animations and sequences
   * (Mainly for testing)
   */
  clear(): void {
    this.animations.clear();
    this.sequences.clear();
    console.log('[AnimationRegistry] Cleared all animations and sequences');
  }

  /**
   * Get registry statistics for debugging
   */
  getStats(): {
    animationCount: number;
    sequenceCount: number;
    categories: Record<string, number>;
    tags: Record<string, number>;
  } {
    const animations = this.getAllAnimations();

    const categories: Record<string, number> = {};
    const tags: Record<string, number> = {};

    animations.forEach(anim => {
      categories[anim.category] = (categories[anim.category] || 0) + 1;
      anim.tags?.forEach(tag => {
        tags[tag] = (tags[tag] || 0) + 1;
      });
    });

    return {
      animationCount: this.animations.size,
      sequenceCount: this.sequences.size,
      categories,
      tags,
    };
  }
}

// Export singleton instance
export const animationRegistry = new AnimationRegistry();
