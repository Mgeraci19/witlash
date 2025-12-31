"use client";

import { AvatarFighter } from "../AvatarFighter";
import { BattlerInfo, BattleRefs, BattleState, getVisibilityFlags } from "./types";

function formatSubmissionTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

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
      {/* Question - Large and prominent at top, nestled between health bars */}
      {/* Initial state set by GSAP in BattleArena reset effect */}
      <div
        ref={refs.question}
        className="text-center px-4 md:px-8 py-2 md:py-3 mb-2"
        style={{ visibility: 'hidden' }}
      >
        <div className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto">
          &ldquo;{promptText}&rdquo;
        </div>
      </div>

      {/* Main battle area */}
      <div className="flex-1 relative min-h-0">
        {/* Fighters - positioned at edges, moved up to accommodate larger size */}
        <div className="absolute inset-0 flex items-start justify-between px-2 md:px-4 pt-2 md:pt-4" style={{ zIndex: 10 }}>
          <div ref={refs.leftFighter}>
            <AvatarFighter
              name={leftBattler.name}
              avatar={leftBattler.avatar}
              side="left"
              state={leftFighterState}
              isWinner={showWinner && leftBattler.isWinner}
              winStreak={leftBattler.winStreak}
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
              winStreak={rightBattler.winStreak}
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
              style={{ visibility: 'hidden' }}
              className={`
                w-full rounded-xl p-4 md:p-6
                transition-colors duration-300
                ${showWinner && firstAnswer.isWinner
                  ? "bg-green-900 ring-2 ring-yellow-400"
                  : "bg-gray-800"
                }
              `}
            >
              {showAuthors && (
                <>
                  <div className="text-base md:text-lg text-gray-400 text-center mb-1">
                    {firstAnswer.name}
                  </div>
                  {firstAnswer.submissionTime && (
                    <div className="text-xs text-gray-500 text-center mb-2">
                      Submitted: {formatSubmissionTime(firstAnswer.submissionTime)}
                    </div>
                  )}
                </>
              )}
              <div className="text-xl md:text-2xl lg:text-3xl text-white text-center font-medium leading-relaxed">
                {firstAnswer.answer}
              </div>
              {showVotes && (
                <>
                  <div className={`text-center mt-3 text-xl md:text-2xl font-bold ${
                    showWinner && firstAnswer.isWinner ? "text-yellow-400" : "text-gray-300"
                  }`}>
                    {firstAnswer.voteCount} vote{firstAnswer.voteCount === 1 ? "" : "s"}
                  </div>
                  {firstAnswer.voters && firstAnswer.voters.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {firstAnswer.voters.map((voter, i) => (
                        <div
                          key={i}
                          className="px-3 py-1 bg-blue-600/30 text-blue-200 rounded-full font-bold text-sm md:text-base border border-blue-400/50"
                        >
                          {voter}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* VS Badge - higher z-index to stay on top of answers during animations */}
            <div
              ref={refs.vsBadge}
              className="text-5xl font-bold text-red-500 my-3 relative"
              style={{
                textShadow: "0 0 20px rgba(255,0,0,0.5)",
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                zIndex: 10,
              }}
            >
              VS
            </div>

            {/* Second Answer - Initial state set by GSAP */}
            <div
              ref={refs.answer2}
              style={{ visibility: 'hidden' }}
              className={`
                w-full rounded-xl p-4 md:p-6
                transition-colors duration-300
                ${showWinner && secondAnswer.isWinner
                  ? "bg-green-900 ring-2 ring-yellow-400"
                  : "bg-gray-800"
                }
              `}
            >
              {showAuthors && (
                <>
                  <div className="text-base md:text-lg text-gray-400 text-center mb-1">
                    {secondAnswer.name}
                  </div>
                  {secondAnswer.submissionTime && (
                    <div className="text-xs text-gray-500 text-center mb-2">
                      Submitted: {formatSubmissionTime(secondAnswer.submissionTime)}
                    </div>
                  )}
                </>
              )}
              <div className="text-xl md:text-2xl lg:text-3xl text-white text-center font-medium leading-relaxed">
                {secondAnswer.answer}
              </div>
              {showVotes && (
                <>
                  <div className={`text-center mt-3 text-xl md:text-2xl font-bold ${
                    showWinner && secondAnswer.isWinner ? "text-yellow-400" : "text-gray-300"
                  }`}>
                    {secondAnswer.voteCount} vote{secondAnswer.voteCount === 1 ? "" : "s"}
                  </div>
                  {secondAnswer.voters && secondAnswer.voters.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {secondAnswer.voters.map((voter, i) => (
                        <div
                          key={i}
                          className="px-3 py-1 bg-blue-600/30 text-blue-200 rounded-full font-bold text-sm md:text-base border border-blue-400/50"
                        >
                          {voter}
                        </div>
                      ))}
                    </div>
                  )}
                </>
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

        {/* Message Overlay (K.O., FINISHER!, Combo, Tie, etc.) */}
        {tieMessage && (
          tieMessage === "K.O." ? (
            // BIG dramatic K.O. display
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/60"
              style={{ zIndex: 50 }}
            >
              <div
                className="text-[12rem] md:text-[16rem] font-black text-red-500 animate-pulse"
                style={{
                  textShadow: "0 0 60px rgba(239,68,68,0.9), 0 0 120px rgba(239,68,68,0.6), 0 0 180px rgba(239,68,68,0.3)",
                  fontFamily: "'Impact', 'Arial Black', sans-serif",
                  letterSpacing: "0.1em",
                  WebkitTextStroke: "4px #991b1b",
                }}
              >
                K.O.
              </div>
            </div>
          ) : tieMessage === "FINISHER!" ? (
            // DRAMATIC GOLDEN FINISHER display
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/70"
              style={{ zIndex: 50 }}
            >
              <div className="relative">
                {/* Glow effect behind text */}
                <div
                  className="absolute inset-0 blur-xl"
                  style={{
                    background: "radial-gradient(ellipse at center, rgba(255,215,0,0.6) 0%, rgba(255,165,0,0.3) 50%, transparent 70%)",
                  }}
                />
                <div
                  className="text-[10rem] md:text-[14rem] font-black animate-pulse relative"
                  style={{
                    color: "#FFD700", // Gold
                    textShadow: `
                      0 0 40px rgba(255,215,0,1),
                      0 0 80px rgba(255,165,0,0.8),
                      0 0 120px rgba(255,140,0,0.6),
                      0 0 200px rgba(255,100,0,0.4)
                    `,
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                    letterSpacing: "0.05em",
                    WebkitTextStroke: "3px #B8860B", // DarkGoldenrod stroke
                  }}
                >
                  FINISHER!
                </div>
              </div>
            </div>
          ) : (
            // Regular message (combo, tie, etc.)
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
          )
        )}
      </div>
    </div>
  );
}
