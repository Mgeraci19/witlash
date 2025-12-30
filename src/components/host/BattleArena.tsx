"use client";

import { useRef, useEffect, useState } from "react";
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
  /** Left side battler info */
  leftBattler: BattlerInfo | null;
  /** Right side battler info */
  rightBattler: BattlerInfo | null;
  /** Whether we're in reveal phase */
  isReveal: boolean;
  /** Current prompt ID (for reset detection) */
  promptId?: string;
  /** Callback when battle animation completes */
  onBattleComplete?: () => void;
  /** Callback when damage should be applied */
  onDamageApplied?: (side: BattleSide, damage: number) => void;
}

/**
 * BattleArena - Avatar-centric battle display with Street Fighter-style animations
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
  const vsRef = useRef<HTMLDivElement>(null);
  const leftAnswerRef = useRef<HTMLDivElement>(null);
  const rightAnswerRef = useRef<HTMLDivElement>(null);

  // Fighter states for visual feedback
  const [leftState, setLeftState] = useState<FighterState>("idle");
  const [rightState, setRightState] = useState<FighterState>("idle");
  const [showResults, setShowResults] = useState(false);

  // Track if we've animated this prompt
  const hasAnimatedRef = useRef(false);

  // Store callbacks in refs to avoid dependency issues
  const onBattleCompleteRef = useRef(onBattleComplete);
  const onDamageAppliedRef = useRef(onDamageApplied);
  onBattleCompleteRef.current = onBattleComplete;
  onDamageAppliedRef.current = onDamageApplied;

  // Initialize battle sequence hook
  const { state: battleState, actions: battleActions } = useBattleSequence({
    leftFighter: leftFighterRef,
    rightFighter: rightFighterRef,
    arenaContainer: arenaRef,
    onDamageApplied: (side, damage) => {
      // Flash hurt state on defender
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
      // Set final states based on current battler data
      setShowResults(true);
      onBattleCompleteRef.current?.();
    },
    onPhaseChange: (phase) => {
      if (phase === "attacking") {
        setLeftState("attacking");
      }
    },
  });

  // Store actions in ref to avoid dependency issues
  const battleActionsRef = useRef(battleActions);
  battleActionsRef.current = battleActions;

  // Reset when prompt changes
  useEffect(() => {
    hasAnimatedRef.current = false;
    setLeftState("idle");
    setRightState("idle");
    setShowResults(false);
    battleActionsRef.current.stop();

    // Reset positions
    if (leftFighterRef.current) gsap.set(leftFighterRef.current, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    if (rightFighterRef.current) gsap.set(rightFighterRef.current, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    if (vsRef.current) gsap.set(vsRef.current, { opacity: 1, scale: 1 });
    if (leftAnswerRef.current) gsap.set(leftAnswerRef.current, { opacity: 1, y: 0 });
    if (rightAnswerRef.current) gsap.set(rightAnswerRef.current, { opacity: 1, y: 0 });
  }, [promptId]);

  // Trigger battle on reveal
  useEffect(() => {
    if (!isReveal || hasAnimatedRef.current || !leftBattler || !rightBattler) return;

    hasAnimatedRef.current = true;

    // Determine winner
    const winner = leftBattler.isWinner ? leftBattler : rightBattler.isWinner ? rightBattler : null;
    const isTie = !winner && leftBattler.voteCount === rightBattler.voteCount;

    // Fade out VS badge first
    gsap.to(vsRef.current, {
      opacity: 0,
      scale: 0.5,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        if (winner) {
          // Calculate damage based on votes
          const damage = winner.voteCount * 5; // 5 damage per vote
          const isKO = false; // Could check if HP would go to 0

          // Update states for winner/loser
          if (leftBattler.isWinner) {
            setLeftState("attacking");
          } else {
            setRightState("attacking");
          }

          // Play battle animation
          battleActionsRef.current.playBattle({
            winnerId: winner.id,
            winnerSide: leftBattler.isWinner ? "left" : "right",
            loserId: leftBattler.isWinner ? rightBattler.id : leftBattler.id,
            loserSide: leftBattler.isWinner ? "right" : "left",
            damage,
            isKO,
            voteCount: winner.voteCount,
          });
        } else if (isTie) {
          // Just show results for tie
          setShowResults(true);
          onBattleCompleteRef.current?.();
        }
      },
    });
  }, [isReveal, leftBattler, rightBattler]);

  // Update final states when battle completes and we have results
  useEffect(() => {
    if (showResults && leftBattler && rightBattler) {
      if (leftBattler.isWinner) {
        setLeftState("victory");
        setRightState("ko");
      } else if (rightBattler.isWinner) {
        setRightState("victory");
        setLeftState("ko");
      }
    }
  }, [showResults, leftBattler, rightBattler]);

  if (!leftBattler || !rightBattler) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Waiting for battlers...
      </div>
    );
  }

  return (
    <div
      ref={arenaRef}
      className="relative w-full max-w-6xl mx-auto"
      data-battle-state={battleState.phase}
    >
      {/* Main Battle Area */}
      <div className="flex items-center justify-between gap-4 mb-8">
        {/* Left Fighter */}
        <div className="flex-1 flex flex-col items-center">
          <AvatarFighter
            ref={leftFighterRef}
            name={leftBattler.name}
            avatar={leftBattler.avatar}
            side="left"
            state={leftState}
            isWinner={showResults && leftBattler.isWinner}
            size="large"
          />
        </div>

        {/* VS Badge */}
        <div
          ref={vsRef}
          className="text-7xl font-bold text-red-500 px-8 z-10"
          style={{
            textShadow: "0 0 30px rgba(255,0,0,0.6), 0 0 60px rgba(255,0,0,0.3)",
            fontFamily: "'Impact', 'Arial Black', sans-serif",
          }}
        >
          VS
        </div>

        {/* Right Fighter */}
        <div className="flex-1 flex flex-col items-center">
          <AvatarFighter
            ref={rightFighterRef}
            name={rightBattler.name}
            avatar={rightBattler.avatar}
            side="right"
            state={rightState}
            isWinner={showResults && rightBattler.isWinner}
            size="large"
          />
        </div>
      </div>

      {/* Answer Cards Row */}
      <div className="flex gap-8 justify-center">
        {/* Left Answer */}
        <div
          ref={leftAnswerRef}
          className={`flex-1 max-w-md rounded-xl p-6 transition-all duration-300 ${
            showResults && leftBattler.isWinner
              ? "bg-green-900/40 ring-2 ring-yellow-400"
              : "bg-gray-800"
          }`}
        >
          <div className="text-xl text-white mb-4">{leftBattler.answer}</div>

          {showResults && (
            <>
              <div
                className={`text-3xl font-bold ${
                  leftBattler.isWinner ? "text-yellow-400" : "text-gray-500"
                }`}
              >
                {leftBattler.voteCount} {leftBattler.voteCount === 1 ? "vote" : "votes"}
              </div>

              {leftBattler.voters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-1">Voted by:</div>
                  <div className="flex flex-wrap gap-1">
                    {leftBattler.voters.map((voter, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700 px-2 py-1 rounded"
                      >
                        {voter}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Answer */}
        <div
          ref={rightAnswerRef}
          className={`flex-1 max-w-md rounded-xl p-6 transition-all duration-300 ${
            showResults && rightBattler.isWinner
              ? "bg-green-900/40 ring-2 ring-yellow-400"
              : "bg-gray-800"
          }`}
        >
          <div className="text-xl text-white mb-4">{rightBattler.answer}</div>

          {showResults && (
            <>
              <div
                className={`text-3xl font-bold ${
                  rightBattler.isWinner ? "text-yellow-400" : "text-gray-500"
                }`}
              >
                {rightBattler.voteCount} {rightBattler.voteCount === 1 ? "vote" : "votes"}
              </div>

              {rightBattler.voters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-1">Voted by:</div>
                  <div className="flex flex-wrap gap-1">
                    {rightBattler.voters.map((voter, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700 px-2 py-1 rounded"
                      >
                        {voter}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Battle Status */}
      {battleState.isPlaying && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-gray-400 bg-black/50 px-3 py-1 rounded">
          {battleState.phase === "attacking" && "FIGHT!"}
          {battleState.phase === "impact" && "HIT!"}
          {battleState.phase === "ko" && "K.O.!"}
        </div>
      )}
    </div>
  );
}
