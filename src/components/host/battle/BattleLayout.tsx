"use client";

import { AvatarFighter } from "../AvatarFighter";
import { BattlerInfo, BattleRefs, BattleState, getVisibilityFlags } from "./types";

interface BattleLayoutProps {
  leftBattler: BattlerInfo;
  rightBattler: BattlerInfo;
  promptText: string;
  state: BattleState;
  refs: BattleRefs;
}

/**
 * BattleLayout - Pure layout component
 *
 * Renders the battle arena layout without any animation logic.
 * All positioning is controlled by refs that GSAP can animate.
 */
export function BattleLayout({
  leftBattler,
  rightBattler,
  promptText,
  state,
  refs,
}: BattleLayoutProps) {
  const { phase, displayedVotes, tieMessage, leftFighterState, rightFighterState, answerOrder } = state;
  const { showVotes, showWinner, showAuthors } = getVisibilityFlags(phase);

  // Get answer data based on randomized order
  const firstAnswer = answerOrder.first === "left" ? leftBattler : rightBattler;
  const secondAnswer = answerOrder.second === "left" ? leftBattler : rightBattler;

  return (
    <div
      ref={refs.arena}
      className="relative w-full h-full flex flex-col overflow-hidden"
      data-phase={phase}
    >
      {/* Question - Large and prominent at top */}
      {/* Initial state set by GSAP in BattleArena reset effect */}
      <div
        ref={refs.question}
        className="text-center px-8 py-6 mb-4 invisible"
      >
        <div className="text-4xl md:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto">
          &ldquo;{promptText}&rdquo;
        </div>
      </div>

      {/* Main battle area */}
      <div className="flex-1 relative min-h-0">
        {/* Fighters - positioned on sides */}
        <div className="absolute inset-0 flex items-center justify-between px-8" style={{ zIndex: 10 }}>
          <div ref={refs.leftFighter}>
            <AvatarFighter
              name={leftBattler.name}
              avatar={leftBattler.avatar}
              side="left"
              state={leftFighterState}
              isWinner={showWinner && leftBattler.isWinner}
              size="large"
            />
          </div>
          <div ref={refs.rightFighter}>
            <AvatarFighter
              name={rightBattler.name}
              avatar={rightBattler.avatar}
              side="right"
              state={rightFighterState}
              isWinner={showWinner && rightBattler.isWinner}
              size="large"
            />
          </div>
        </div>

        {/* Answers - centered/stacked, GSAP animates to bottom corners */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 20 }}
        >
          <div className="flex flex-col items-center w-full max-w-2xl mx-auto pointer-events-auto">
            {/* First Answer - Initial state set by GSAP */}
            <div
              ref={refs.answer1}
              className={`
                w-full rounded-xl p-6 invisible
                transition-colors duration-300
                ${showWinner && firstAnswer.isWinner
                  ? "bg-green-900/50 ring-2 ring-yellow-400"
                  : showWinner && !firstAnswer.isWinner
                  ? "bg-gray-800/50 opacity-70"
                  : "bg-gray-800"
                }
              `}
            >
              {showAuthors && (
                <div className="text-sm text-gray-400 text-center mb-2">
                  {firstAnswer.name}
                </div>
              )}
              <div className="text-3xl md:text-4xl text-white text-center font-medium leading-relaxed">
                {firstAnswer.answer}
              </div>
              {showVotes && (
                <div className={`text-center mt-3 text-xl font-bold ${
                  showWinner && firstAnswer.isWinner ? "text-yellow-400" : "text-gray-400"
                }`}>
                  {answerOrder.first === "left" ? displayedVotes.left : displayedVotes.right} vote
                  {(answerOrder.first === "left" ? displayedVotes.left : displayedVotes.right) === 1 ? "" : "s"}
                </div>
              )}
            </div>

            {/* VS Badge */}
            <div
              ref={refs.vsBadge}
              className="text-5xl font-bold text-red-500 my-3"
              style={{
                textShadow: "0 0 20px rgba(255,0,0,0.5)",
                fontFamily: "'Impact', 'Arial Black', sans-serif",
              }}
            >
              VS
            </div>

            {/* Second Answer - Initial state set by GSAP */}
            <div
              ref={refs.answer2}
              className={`
                w-full rounded-xl p-6 invisible
                transition-colors duration-300
                ${showWinner && secondAnswer.isWinner
                  ? "bg-green-900/50 ring-2 ring-yellow-400"
                  : showWinner && !secondAnswer.isWinner
                  ? "bg-gray-800/50 opacity-70"
                  : "bg-gray-800"
                }
              `}
            >
              {showAuthors && (
                <div className="text-sm text-gray-400 text-center mb-2">
                  {secondAnswer.name}
                </div>
              )}
              <div className="text-3xl md:text-4xl text-white text-center font-medium leading-relaxed">
                {secondAnswer.answer}
              </div>
              {showVotes && (
                <div className={`text-center mt-3 text-xl font-bold ${
                  showWinner && secondAnswer.isWinner ? "text-yellow-400" : "text-gray-400"
                }`}>
                  {answerOrder.second === "left" ? displayedVotes.left : displayedVotes.right} vote
                  {(answerOrder.second === "left" ? displayedVotes.left : displayedVotes.right) === 1 ? "" : "s"}
                </div>
              )}
            </div>

            {/* Status Text */}
            {phase === "voting" && (
              <div className="mt-6 text-xl text-gray-400 animate-pulse">
                Players are voting...
              </div>
            )}
          </div>
        </div>

        {/* Tie Message */}
        {tieMessage && (
          <div
            className="absolute bottom-20 left-0 right-0 text-center text-3xl font-bold text-yellow-400 animate-pulse"
            style={{
              textShadow: "0 0 20px rgba(250,204,21,0.5)",
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              zIndex: 30,
            }}
          >
            {tieMessage}
          </div>
        )}
      </div>
    </div>
  );
}
