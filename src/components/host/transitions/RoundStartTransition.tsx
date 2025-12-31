"use client";

import { useEffect, useRef } from "react";
import { gsap } from "../animations/gsapConfig";
import { useScreenShake } from "../animations/useScreenShake";
import { AvatarFighter } from "../AvatarFighter";
import { TransitionProps } from "./types";

/**
 * RoundStartTransition - Displays dramatic round number reveal
 *
 * Refactored from original RoundTransition to use new registry system.
 * Now decoupled from game routing logic.
 * Shows new corner men "debut" when transitioning to Round 2 or 3.
 */
export function RoundStartTransition({ gameState, onComplete }: TransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const roundTextRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const cornerMenRef = useRef<HTMLDivElement>(null);
  const { containerRef, shake } = useScreenShake();

  const roundNumber = gameState.currentRound;
  const roundSubtitles: Record<number, string> = {
    1: "THE OPENER",
    2: "THE CULL",
    3: "THE GAUNTLET",
    4: "SUDDEN DEATH",
  };
  const subtitle = roundSubtitles[roundNumber] || "FIGHT!";

  // Get corner men who became corner men in the PREVIOUS round
  // Round 2: Show players who became corner men in Round 1 (becameCornerManInRound === 1)
  // Round 3: Show players who became corner men in Round 2 (becameCornerManInRound === 2)
  const previousRound = roundNumber - 1;
  const newCornerMen = gameState.players?.filter(
    (p) => p.role === "CORNER_MAN" && p.teamId && p.becameCornerManInRound === previousRound
  ) || [];

  // Build corner man -> captain pairs for display
  const cornerManTeams = newCornerMen.map((cornerMan) => {
    const captain = gameState.players?.find((p) => p._id === cornerMan.teamId);
    return {
      cornerMan,
      captain,
    };
  }).filter((team) => team.captain); // Only include if captain exists

  // Show corner men section for Round 2 and 3 only (when there are new ones from previous round)
  const showCornerMen = (roundNumber === 2 || roundNumber === 3) && cornerManTeams.length > 0;

  // Round 2 gets a BYE message (captains with corner men skip Round 2 fights)
  const isRound2 = roundNumber === 2;

  useEffect(() => {
    if (!overlayRef.current || !roundTextRef.current || !subtitleRef.current) return;

    const tl = gsap.timeline({
      onComplete: () => {
        // Delay before calling onComplete to let the animation linger
        setTimeout(onComplete, 200);
      },
    });

    // Initial state
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(roundTextRef.current, { scale: 4, opacity: 0 });
    gsap.set(subtitleRef.current, { y: 50, opacity: 0 });
    if (cornerMenRef.current) {
      gsap.set(cornerMenRef.current, { y: 50, opacity: 0 });
    }

    // Animation sequence
    tl
      // Fade in backdrop
      .to(overlayRef.current, {
        opacity: 1,
        duration: 0.2,
      })
      // Slam in the round text
      .to(roundTextRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.3,
        ease: "back.out(2)",
      })
      // Trigger screen shake on impact
      .call(() => {
        shake("heavy");
      })
      // Slide in subtitle
      .to(subtitleRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.3,
        ease: "power2.out",
      }, "-=0.1");

    // If there are corner men to show, animate them in
    if (showCornerMen && cornerMenRef.current) {
      tl.to(cornerMenRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: "power2.out",
      }, "+=0.3");

      // Hold longer to show corner men
      tl.to({}, { duration: 2.5 });
    } else {
      // Normal hold duration
      tl.to({}, { duration: 1.2 });
    }

    // Fade out
    tl.to(overlayRef.current, {
      opacity: 0,
      duration: 0.4,
    });

    return () => {
      tl.kill();
    };
  }, [roundNumber, onComplete, shake, subtitle, showCornerMen]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center"
      >
        {/* Round Number */}
        <div
          ref={roundTextRef}
          className="text-center"
        >
          <div className="text-4xl text-gray-400 mb-2 font-bold tracking-widest">
            ROUND
          </div>
          <div
            className="text-[16rem] font-bold leading-none"
            style={{
              textShadow: "0 0 60px rgba(255,0,0,0.8), 0 0 120px rgba(255,0,0,0.4)",
              color: "#ff3333",
            }}
          >
            {roundNumber}
          </div>
        </div>

        {/* Subtitle */}
        <div
          ref={subtitleRef}
          className="mt-8 text-5xl font-bold tracking-wider text-yellow-400"
          style={{ textShadow: "0 0 30px rgba(255,200,0,0.6)" }}
        >
          {subtitle}
        </div>

        {/* Corner Men Debut - Shows fallen fighters who became corner men */}
        {showCornerMen && (
          <div
            ref={cornerMenRef}
            className="mt-12 w-full max-w-4xl px-8"
          >
            <div className="text-2xl text-gray-400 text-center mb-4 font-bold tracking-wide">
              {cornerManTeams.length === 1 ? "NEW CORNER MAN" : "NEW CORNER MEN"}
            </div>
            {/* BYE message for Round 2 only */}
            {isRound2 && (
              <div className="text-center mb-6">
                <span className="text-lg text-green-400 font-bold px-4 py-2 bg-green-900/40 rounded-lg border border-green-500/50">
                  Captains with Corner Men get a BYE this round!
                </span>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-8">
              {cornerManTeams.map(({ cornerMan, captain }) => (
                <div
                  key={cornerMan._id}
                  className="flex items-center gap-4 bg-gray-900/60 rounded-xl p-4 border-2 border-purple-500/50"
                >
                  {/* Corner Man */}
                  <div className="flex flex-col items-center">
                    <AvatarFighter
                      name={cornerMan.name}
                      avatar={cornerMan.avatar}
                      side="left"
                      state="idle"
                      size="small"
                    />
                    <div className="mt-2 text-lg font-bold text-purple-300">
                      {cornerMan.name}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-3xl text-purple-400">→</div>

                  {/* Captain */}
                  <div className="flex flex-col items-center">
                    <AvatarFighter
                      name={captain!.name}
                      avatar={captain!.avatar}
                      side="right"
                      state="idle"
                      size="small"
                    />
                    <div className="mt-2 text-lg font-bold text-white">
                      {captain!.name}
                    </div>
                    <div className="text-sm text-yellow-400 font-bold">
                      {isRound2 ? "CAPTAIN - BYE" : "CAPTAIN"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
