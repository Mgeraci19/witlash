import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";

/**
 * battleEntryAnimation - The SACRED battle entry sequence
 *
 * CRITICAL: This timing has been carefully tuned. DO NOT MODIFY without testing extensively.
 *
 * Timing breakdown:
 * - Question fade in: 0.5s
 * - Question reading pause: 3s
 * - Avatars push phase: 0.3s
 * - Answer 1 slam: 0.3s
 * - Answer 1 reading pause: 2.5s
 * - Answer 2 slam: 0.3s
 * - Transition to voting: 0.5s
 * TOTAL: 7.4s
 *
 * Flow:
 * 1. Question fades in with scale effect
 * 2. First answer slams in
 * 3. Second answer slams in
 * 4. Transitions to voting phase
 */
export const battleEntryAnimation: AnimationDefinition = {
  id: "battle-entry",
  name: "Battle Entry Sequence",
  category: "battle",
  duration: 7.4, // SACRED - matches useEntrySequence.ts exactly
  canRunInParallel: false,
  priority: 10,
  tags: ["battle", "entry", "sacred-timing"],

  create: (context) => {
    const timeline = gsap.timeline({
      onComplete: () => {
        console.log("[battleEntryAnimation] Entry sequence complete");
        context.onComplete?.();
      },
    });

    // Validate refs exist
    if (
      !context.refs.question.current ||
      !context.refs.answer1.current ||
      !context.refs.answer2.current
    ) {
      console.warn("[battleEntryAnimation] Refs not available, returning empty timeline");
      return timeline;
    }

    // Phase 1: Question (0.5s + 3s pause = 3.5s total)
    context.setPhase?.("question");
    timeline.to(context.refs.question.current, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.5, // SACRED
      ease: "back.out(1.5)", // SACRED
    });

    // Hold for reading the question
    timeline.to({}, { duration: 3 }); // SACRED

    // Phase 2: Avatars (0.3s pause)
    timeline.call(() => context.setPhase?.("avatars_push"));
    timeline.to({}, { duration: 0.3 }); // SACRED

    // Phase 3: Slam 1 (0.3s + 2.5s pause = 2.8s total)
    timeline.call(() => context.setPhase?.("slam1"));
    timeline.to(context.refs.answer1.current, {
      opacity: 1,
      scale: 1,
      visibility: "visible",
      duration: 0.3, // SACRED
      ease: "back.out(2)", // SACRED
    });

    // Pause for reading
    timeline.to({}, { duration: 2.5 }); // SACRED

    // Phase 4: Slam 2 (0.3s animation)
    timeline.call(() => context.setPhase?.("slam2"));
    timeline.to(context.refs.answer2.current, {
      opacity: 1,
      scale: 1,
      visibility: "visible",
      duration: 0.3, // SACRED
      ease: "back.out(2)", // SACRED
    });

    // Move to voting phase (0.5s delay)
    timeline.call(() => context.setPhase?.("voting"), [], "+=0.5"); // SACRED

    return timeline;
  },

  onStart: (context) => {
    console.log(
      `[battleEntryAnimation] Starting entry for prompt: ${context.promptText?.substring(0, 50)}...`
    );
  },

  onComplete: (context) => {
    console.log("[battleEntryAnimation] Entry complete, now in voting phase");
  },
};

// Auto-register on module load
animationRegistry.register(battleEntryAnimation);
