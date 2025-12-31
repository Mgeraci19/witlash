"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "../animations/gsapConfig";
import { AvatarFighter } from "../AvatarFighter";
import { TransitionProps } from "./types";

/**
 * PairingReveal - Shows Round 2 matchups after Round 2 ends
 *
 * Displays tournament bracket-style view of who fought whom in Round 2 (The Cull),
 * highlighting captains who had corner men support.
 */
export function PairingReveal({ gameState, onComplete }: TransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const pairingsContainerRef = useRef<HTMLDivElement>(null);
  const [shouldSkip, setShouldSkip] = useState(false);
  const completedRef = useRef(false);

  // Stable reference to onComplete
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Safe completion handler
  const safeComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onCompleteRef.current();
      });
    });
  }, []);

  // Get pairings from Round 2 snapshot
  const pairings = gameState.round2Pairings || [];

  // Get player data for each pairing
  const pairingData = pairings.map((pairing) => {
    const fighter1 = gameState.players?.find((p) => p._id === pairing.fighter1Id);
    const fighter2 = gameState.players?.find((p) => p._id === pairing.fighter2Id);

    // Get corner men for each fighter (the actual corner man objects)
    const fighter1CornerMen = gameState.players?.filter(
      (p) => p.role === "CORNER_MAN" && p.teamId === pairing.fighter1Id
    ) || [];
    const fighter2CornerMen = gameState.players?.filter(
      (p) => p.role === "CORNER_MAN" && p.teamId === pairing.fighter2Id
    ) || [];

    return {
      fighter1: fighter1!,
      fighter2: fighter2!,
      fighter1CornerMen,
      fighter2CornerMen,
    };
  }).filter((p) => p.fighter1 && p.fighter2); // Only valid pairings

  // Handle skip case in useEffect to avoid setState during render
  useEffect(() => {
    if (pairingData.length === 0 && !completedRef.current) {
      setShouldSkip(true);
      safeComplete();
    }
  }, [pairingData.length, safeComplete]);

  useEffect(() => {
    // Don't run animation if we're skipping or already completed
    if (shouldSkip || pairingData.length === 0 || completedRef.current) {
      return;
    }

    if (!overlayRef.current || !titleRef.current || !pairingsContainerRef.current) {
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setTimeout(() => safeComplete(), 300);
      },
    });

    // Initial state
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(titleRef.current, { scale: 0, opacity: 0 });
    gsap.set(pairingsContainerRef.current, { y: 50, opacity: 0 });

    // Animation sequence
    tl
      // Fade in backdrop
      .to(overlayRef.current, {
        opacity: 1,
        duration: 0.3,
      })
      // Slam in title
      .to(titleRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        ease: "back.out(2)",
      }, "+=0.2")
      // Slide in pairings
      .to(pairingsContainerRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
      }, "+=0.3")
      // Hold for viewing
      .to({}, { duration: 4 })
      // Fade out
      .to(overlayRef.current, {
        opacity: 0,
        duration: 0.5,
      });

    return () => {
      tl.kill();
    };
  }, [shouldSkip, pairingData.length, safeComplete]);

  // Early return AFTER hooks, just render nothing if skipping
  if (shouldSkip || pairingData.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8"
      >
        {/* Title */}
        <div
          ref={titleRef}
          className="text-5xl md:text-7xl font-bold text-red-400 mb-12"
          style={{
            textShadow: "0 0 40px rgba(239,68,68,0.8)",
            fontFamily: "'Impact', 'Arial Black', sans-serif",
          }}
        >
          THE CULL - MATCHUPS
        </div>

        {/* Pairings Grid */}
        <div
          ref={pairingsContainerRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl"
        >
          {pairingData.map((pairing, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-gray-900/50 rounded-2xl p-6 border-2 border-red-500/30"
            >
              {/* Fighter 1 with Corner Men behind */}
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  {/* Corner Men behind captain (stacked smaller) */}
                  {pairing.fighter1CornerMen.length > 0 && (
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-0">
                      {pairing.fighter1CornerMen.map((cm) => (
                        <div key={cm._id} className="opacity-70 scale-75">
                          <AvatarFighter
                            name={cm.name}
                            avatar={cm.avatar}
                            side="left"
                            state="idle"
                            size="small"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {pairing.fighter1CornerMen.length > 0 && (
                    <div className="absolute -top-3 -right-3 z-10 bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-xs">
                      CAPTAIN
                    </div>
                  )}
                  <AvatarFighter
                    name={pairing.fighter1.name}
                    avatar={pairing.fighter1.avatar}
                    side="left"
                    state={pairing.fighter1.knockedOut ? "ko" : "idle"}
                    size="medium"
                  />
                </div>
                <div className="mt-3 text-xl font-bold text-white text-center">
                  {pairing.fighter1.name}
                </div>
                <div
                  className={`mt-1 text-lg font-bold ${
                    pairing.fighter1.knockedOut ? "text-red-500" : "text-green-400"
                  }`}
                >
                  {pairing.fighter1.knockedOut ? "KO'd" : `HP: ${pairing.fighter1.hp}`}
                </div>
              </div>

              {/* VS Badge */}
              <div
                className="text-4xl font-bold text-red-500 mx-4"
                style={{
                  textShadow: "0 0 20px rgba(239,68,68,0.8)",
                  fontFamily: "'Impact', 'Arial Black', sans-serif",
                }}
              >
                VS
              </div>

              {/* Fighter 2 with Corner Men behind */}
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  {/* Corner Men behind captain (stacked smaller on right side) */}
                  {pairing.fighter2CornerMen.length > 0 && (
                    <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-0">
                      {pairing.fighter2CornerMen.map((cm) => (
                        <div key={cm._id} className="opacity-70 scale-75">
                          <AvatarFighter
                            name={cm.name}
                            avatar={cm.avatar}
                            side="right"
                            state="idle"
                            size="small"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {pairing.fighter2CornerMen.length > 0 && (
                    <div className="absolute -top-3 -left-3 z-10 bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-xs">
                      CAPTAIN
                    </div>
                  )}
                  <AvatarFighter
                    name={pairing.fighter2.name}
                    avatar={pairing.fighter2.avatar}
                    side="right"
                    state={pairing.fighter2.knockedOut ? "ko" : "idle"}
                    size="medium"
                  />
                </div>
                <div className="mt-3 text-xl font-bold text-white text-center">
                  {pairing.fighter2.name}
                </div>
                <div
                  className={`mt-1 text-lg font-bold ${
                    pairing.fighter2.knockedOut ? "text-red-500" : "text-green-400"
                  }`}
                >
                  {pairing.fighter2.knockedOut ? "KO'd" : `HP: ${pairing.fighter2.hp}`}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Subtitle */}
        <div className="mt-12 text-2xl md:text-3xl text-gray-400 font-bold tracking-wider">
          PREDATORY PAIRING - LOW VS LOW
        </div>
      </div>
    </div>
  );
}
