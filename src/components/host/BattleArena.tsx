"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { AvatarFighter, FighterState } from "./AvatarFighter";
import { useBattleSequence } from "./animations/sequences";
import { BattleSide } from "./animations/registry/types";
import { gsap } from "./animations/gsapConfig";

interface BattlerInfo {
  id: string;
  name: string;
  avatar?: string;
  answer: string;
  voteCount: number;
  isWinner: boolean;
  voters: string[];
  hp: number;
  maxHp: number;
}

interface BattleArenaProps {
  leftBattler: BattlerInfo | null;
  rightBattler: BattlerInfo | null;
  isReveal: boolean;
  promptId?: string;
  onBattleComplete?: () => void;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
}

type RevealPhase =
  | "waiting"      // Waiting for answers
  | "slam1"        // First answer slamming in
  | "slam2"        // Second answer slamming in
  | "voting"       // Players voting
  | "sliding"      // Answers sliding to sides
  | "revealing"    // Vote counts ticking up
  | "attacking"    // Attack animation
  | "complete";    // Done

/**
 * BattleArena - Phased battle display
 *
 * Layout: Avatars on far left/right, answers in center (stacked → side by side)
 *
 * Flow:
 * 1. Answers slam into center (anonymous, randomized order, stacked)
 * 2. Players vote
 * 3. Answers slide to sides at same height (reveal who wrote what)
 * 4. Vote counts tick up, winner highlighted
 * 5. Quick attack animation
 */
export function BattleArena({
  leftBattler,
  rightBattler,
  isReveal,
  promptId,
  onBattleComplete,
  onDamageApplied,
}: BattleArenaProps) {
  // Refs for animation targets
  const leftFighterRef = useRef<HTMLDivElement>(null);
  const rightFighterRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const answer1Ref = useRef<HTMLDivElement>(null);
  const answer2Ref = useRef<HTMLDivElement>(null);
  const leftAnswerAreaRef = useRef<HTMLDivElement>(null);
  const rightAnswerAreaRef = useRef<HTMLDivElement>(null);

  // Phase tracking
  const [phase, setPhase] = useState<RevealPhase>("waiting");
  const [displayedVotes, setDisplayedVotes] = useState({ left: 0, right: 0 });

  // Fighter states
  const [leftState, setLeftState] = useState<FighterState>("idle");
  const [rightState, setRightState] = useState<FighterState>("idle");

  // Track if we've started the sequence for this prompt
  const hasStartedRef = useRef(false);
  const hasRevealedRef = useRef(false);

  // Randomize answer order (but remember mapping)
  const answerOrder = useMemo(() => {
    if (!leftBattler || !rightBattler) return { first: "left", second: "right" };
    // Randomly decide which answer shows first
    return Math.random() > 0.5
      ? { first: "left" as const, second: "right" as const }
      : { first: "right" as const, second: "left" as const };
  }, [promptId]); // Re-randomize on prompt change

  // Store callbacks in refs
  const onBattleCompleteRef = useRef(onBattleComplete);
  const onDamageAppliedRef = useRef(onDamageApplied);
  onBattleCompleteRef.current = onBattleComplete;
  onDamageAppliedRef.current = onDamageApplied;

  // Battle sequence hook for attack animation
  const { actions: battleActions } = useBattleSequence({
    leftFighter: leftFighterRef,
    rightFighter: rightFighterRef,
    arenaContainer: arenaRef,
    config: {
      speedMultiplier: 0.8, // Slightly faster for the quick attack
      shakeIntensity: 1.2,
    },
    onDamageApplied: (side, damage) => {
      if (side === "left") {
        setLeftState("hurt");
        setTimeout(() => setLeftState("idle"), 200);
      } else {
        setRightState("hurt");
        setTimeout(() => setRightState("idle"), 200);
      }
      onDamageAppliedRef.current?.(side, damage);
    },
    onSequenceComplete: () => {
      setPhase("complete");
      onBattleCompleteRef.current?.();
    },
  });

  const battleActionsRef = useRef(battleActions);
  battleActionsRef.current = battleActions;

  // Get answer data based on order
  const firstAnswer = answerOrder.first === "left" ? leftBattler : rightBattler;
  const secondAnswer = answerOrder.second === "left" ? leftBattler : rightBattler;

  // Reset on prompt change
  useEffect(() => {
    hasStartedRef.current = false;
    hasRevealedRef.current = false;
    setPhase("waiting");
    setDisplayedVotes({ left: 0, right: 0 });
    setLeftState("idle");
    setRightState("idle");
    battleActionsRef.current.stop();

    // Reset positions
    if (leftFighterRef.current) gsap.set(leftFighterRef.current, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    if (rightFighterRef.current) gsap.set(rightFighterRef.current, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    if (answer1Ref.current) gsap.set(answer1Ref.current, { opacity: 0, scale: 0.5, x: 0, y: 0 });
    if (answer2Ref.current) gsap.set(answer2Ref.current, { opacity: 0, scale: 0.5, x: 0, y: 0 });
  }, [promptId]);

  // Start slam-in sequence when we have battlers
  useEffect(() => {
    if (!leftBattler || !rightBattler || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const timeline = gsap.timeline();

    // Slam in first answer
    setPhase("slam1");
    timeline.to(answer1Ref.current, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "back.out(2)",
    });

    // Pause for reading
    timeline.to({}, { duration: 2.5 });

    // Slam in second answer
    timeline.call(() => setPhase("slam2"));
    timeline.to(answer2Ref.current, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "back.out(2)",
    });

    // Move to voting phase
    timeline.call(() => setPhase("voting"), [], "+=0.5");
  }, [leftBattler, rightBattler]);

  // Handle reveal sequence
  useEffect(() => {
    if (!isReveal || hasRevealedRef.current || !leftBattler || !rightBattler) return;
    if (phase !== "voting") return; // Wait until voting phase

    hasRevealedRef.current = true;

    const timeline = gsap.timeline();

    // Phase: Sliding - move answers to their side areas
    setPhase("sliding");

    // Get positions for sliding
    const leftArea = leftAnswerAreaRef.current;
    const rightArea = rightAnswerAreaRef.current;
    const answer1 = answer1Ref.current;
    const answer2 = answer2Ref.current;

    if (leftArea && rightArea && answer1 && answer2) {
      const leftAreaRect = leftArea.getBoundingClientRect();
      const rightAreaRect = rightArea.getBoundingClientRect();
      const answer1Rect = answer1.getBoundingClientRect();
      const answer2Rect = answer2.getBoundingClientRect();

      // Determine which answer goes where
      const leftAnswerEl = answerOrder.first === "left" ? answer1 : answer2;
      const rightAnswerEl = answerOrder.first === "right" ? answer1 : answer2;
      const leftAnswerRect = answerOrder.first === "left" ? answer1Rect : answer2Rect;
      const rightAnswerRect = answerOrder.first === "right" ? answer1Rect : answer2Rect;

      // Calculate target positions (center of each area)
      const leftTargetX = leftAreaRect.left + leftAreaRect.width / 2 - leftAnswerRect.left - leftAnswerRect.width / 2;
      const leftTargetY = leftAreaRect.top + leftAreaRect.height / 2 - leftAnswerRect.top - leftAnswerRect.height / 2;
      const rightTargetX = rightAreaRect.left + rightAreaRect.width / 2 - rightAnswerRect.left - rightAnswerRect.width / 2;
      const rightTargetY = rightAreaRect.top + rightAreaRect.height / 2 - rightAnswerRect.top - rightAnswerRect.height / 2;

      // Slide both answers simultaneously
      timeline.to(leftAnswerEl, {
        x: leftTargetX,
        y: leftTargetY,
        duration: 0.6,
        ease: "power2.out",
      }, 0);

      timeline.to(rightAnswerEl, {
        x: rightTargetX,
        y: rightTargetY,
        duration: 0.6,
        ease: "power2.out",
      }, 0);
    }

    // Pause for "who wrote that?!" reaction
    timeline.to({}, { duration: 1.2 });

    // Phase: Revealing votes
    timeline.call(() => setPhase("revealing"));

    // Tick up vote counts
    const leftVotes = leftBattler.voteCount;
    const rightVotes = rightBattler.voteCount;
    const maxVotes = Math.max(leftVotes, rightVotes, 1);
    const tickDuration = 0.5 / maxVotes;

    for (let i = 1; i <= maxVotes; i++) {
      timeline.call(() => {
        setDisplayedVotes({
          left: Math.min(i, leftVotes),
          right: Math.min(i, rightVotes),
        });
      }, [], `+=${tickDuration}`);
    }

    // Pause after votes shown
    timeline.to({}, { duration: 0.5 });

    // Phase: Attacking
    timeline.call(() => {
      setPhase("attacking");

      const winner = leftBattler.isWinner ? leftBattler : rightBattler.isWinner ? rightBattler : null;

      if (winner) {
        // Calculate damage based on votes (match backend logic closer)
        const totalVotes = leftBattler.voteCount + rightBattler.voteCount;
        const DAMAGE_CAP = 35;
        const loserVotes = winner === leftBattler ? rightBattler.voteCount : leftBattler.voteCount;
        const damage = totalVotes > 0 ? Math.floor((loserVotes / totalVotes) * DAMAGE_CAP) : 0;

        if (leftBattler.isWinner) {
          setLeftState("attacking");
        } else {
          setRightState("attacking");
        }

        battleActionsRef.current.playBattle({
          winnerId: winner.id,
          winnerSide: leftBattler.isWinner ? "left" : "right",
          loserId: leftBattler.isWinner ? rightBattler.id : leftBattler.id,
          loserSide: leftBattler.isWinner ? "right" : "left",
          damage,
          isKO: false,
          voteCount: winner.voteCount,
        });
      } else {
        // Tie - just complete
        setPhase("complete");
        onBattleCompleteRef.current?.();
      }
    });
  }, [isReveal, phase, leftBattler, rightBattler, answerOrder]);

  // Update final states when complete
  useEffect(() => {
    if (phase === "complete" && leftBattler && rightBattler) {
      if (leftBattler.isWinner) {
        setLeftState("victory");
        setRightState("ko");
      } else if (rightBattler.isWinner) {
        setRightState("victory");
        setLeftState("ko");
      }
    }
  }, [phase, leftBattler, rightBattler]);

  if (!leftBattler || !rightBattler) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Waiting for battlers...
      </div>
    );
  }

  const showVotes = phase === "revealing" || phase === "attacking" || phase === "complete";
  const showWinner = phase === "attacking" || phase === "complete";
  const isSlid = phase === "sliding" || phase === "revealing" || phase === "attacking" || phase === "complete";

  return (
    <div
      ref={arenaRef}
      className="relative w-full h-full flex"
      data-phase={phase}
    >
      {/* Left Side: Avatar + Answer landing zone */}
      <div className="flex flex-col items-center justify-center w-1/4 px-4">
        <AvatarFighter
          ref={leftFighterRef}
          name={leftBattler.name}
          avatar={leftBattler.avatar}
          side="left"
          state={leftState}
          isWinner={showWinner && leftBattler.isWinner}
          size="large"
        />
        {/* Answer landing zone */}
        <div
          ref={leftAnswerAreaRef}
          className="mt-4 w-full min-h-[120px] flex items-center justify-center"
        >
          {/* Votes display when slid */}
          {isSlid && showVotes && (
            <div className={`text-center ${showWinner && leftBattler.isWinner ? "text-yellow-400" : "text-gray-400"}`}>
              <div className="text-3xl font-bold">{displayedVotes.left}</div>
              <div className="text-sm">vote{displayedVotes.left === 1 ? "" : "s"}</div>
              {leftBattler.voters.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {leftBattler.voters.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Answers (stacked, then slide out) */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* VS Badge - only visible during early phases */}
        <div
          className="text-6xl font-bold text-red-500 mb-8"
          style={{
            textShadow: "0 0 20px rgba(255,0,0,0.5)",
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            opacity: phase === "waiting" || phase === "slam1" || phase === "slam2" || phase === "voting" ? 1 : 0,
            transition: "opacity 0.3s",
          }}
        >
          VS
        </div>

        {/* Stacked Answers Container */}
        <div className="relative w-full max-w-2xl">
          {/* First Answer (randomized) */}
          <div
            ref={answer1Ref}
            className={`
              w-full
              rounded-xl p-6 mb-6
              transition-all duration-300
              ${showWinner && firstAnswer?.isWinner
                ? "bg-green-900/50 ring-2 ring-yellow-400"
                : showWinner && !firstAnswer?.isWinner
                ? "bg-gray-800/50 opacity-70"
                : "bg-gray-800"
              }
            `}
            style={{
              opacity: 0,
              transform: "scale(0.5)"
            }}
          >
            <div className="text-3xl text-white text-center font-medium leading-relaxed">
              {firstAnswer?.answer}
            </div>
          </div>

          {/* Second Answer (randomized) */}
          <div
            ref={answer2Ref}
            className={`
              w-full
              rounded-xl p-6
              transition-all duration-300
              ${showWinner && secondAnswer?.isWinner
                ? "bg-green-900/50 ring-2 ring-yellow-400"
                : showWinner && !secondAnswer?.isWinner
                ? "bg-gray-800/50 opacity-70"
                : "bg-gray-800"
              }
            `}
            style={{
              opacity: 0,
              transform: "scale(0.5)"
            }}
          >
            <div className="text-3xl text-white text-center font-medium leading-relaxed">
              {secondAnswer?.answer}
            </div>
          </div>
        </div>

        {/* Status Text */}
        <div className="mt-8">
          {phase === "voting" && (
            <div className="text-2xl text-gray-400 animate-pulse">
              Players are voting...
            </div>
          )}
          {phase === "sliding" && (
            <div className="text-xl text-gray-500">
              Revealing authors...
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Avatar + Answer landing zone */}
      <div className="flex flex-col items-center justify-center w-1/4 px-4">
        <AvatarFighter
          ref={rightFighterRef}
          name={rightBattler.name}
          avatar={rightBattler.avatar}
          side="right"
          state={rightState}
          isWinner={showWinner && rightBattler.isWinner}
          size="large"
        />
        {/* Answer landing zone */}
        <div
          ref={rightAnswerAreaRef}
          className="mt-4 w-full min-h-[120px] flex items-center justify-center"
        >
          {/* Votes display when slid */}
          {isSlid && showVotes && (
            <div className={`text-center ${showWinner && rightBattler.isWinner ? "text-yellow-400" : "text-gray-400"}`}>
              <div className="text-3xl font-bold">{displayedVotes.right}</div>
              <div className="text-sm">vote{displayedVotes.right === 1 ? "" : "s"}</div>
              {rightBattler.voters.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {rightBattler.voters.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
