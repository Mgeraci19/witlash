import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";
import { TIMINGS } from "../config";

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
  duration: TIMINGS.entrySequence,
  canRunInParallel: false,
  priority: 10,
  tags: ["battle", "entry"],

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

    // FADE IN VS badge at start of battle
    timeline.fromTo(
      context.refs.vsBadge.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.2 },
      0 // At start of timeline
    );

    // Phase 1: Question (TESTING: 0.3s + 0.2s pause)
    // Use fromTo to ensure consistent starting position (fixes positioning bugs)
    context.setPhase?.("question");
    timeline.fromTo(
      context.refs.question.current,
      { opacity: 0, scale: 0.9, y: -20, visibility: "visible" },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.5)" }
    );

    // Hold for reading the question
    timeline.to({}, { duration: TIMINGS.questionPause });

    // Phase 2: Avatars push phase
    timeline.call(() => context.setPhase?.("avatars_push"));
    timeline.to({}, { duration: 0.1 });

    // Phase 3: Slam 1 - first answer slams in
    // Use fromTo for consistent starting position
    timeline.call(() => context.setPhase?.("slam1"));
    timeline.fromTo(
      context.refs.answer1.current,
      { opacity: 0, scale: 0.8, visibility: "visible" },
      { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }
    );

    // Pause for reading the answer
    timeline.to({}, { duration: TIMINGS.answerReadPause });

    // Phase 4: Slam 2 - second answer slams in
    // Use fromTo for consistent starting position
    timeline.call(() => context.setPhase?.("slam2"));
    timeline.fromTo(
      context.refs.answer2.current,
      { opacity: 0, scale: 0.8, visibility: "visible" },
      { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }
    );

    // Move to voting phase
    timeline.call(() => context.setPhase?.("voting"), [], `+=${TIMINGS.answerReadPause}`);

    return timeline;
  },

  onStart: (context) => {
    console.log(
      `[battleEntryAnimation] Starting entry for prompt: ${context.promptText?.substring(0, 50)}...`
    );
  },

  onComplete: (_context) => {
    console.log("[battleEntryAnimation] Entry complete, now in voting phase");
  },
};

// Auto-register on module load
animationRegistry.register(battleEntryAnimation);
