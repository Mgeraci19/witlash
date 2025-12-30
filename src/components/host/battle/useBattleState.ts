import { useState, useRef, useMemo, useCallback } from "react";
import { FighterState } from "../AvatarFighter";
import { RevealPhase, BattleRefs, BattleState, BattleActions, BattlerInfo } from "./types";

interface UseBattleStateOptions {
  promptId?: string;
  leftBattler: BattlerInfo | null;
  rightBattler: BattlerInfo | null;
}

export function useBattleState({ promptId, leftBattler, rightBattler }: UseBattleStateOptions) {
  // Phase tracking
  const [phase, setPhase] = useState<RevealPhase>("waiting");
  const [displayedVotes, setDisplayedVotes] = useState({ left: 0, right: 0 });
  const [tieMessage, setTieMessage] = useState<string | null>(null);

  // Fighter states
  const [leftFighterState, setLeftFighterState] = useState<FighterState>("idle");
  const [rightFighterState, setRightFighterState] = useState<FighterState>("idle");

  // Sequence tracking refs
  const hasStartedRef = useRef(false);
  const hasRevealedRef = useRef(false);

  // Randomize answer order (consistent for this prompt)
  const answerOrder = useMemo(() => {
    if (!leftBattler || !rightBattler) return { first: "left" as const, second: "right" as const };
    return Math.random() > 0.5
      ? { first: "left" as const, second: "right" as const }
      : { first: "right" as const, second: "left" as const };
  }, [promptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset function
  const reset = useCallback(() => {
    hasStartedRef.current = false;
    hasRevealedRef.current = false;
    setPhase("waiting");
    setDisplayedVotes({ left: 0, right: 0 });
    setTieMessage(null);
    setLeftFighterState("idle");
    setRightFighterState("idle");
  }, []);

  // Refs for animation targets - use useRef at top level, store in useMemo
  const arenaRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const leftFighterRef = useRef<HTMLDivElement>(null);
  const rightFighterRef = useRef<HTMLDivElement>(null);
  const answer1Ref = useRef<HTMLDivElement>(null);
  const answer2Ref = useRef<HTMLDivElement>(null);
  const vsBadgeRef = useRef<HTMLDivElement>(null);

  // Memoize refs object so it's stable
  const refs: BattleRefs = useMemo(() => ({
    arena: arenaRef,
    question: questionRef,
    leftFighter: leftFighterRef,
    rightFighter: rightFighterRef,
    answer1: answer1Ref,
    answer2: answer2Ref,
    vsBadge: vsBadgeRef,
  }), []);

  // Memoize state object
  const state: BattleState = useMemo(() => ({
    phase,
    displayedVotes,
    tieMessage,
    leftFighterState,
    rightFighterState,
    answerOrder,
  }), [phase, displayedVotes, tieMessage, leftFighterState, rightFighterState, answerOrder]);

  // Memoize actions object so it's stable
  const actions: BattleActions = useMemo(() => ({
    setPhase,
    setDisplayedVotes,
    setTieMessage,
    setLeftFighterState,
    setRightFighterState,
    reset,
  }), [reset]);

  return {
    refs,
    state,
    actions,
    hasStartedRef,
    hasRevealedRef,
  };
}
