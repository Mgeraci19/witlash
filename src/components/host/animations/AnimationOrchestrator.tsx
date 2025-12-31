"use client";

import { useEffect, useRef, useMemo } from "react";
import type { GameState } from "@/lib/types";
import type { BattlerInfo } from "../battle/types";
import type { BattleSide } from "./core/types";
import type { AnimationContext } from "./core/types";
import { AnimationSequencer } from "./core/AnimationSequencer";
import { animationRegistry } from "./core/AnimationRegistry";
import { useBattleState } from "../battle/useBattleState";
import { BattleLayout } from "../battle/BattleLayout";

// Import animation definitions so they self-register
import "./definitions/battleEntry";
import "./definitions/attacks";
import "./definitions/battleReveal";
import "./definitions/utilityAnimations";

// Import sequences so they self-register
import "./sequences/battleSequence";
import "./sequences/roundTransitionSequence";

interface AnimationOrchestratorProps {
  gameState: GameState;
  currentPromptId?: string;
  promptText?: string;
  leftBattler: BattlerInfo | null;
  rightBattler: BattlerInfo | null;
  leftDamage: number;
  rightDamage: number;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
  onBattleComplete?: () => void;
}

/**
 * AnimationOrchestrator - Unified controller for all battle animations
 *
 * Responsibilities:
 * - Watch game state for changes (prompt, round)
 * - Select appropriate animation sequence
 * - Build animation context from game data
 * - Execute sequences via AnimationSequencer
 * - Manage battle state (refs, phase tracking)
 *
 * This replaces BattleArena.tsx with a cleaner, registry-based approach.
 */
export function AnimationOrchestrator({
  gameState,
  currentPromptId,
  promptText,
  leftBattler,
  rightBattler,
  leftDamage,
  rightDamage,
  onDamageApplied,
  onBattleComplete,
}: AnimationOrchestratorProps) {
  // Sequencer instance (persistent across renders)
  const sequencer = useRef(new AnimationSequencer());

  // Ref to always have latest gameState for condition checks
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Track previous state to detect changes
  const previousPromptRef = useRef(currentPromptId);

  // Battle state management (refs, phase tracking)
  const { refs, state, actions, hasStartedRef, hasRevealedRef } = useBattleState({
    promptId: currentPromptId,
    leftBattler,
    rightBattler,
  });

  // Store callbacks in refs to avoid stale closures
  const onBattleCompleteRef = useRef(onBattleComplete);
  const onDamageAppliedRef = useRef(onDamageApplied);
  onBattleCompleteRef.current = onBattleComplete;
  onDamageAppliedRef.current = onDamageApplied;

  // Store dynamic data in refs for getter functions (always current)
  const leftBattlerRef = useRef(leftBattler);
  const rightBattlerRef = useRef(rightBattler);
  const leftDamageRef = useRef(leftDamage);
  const rightDamageRef = useRef(rightDamage);
  leftBattlerRef.current = leftBattler;
  rightBattlerRef.current = rightBattler;
  leftDamageRef.current = leftDamage;
  rightDamageRef.current = rightDamage;

  // Build animation context (memoized to avoid recreating on every render)
  const animationContext: AnimationContext = useMemo(
    () => ({
      refs,
      leftBattler,
      rightBattler,
      promptText: promptText || "",
      promptId: currentPromptId,
      leftDamage,
      rightDamage,
      // Getter functions that return CURRENT data (not stale captured values)
      getLeftBattler: () => leftBattlerRef.current,
      getRightBattler: () => rightBattlerRef.current,
      getLeftDamage: () => leftDamageRef.current,
      getRightDamage: () => rightDamageRef.current,
      answerOrder: state.answerOrder,
      gameState,
      getGameState: () => gameStateRef.current, // Always return latest
      onDamageApplied: onDamageAppliedRef.current,
      onComplete: onBattleCompleteRef.current,
      setPhase: actions.setPhase,
      setFighterState: (side, fighterState) => {
        if (side === "left") {
          actions.setLeftFighterState(fighterState);
        } else {
          actions.setRightFighterState(fighterState);
        }
      },
      setDisplayedVotes: actions.setDisplayedVotes,
      setTieMessage: actions.setTieMessage,
    }),
    [
      refs,
      leftBattler,
      rightBattler,
      promptText,
      currentPromptId,
      leftDamage,
      rightDamage,
      state.answerOrder,
      gameState,
      actions,
    ]
  );

  // Log registry stats on mount (debug)
  useEffect(() => {
    const stats = animationRegistry.getStats();
    console.log("[AnimationOrchestrator] Registry stats:", stats);
  }, []);

  // Detect prompt change or initial load → play battle sequence
  useEffect(() => {
    if (!currentPromptId || !leftBattler || !rightBattler || !promptText) {
      return;
    }

    // Only start if prompt changed OR if we haven't started yet
    const hasPromptChanged = previousPromptRef.current !== currentPromptId;
    const shouldStart = hasPromptChanged || !hasStartedRef.current;

    if (shouldStart) {
      console.log(
        `[AnimationOrchestrator] ${hasPromptChanged ? "Prompt change" : "Initial load"}: ${currentPromptId}`
      );

      // Reset battle state
      actions.reset();
      hasStartedRef.current = true; // Mark as started
      hasRevealedRef.current = false;

      // Reset GSAP positions (important for clean start)
      requestAnimationFrame(() => {
        if (refs.leftFighter.current) {
          refs.leftFighter.current.style.transform = "";
        }
        if (refs.rightFighter.current) {
          refs.rightFighter.current.style.transform = "";
        }
        if (refs.question.current) {
          refs.question.current.style.transform = "";
          refs.question.current.style.opacity = "0";
          refs.question.current.style.visibility = "visible"; // Make visible for GSAP
        }
        if (refs.answer1.current) {
          refs.answer1.current.style.transform = "";
          refs.answer1.current.style.opacity = "0";
          refs.answer1.current.style.visibility = "visible"; // Make visible for GSAP
        }
        if (refs.answer2.current) {
          refs.answer2.current.style.transform = "";
          refs.answer2.current.style.opacity = "0";
          refs.answer2.current.style.visibility = "visible"; // Make visible for GSAP
        }
        if (refs.vsBadge.current) {
          refs.vsBadge.current.style.opacity = "1";
        }

        // Start sequence after DOM is ready
        const sequence = animationRegistry.getSequence("battle");
        if (sequence) {
          console.log("[AnimationOrchestrator] Starting battle sequence");
          sequencer.current.playSequence(sequence, animationContext);
        } else {
          console.error("[AnimationOrchestrator] Battle sequence not found!");
        }
      });

      previousPromptRef.current = currentPromptId;
    }
  }, [
    currentPromptId,
    leftBattler,
    rightBattler,
    promptText,
    animationContext,
    actions,
    refs,
    hasStartedRef,
    hasRevealedRef,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sequencer.current.stop();
    };
  }, []);

  // Loading state
  if (!leftBattler || !rightBattler) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Waiting for battlers...
      </div>
    );
  }

  // Render layout
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
