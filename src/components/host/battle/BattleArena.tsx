"use client";

import { useEffect, useRef } from "react";
import { gsap } from "../animations/gsapConfig";
import { BattleArenaProps } from "./types";
import { useBattleState } from "./useBattleState";
import { BattleLayout } from "./BattleLayout";
import {
  useEntrySequence,
  createSlideTimeline,
  addVoteRevealToTimeline,
  playWinnerAttack,
  playTieAttack,
} from "./animations";

/**
 * BattleArena - Orchestrates the battle sequence
 *
 * Flow:
 * 1. Entry: Question → Answer slams → Voting phase
 * 2. Reveal: Slide answers → Vote tick-up → Attack animation
 */
export function BattleArena({
  leftBattler,
  rightBattler,
  isReveal,
  promptId,
  promptText,
  onBattleComplete,
  onDamageApplied,
}: BattleArenaProps) {
  const { refs, state, actions, hasStartedRef, hasRevealedRef } = useBattleState({
    promptId,
    leftBattler,
    rightBattler,
  });

  // Store callbacks in refs to avoid stale closures
  const onBattleCompleteRef = useRef(onBattleComplete);
  const onDamageAppliedRef = useRef(onDamageApplied);
  onBattleCompleteRef.current = onBattleComplete;
  onDamageAppliedRef.current = onDamageApplied;

  // Reset on prompt change
  useEffect(() => {
    actions.reset();

    // Reset GSAP positions
    if (refs.leftFighter.current) gsap.set(refs.leftFighter.current, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    if (refs.rightFighter.current) gsap.set(refs.rightFighter.current, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    if (refs.question.current) gsap.set(refs.question.current, { opacity: 0, scale: 0.8, y: 20, visibility: "visible" });
    if (refs.answer1.current) gsap.set(refs.answer1.current, { opacity: 0, scale: 0.5, x: 0, y: 0, visibility: "visible" });
    if (refs.answer2.current) gsap.set(refs.answer2.current, { opacity: 0, scale: 0.5, x: 0, y: 0, visibility: "visible" });
    if (refs.vsBadge.current) gsap.set(refs.vsBadge.current, { opacity: 1 });
  }, [promptId, actions, refs]);

  // Entry sequence: Question → Answers → Voting
  useEntrySequence({
    refs,
    actions,
    leftBattler,
    rightBattler,
    promptText,
    hasStartedRef,
  });

  // Reveal sequence: Slide → Votes → Attack
  useEffect(() => {
    if (!isReveal || hasRevealedRef.current || !leftBattler || !rightBattler) return;
    if (state.phase !== "voting") return;

    hasRevealedRef.current = true;

    // Build the reveal timeline
    const timeline = gsap.timeline();

    // Phase: Sliding
    actions.setPhase("sliding");
    const slideTimeline = createSlideTimeline({
      refs,
      answerOrder: state.answerOrder,
    });
    timeline.add(slideTimeline);

    // Pause for reaction
    timeline.to({}, { duration: 0.8 });

    // Phase: Revealing votes
    timeline.call(() => actions.setPhase("revealing"));
    addVoteRevealToTimeline(timeline, {
      leftVotes: leftBattler.voteCount,
      rightVotes: rightBattler.voteCount,
      setDisplayedVotes: actions.setDisplayedVotes,
    });

    // Pause after votes shown
    timeline.to({}, { duration: 1 });

    // Phase: Attacking
    timeline.call(() => {
      actions.setPhase("attacking");

      const hasWinner = leftBattler.isWinner || rightBattler.isWinner;

      if (hasWinner) {
        playWinnerAttack({
          refs,
          actions,
          leftBattler,
          rightBattler,
          onDamageApplied: onDamageAppliedRef.current,
          onComplete: onBattleCompleteRef.current,
        });
      } else {
        // Tie
        playTieAttack({
          refs,
          actions,
          leftBattler,
          rightBattler,
          onDamageApplied: onDamageAppliedRef.current,
          onComplete: onBattleCompleteRef.current,
        });
      }
    });
  }, [isReveal, state.phase, state.answerOrder, leftBattler, rightBattler, refs, actions, hasRevealedRef]);

  // Update final states when complete
  useEffect(() => {
    if (state.phase === "complete" && leftBattler && rightBattler) {
      if (leftBattler.isWinner) {
        actions.setLeftFighterState("victory");
        actions.setRightFighterState("ko");
      } else if (rightBattler.isWinner) {
        actions.setRightFighterState("victory");
        actions.setLeftFighterState("ko");
      }
    }
  }, [state.phase, leftBattler, rightBattler, actions]);

  // Loading state
  if (!leftBattler || !rightBattler) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Waiting for battlers...
      </div>
    );
  }

  return (
    <BattleLayout
      leftBattler={leftBattler}
      rightBattler={rightBattler}
      promptText={promptText || ""}
      state={state}
      refs={refs}
    />
  );
}
