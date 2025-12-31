import { gsap } from "../../animations/gsapConfig";
import type { AnimationContext, AnimationSequence, AnimationSequenceStep } from "./types";
import { animationRegistry } from "./AnimationRegistry";
import type { GameState } from "@/lib/types";

/**
 * AnimationSequencer - Executes animation sequences step by step
 *
 * Handles:
 * - Sequential execution of animation steps
 * - Parallel execution when specified
 * - Waiting for conditions (game state changes)
 * - Duration overrides
 * - Conditional animation selection
 *
 * Usage:
 * ```typescript
 * const sequencer = new AnimationSequencer();
 * await sequencer.playSequence(BATTLE_SEQUENCE, context);
 * ```
 */
export class AnimationSequencer {
  private currentTimeline: gsap.core.Timeline | null = null;
  private isPlaying = false;
  private currentSequenceId: string | null = null;
  private currentStepIndex: number = 0;

  /**
   * Play an animation sequence
   * @param sequence The sequence to play
   * @param context The animation context
   * @returns Promise that resolves when sequence completes
   */
  async playSequence(
    sequence: AnimationSequence,
    context: AnimationContext
  ): Promise<void> {
    if (this.isPlaying) {
      console.warn(
        `[AnimationSequencer] Already playing sequence "${this.currentSequenceId}", stopping it`
      );
      this.stop();
    }

    this.isPlaying = true;
    this.currentSequenceId = sequence.id;
    this.currentStepIndex = 0;

    console.log(`[AnimationSequencer] Starting sequence: ${sequence.id}`);

    try {
      for (let i = 0; i < sequence.steps.length; i++) {
        if (!this.isPlaying) {
          console.log(`[AnimationSequencer] Sequence stopped at step ${i}`);
          break;
        }

        this.currentStepIndex = i;
        const step = sequence.steps[i];

        await this.playStep(step, context);
      }

      console.log(`[AnimationSequencer] Sequence complete: ${sequence.id}`);

      // Call onComplete callback if provided
      if (context.onComplete) {
        console.log(`[AnimationSequencer] Calling onComplete callback`);
        context.onComplete();
      }
    } catch (error) {
      console.error(`[AnimationSequencer] Error in sequence ${sequence.id}:`, error);
      throw error;
    } finally {
      this.isPlaying = false;
      this.currentSequenceId = null;
      this.currentStepIndex = 0;
    }
  }

  /**
   * Play a single animation step
   * @param step The step to play
   * @param context The animation context
   */
  private async playStep(
    step: AnimationSequenceStep,
    context: AnimationContext
  ): Promise<void> {
    // Check conditional
    if (step.conditional) {
      const result = step.conditional(context);

      if (result === false) {
        console.log(
          `[AnimationSequencer] Skipping step (conditional failed): ${step.animation}`
        );
        return;
      }

      // If conditional returns a string, use it as the animation ID
      if (typeof result === "string") {
        step = { ...step, animation: result };
        console.log(
          `[AnimationSequencer] Conditional selected animation: ${result}`
        );
      }
    }

    // Wait for condition if specified
    if (step.waitFor) {
      await this.waitForCondition(step.waitFor, context);
    }

    // Apply delay
    if (step.delay) {
      console.log(`[AnimationSequencer] Delaying ${step.delay}s before ${step.animation}`);
      await this.wait(step.delay);
    }

    // Handle parallel animations
    if (step.parallel) {
      await this.playParallel([step, ...step.parallel], context);
      return;
    }

    // Get animation from registry
    const animation = animationRegistry.get(step.animation);
    if (!animation) {
      console.error(
        `[AnimationSequencer] Animation not found: ${step.animation}`
      );
      return;
    }

    const duration = step.duration ?? animation.duration;
    console.log(
      `[AnimationSequencer] Playing: ${step.animation} (${duration === null ? "indefinite" : duration + "s"})`
    );

    // Call onStart hook
    animation.onStart?.(context);

    // Create timeline
    const timeline = animation.create(context);
    this.currentTimeline = timeline;

    // Wait for completion
    await new Promise<void>((resolve) => {
      timeline.eventCallback("onComplete", () => {
        animation.onComplete?.(context);
        resolve();
      });
      timeline.play();
    });

    this.currentTimeline = null;
  }

  /**
   * Play multiple animations in parallel
   * @param steps The steps to play in parallel
   * @param context The animation context
   */
  private async playParallel(
    steps: AnimationSequenceStep[],
    context: AnimationContext
  ): Promise<void> {
    console.log(
      `[AnimationSequencer] Playing ${steps.length} animations in parallel`
    );

    const promises = steps.map((step) => this.playStep(step, context));
    await Promise.all(promises);
  }

  /**
   * Wait for a condition to be met
   * @param waitFor The condition to wait for
   * @param context The animation context
   */
  private async waitForCondition(
    waitFor: { gameState?: (game: GameState) => boolean; timeout?: number },
    context: AnimationContext
  ): Promise<void> {
    const timeout = waitFor.timeout || 30000; // 30s default
    const startTime = Date.now();

    // Get current game state (use getter if available, fallback to snapshot)
    const getCurrentGameState = () =>
      context.getGameState ? context.getGameState() : context.gameState;

    const currentGameState = getCurrentGameState();
    console.log(
      `[AnimationSequencer] Waiting for condition (timeout: ${timeout}ms), current roundStatus: ${currentGameState.roundStatus}`
    );

    return new Promise((resolve, reject) => {
      const check = () => {
        if (!this.isPlaying) {
          console.log("[AnimationSequencer] Wait cancelled - sequencer stopped");
          reject(new Error("Sequencer stopped"));
          return;
        }

        const latestGameState = getCurrentGameState();
        if (waitFor.gameState && waitFor.gameState(latestGameState)) {
          console.log(
            `[AnimationSequencer] Condition met (roundStatus: ${latestGameState.roundStatus}), proceeding`
          );
          resolve();
        } else if (Date.now() - startTime > timeout) {
          console.error(
            `[AnimationSequencer] Wait condition timeout after ${timeout}ms, roundStatus: ${latestGameState.roundStatus}`
          );
          reject(new Error("Wait condition timeout"));
        } else {
          setTimeout(check, 100); // Check every 100ms
        }
      };
      check();
    });
  }

  /**
   * Wait for a specified duration
   * @param seconds The duration to wait in seconds
   */
  private wait(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /**
   * Stop the current sequence
   */
  stop(): void {
    if (this.currentTimeline) {
      this.currentTimeline.kill();
      this.currentTimeline = null;
    }
    this.isPlaying = false;
    console.log(
      `[AnimationSequencer] Stopped sequence: ${this.currentSequenceId}`
    );
    this.currentSequenceId = null;
    this.currentStepIndex = 0;
  }

  /**
   * Get current status for debugging
   */
  getStatus(): {
    isPlaying: boolean;
    currentSequence: string | null;
    currentStep: number;
  } {
    return {
      isPlaying: this.isPlaying,
      currentSequence: this.currentSequenceId,
      currentStep: this.currentStepIndex,
    };
  }
}
