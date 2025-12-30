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
  promptText?: string;
  onBattleComplete?: () => void;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
}

type RevealPhase =
  | "waiting"       // Waiting for data
  | "question"      // Question animating in
  | "avatars_push"  // Avatars pushing to sides
  | "slam1"         // First answer slamming in
  | "slam2"         // Second answer slamming in
  | "voting"        // Players voting
  | "sliding"       // Answers sliding to sides
  | "revealing"     // Vote counts ticking up
  | "attacking"     // Attack animation
  | "complete";     // Done

/**
 * BattleArena - Phased battle display
 *
 * Flow:
 * 1. Question animates in prominently
 * 2. Avatars push from center to sides
 * 3. Answers slam into center (anonymous, randomized order)
 * 4. Players vote
 * 5. Answers slide to sides under avatars (constrained)
 * 6. Vote counts tick up, winner highlighted
 * 7. Quick attack animation
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
  // Refs for animation targets
  const leftFighterRef = useRef<HTMLDivElement>(null);
  const rightFighterRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const answer1Ref = useRef<HTMLDivElement>(null);
  const answer2Ref = useRef<HTMLDivElement>(null);

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
      speedMultiplier: 0.8,
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
    if (questionRef.current) gsap.set(questionRef.current, { opacity: 0, scale: 0.8, y: 20 });
    if (answer1Ref.current) gsap.set(answer1Ref.current, { opacity: 0, scale: 0.5 });
    if (answer2Ref.current) gsap.set(answer2Ref.current, { opacity: 0, scale: 0.5 });
  }, [promptId]);

  // Start the full sequence when we have battlers
  useEffect(() => {
    if (!leftBattler || !rightBattler || !promptText || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const timeline = gsap.timeline();

    // Phase 1: Question animates in
    setPhase("question");
    timeline.to(questionRef.current, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.5,
      ease: "back.out(1.5)",
    });

    // Hold for reading the question
    timeline.to({}, { duration: 3 });

    // Phase 2: Avatars are already on sides (static layout now)
    timeline.call(() => setPhase("avatars_push"));
    timeline.to({}, { duration: 0.3 });

    // Phase 3: Slam in first answer
    timeline.call(() => setPhase("slam1"));
    timeline.to(answer1Ref.current, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "back.out(2)",
    });

    // Pause for reading
    timeline.to({}, { duration: 2.5 });

    // Phase 4: Slam in second answer
    timeline.call(() => setPhase("slam2"));
    timeline.to(answer2Ref.current, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "back.out(2)",
    });

    // Move to voting phase
    timeline.call(() => setPhase("voting"), [], "+=0.5");
  }, [leftBattler, rightBattler, promptText]);

  // Handle reveal sequence
  useEffect(() => {
    if (!isReveal || hasRevealedRef.current || !leftBattler || !rightBattler) return;
    if (phase !== "voting") return;

    hasRevealedRef.current = true;

    const timeline = gsap.timeline();

    // Phase: Sliding
    setPhase("sliding");

    // Slide answers to their sides (using percentage-based positioning)
    const leftAnswerRef = answerOrder.first === "left" ? answer1Ref : answer2Ref;
    const rightAnswerRef = answerOrder.first === "right" ? answer1Ref : answer2Ref;

    // Slide left answer to left side
    timeline.to(leftAnswerRef.current, {
      x: "-60%",
      duration: 0.6,
      ease: "power2.out",
    }, 0);

    // Slide right answer to right side
    timeline.to(rightAnswerRef.current, {
      x: "60%",
      duration: 0.6,
      ease: "power2.out",
    }, 0);

    // Pause for reaction
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
      <div className="flex items-center justify-center h-full text-gray-500">
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
      className="relative w-full h-full flex flex-col overflow-hidden"
      data-phase={phase}
    >
      {/* Question - Large and prominent at top */}
      <div
        ref={questionRef}
        className="text-center px-8 py-6 mb-4"
        style={{ opacity: 0, transform: "scale(0.8) translateY(20px)" }}
      >
        <div className="text-4xl md:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto">
          &ldquo;{promptText}&rdquo;
        </div>
      </div>

      {/* Main battle area */}
      <div className="flex-1 flex items-center justify-between px-4 min-h-0">
        {/* Left Avatar */}
        <div className="flex-shrink-0 w-40 flex flex-col items-center">
          <AvatarFighter
            ref={leftFighterRef}
            name={leftBattler.name}
            avatar={leftBattler.avatar}
            side="left"
            state={leftState}
            isWinner={showWinner && leftBattler.isWinner}
            size="large"
          />
          {/* Vote display under avatar */}
          {isSlid && showVotes && (
            <div className={`mt-2 text-center ${showWinner && leftBattler.isWinner ? "text-yellow-400" : "text-gray-400"}`}>
              <div className="text-2xl font-bold">{displayedVotes.left}</div>
              <div className="text-xs">vote{displayedVotes.left === 1 ? "" : "s"}</div>
            </div>
          )}
        </div>

        {/* Center - Answers and VS */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 min-w-0 max-w-3xl mx-auto">
          {/* VS Badge */}
          <div
            className="text-5xl font-bold text-red-500 mb-4"
            style={{
              textShadow: "0 0 20px rgba(255,0,0,0.5)",
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              opacity: phase === "question" || phase === "avatars_push" || phase === "slam1" || phase === "slam2" || phase === "voting" ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          >
            VS
          </div>

          {/* Stacked Answers */}
          <div className="w-full space-y-4">
            {/* First Answer */}
            <div
              ref={answer1Ref}
              className={`
                w-full max-w-xl mx-auto
                rounded-xl p-5
                transition-colors duration-300
                ${showWinner && firstAnswer?.isWinner
                  ? "bg-green-900/50 ring-2 ring-yellow-400"
                  : showWinner && !firstAnswer?.isWinner
                  ? "bg-gray-800/50 opacity-70"
                  : "bg-gray-800"
                }
              `}
              style={{ opacity: 0, transform: "scale(0.5)" }}
            >
              <div className="text-2xl md:text-3xl text-white text-center font-medium leading-relaxed">
                {firstAnswer?.answer}
              </div>
            </div>

            {/* Second Answer */}
            <div
              ref={answer2Ref}
              className={`
                w-full max-w-xl mx-auto
                rounded-xl p-5
                transition-colors duration-300
                ${showWinner && secondAnswer?.isWinner
                  ? "bg-green-900/50 ring-2 ring-yellow-400"
                  : showWinner && !secondAnswer?.isWinner
                  ? "bg-gray-800/50 opacity-70"
                  : "bg-gray-800"
                }
              `}
              style={{ opacity: 0, transform: "scale(0.5)" }}
            >
              <div className="text-2xl md:text-3xl text-white text-center font-medium leading-relaxed">
                {secondAnswer?.answer}
              </div>
            </div>
          </div>

          {/* Status Text - Only one place now */}
          {phase === "voting" && (
            <div className="mt-6 text-xl text-gray-400 animate-pulse">
              Players are voting...
            </div>
          )}
        </div>

        {/* Right Avatar */}
        <div className="flex-shrink-0 w-40 flex flex-col items-center">
          <AvatarFighter
            ref={rightFighterRef}
            name={rightBattler.name}
            avatar={rightBattler.avatar}
            side="right"
            state={rightState}
            isWinner={showWinner && rightBattler.isWinner}
            size="large"
          />
          {/* Vote display under avatar */}
          {isSlid && showVotes && (
            <div className={`mt-2 text-center ${showWinner && rightBattler.isWinner ? "text-yellow-400" : "text-gray-400"}`}>
              <div className="text-2xl font-bold">{displayedVotes.right}</div>
              <div className="text-xs">vote{displayedVotes.right === 1 ? "" : "s"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
