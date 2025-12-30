import { useEffect } from "react";
import { gsap } from "../../animations/gsapConfig";
import { BattleRefs, BattleActions, BattlerInfo } from "../types";

interface UseEntrySequenceOptions {
  refs: BattleRefs;
  actions: BattleActions;
  leftBattler: BattlerInfo | null;
  rightBattler: BattlerInfo | null;
  promptText?: string;
  hasStartedRef: React.MutableRefObject<boolean>;
}

/**
 * useEntrySequence - Animates the battle entry
 *
 * Flow:
 * 1. Question fades in with scale effect
 * 2. First answer slams in
 * 3. Second answer slams in
 * 4. Transitions to voting phase
 */
export function useEntrySequence({
  refs,
  actions,
  leftBattler,
  rightBattler,
  promptText,
  hasStartedRef,
}: UseEntrySequenceOptions) {
  useEffect(() => {
    if (!leftBattler || !rightBattler || !promptText || hasStartedRef.current) return;

    let timeline: gsap.core.Timeline | null = null;

    // Wait for next frame to ensure refs are attached to DOM
    const frameId = requestAnimationFrame(() => {
      // Double-check refs are available
      if (!refs.question.current || !refs.answer1.current || !refs.answer2.current) {
        console.warn("[useEntrySequence] Refs not ready, skipping animation");
        return;
      }

      hasStartedRef.current = true;

      timeline = gsap.timeline();

      // Phase 1: Question animates in
      actions.setPhase("question");
      timeline.to(refs.question.current, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.5,
        ease: "back.out(1.5)",
      });

      // Hold for reading the question
      timeline.to({}, { duration: 3 });

      // Phase 2: Avatars are already on sides (static layout)
      timeline.call(() => actions.setPhase("avatars_push"));
      timeline.to({}, { duration: 0.3 });

      // Phase 3: Slam in first answer
      timeline.call(() => actions.setPhase("slam1"));
      timeline.to(refs.answer1.current, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "back.out(2)",
      });

      // Pause for reading
      timeline.to({}, { duration: 2.5 });

      // Phase 4: Slam in second answer
      timeline.call(() => actions.setPhase("slam2"));
      timeline.to(refs.answer2.current, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "back.out(2)",
      });

      // Move to voting phase
      timeline.call(() => actions.setPhase("voting"), [], "+=0.5");
    });

    return () => {
      cancelAnimationFrame(frameId);
      timeline?.kill();
    };
  }, [leftBattler, rightBattler, promptText, refs, actions, hasStartedRef]);
}
