/* eslint-disable react-hooks/refs */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "../animations/gsapConfig";
import { AvatarFighter } from "../AvatarFighter";
import { TransitionProps } from "./types";

/**
 * TheCutReveal - Shows "The Cut" after Round 1 (Main Round)
 *
 * Displays all fighters ranked by HP:
 * - Top 4 advance to Semi-Finals (highlighted in green)
 * - Remaining fighters become corner men (shown in red/gray with assignments)
 * - Shows Semi-Final bracket matchups (#1 vs #4, #2 vs #3)
 */
export function TheCutReveal({ gameState, onComplete }: TransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const advancingContainerRef = useRef<HTMLDivElement>(null);
  const eliminatedContainerRef = useRef<HTMLDivElement>(null);
  const bracketContainerRef = useRef<HTMLDivElement>(null);
  const [shouldSkip, setShouldSkip] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const completedRef = useRef(false);

  // Stable reference to onComplete to prevent unnecessary re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Safe completion handler that ensures we only complete once
  const safeComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onCompleteRef.current();
      });
    });
  }, []);

  // Get all players and categorize them
  const allPlayers = gameState.players || [];

  // Semifinalists are FIGHTER role players who aren't knocked out
  const semifinalists = allPlayers
    .filter((p) => p.role === "FIGHTER" && !p.knockedOut)
    .sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0)); // Sort by HP descending

  // Eliminated players are now CORNER_MAN role with becameCornerManInRound === 1
  // OR they were just knocked out in Round 1
  const eliminated = allPlayers
    .filter((p) =>
      (p.role === "CORNER_MAN" && p.becameCornerManInRound === 1) ||
      (p.knockedOut && p.role !== "FIGHTER")
    )
    .sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0)); // Sort by HP descending

  // Build assignment map: corner man -> their captain
  const getAssignedCaptain = (cornerManId: string) => {
    const cornerMan = allPlayers.find(p => p._id === cornerManId);
    if (cornerMan?.teamId) {
      return allPlayers.find(p => p._id === cornerMan.teamId);
    }
    return null;
  };

  // Handle skip case if no data
  useEffect(() => {
    if (semifinalists.length === 0 && !completedRef.current) {
      setShouldSkip(true);
      safeComplete();
    }
  }, [semifinalists.length, safeComplete]);

  useEffect(() => {
    // Don't run animation if we're skipping or already completed
    if (shouldSkip || semifinalists.length === 0 || completedRef.current) {
      return;
    }

    if (!overlayRef.current || !titleRef.current || !subtitleRef.current || !advancingContainerRef.current) {
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        safeComplete();
      },
    });

    // Initial state
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(titleRef.current, { y: -100, opacity: 0, scale: 1.5 });
    gsap.set(subtitleRef.current, { y: 50, opacity: 0 });
    gsap.set(advancingContainerRef.current, { x: -100, opacity: 0 });
    if (eliminatedContainerRef.current) {
      gsap.set(eliminatedContainerRef.current, { x: 100, opacity: 0 });
    }

    // Animation sequence
    tl
      // Fade in backdrop
      .to(overlayRef.current, {
        opacity: 1,
        duration: 0.4,
      })
      // Dramatic title entrance
      .to(titleRef.current, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
      })
      // Subtitle fade in
      .to(subtitleRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: "power2.out",
      }, "-=0.2")
      // Slide in advancing fighters
      .to(advancingContainerRef.current, {
        x: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power3.out",
      }, "+=0.3");

    // Slide in eliminated if any
    if (eliminatedContainerRef.current && eliminated.length > 0) {
      tl.to(eliminatedContainerRef.current, {
        x: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power3.out",
      }, "-=0.3");
    }

    // Hold for viewing The Cut
    tl.to({}, { duration: 3 });

    // Transition to bracket view
    tl.call(() => {
      setShowBracket(true);
    });

    // Fade out current content (advancing/eliminated)
    tl.to([advancingContainerRef.current, eliminatedContainerRef.current].filter(Boolean), {
      opacity: 0,
      duration: 0.4,
    });

    // Update title and subtitle for bracket
    tl.to(titleRef.current, {
      opacity: 0,
      duration: 0.2,
    })
    .call(() => {
      if (titleRef.current) {
        titleRef.current.textContent = "SEMI-FINALS";
        (titleRef.current as HTMLElement).style.color = "#facc15"; // yellow-400
        (titleRef.current as HTMLElement).style.textShadow = "0 0 60px rgba(250,204,21,0.8), 0 0 100px rgba(250,204,21,0.4)";
      }
      if (subtitleRef.current) {
        subtitleRef.current.textContent = "The tournament bracket";
      }
    })
    .to(titleRef.current, {
      opacity: 1,
      duration: 0.3,
    });

    // Show bracket with animation
    if (bracketContainerRef.current) {
      gsap.set(bracketContainerRef.current, { opacity: 0, scale: 0.8 });
      tl.to(bracketContainerRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
      });
    }

    // Hold for viewing bracket
    tl.to({}, { duration: 4 });

    // Fade out
    tl.to(overlayRef.current, {
      opacity: 0,
      duration: 0.5,
    });

    return () => {
      tl.kill();
    };
  }, [shouldSkip, semifinalists.length, eliminated.length, safeComplete]);

  // Early return AFTER hooks
  if (shouldSkip || semifinalists.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 overflow-auto"
      >
        {/* Title */}
        <div ref={titleRef} className="text-center mb-4">
          <div
            className="text-6xl md:text-8xl font-black text-red-500 tracking-wider"
            style={{
              textShadow: "0 0 60px rgba(255,0,0,0.8), 0 0 100px rgba(255,0,0,0.4)",
              fontFamily: "Impact, sans-serif"
            }}
          >
            THE CUT
          </div>
        </div>

        {/* Subtitle */}
        <div ref={subtitleRef} className="text-center mb-8">
          <div className="text-2xl text-gray-300">
            Only the top 4 advance to the Semi-Finals
          </div>
        </div>

        {/* Two-column layout - The Cut view */}
        {!showBracket && (
          <div className="flex flex-col lg:flex-row gap-8 max-w-7xl w-full">
            {/* Advancing Fighters */}
            <div
              ref={advancingContainerRef}
              className="flex-1 bg-green-900/20 border-2 border-green-500/50 rounded-2xl p-6"
            >
              <h2 className="text-3xl font-bold text-green-400 mb-6 text-center">
                ADVANCING TO SEMI-FINALS
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {semifinalists.map((fighter, index) => (
                  <div
                    key={fighter._id}
                    className="flex flex-col items-center bg-gray-900/50 rounded-xl p-4 border border-green-500/30"
                  >
                    {/* Seed number */}
                    <div className="text-4xl font-black text-green-400 mb-2">
                      #{index + 1}
                    </div>

                    {/* Avatar */}
                    <AvatarFighter
                      name={fighter.name}
                      avatar={fighter.avatar}
                      side="left"
                      state="idle"
                      size="small"
                    />

                    {/* Name */}
                    <div className="mt-3 text-xl font-bold text-white text-center">
                      {fighter.name}
                    </div>

                    {/* HP */}
                    <div className="mt-1 text-lg font-semibold text-green-400">
                      {fighter.hp} HP
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Eliminated Fighters */}
            {eliminated.length > 0 && (
              <div
                ref={eliminatedContainerRef}
                className="flex-1 bg-red-900/20 border-2 border-red-500/30 rounded-2xl p-6"
              >
                <h2 className="text-3xl font-bold text-red-400 mb-6 text-center">
                  ELIMINATED
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {eliminated.map((fighter, index) => {
                    const captain = getAssignedCaptain(fighter._id);
                    return (
                      <div
                        key={fighter._id}
                        className="flex flex-col items-center bg-gray-900/50 rounded-xl p-4 border border-red-500/20 opacity-75"
                      >
                        {/* Rank (5th, 6th, etc.) */}
                        <div className="text-2xl font-bold text-red-400/70 mb-2">
                          #{semifinalists.length + index + 1}
                        </div>

                        {/* Avatar - smaller and grayed out */}
                        <div className="opacity-60 scale-75">
                          <AvatarFighter
                            name={fighter.name}
                            avatar={fighter.avatar}
                            side="left"
                            state="ko"
                            size="small"
                            isKO={true}
                          />
                        </div>

                        {/* Name with strikethrough */}
                        <div className="mt-2 text-lg font-bold text-gray-400 text-center line-through">
                          {fighter.name}
                        </div>

                        {/* HP */}
                        <div className="text-sm text-red-400/70">
                          {fighter.hp} HP
                        </div>

                        {/* Corner man assignment */}
                        {captain && (
                          <div className="mt-2 text-sm text-purple-300 text-center">
                            Now supporting {captain.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tournament Bracket View */}
        {showBracket && (
          <div
            ref={bracketContainerRef}
            className="w-full max-w-5xl"
          >
            {/* Bracket container */}
            <div className="flex items-center justify-center gap-8">
              {/* Left side - Match 1: #1 vs #4 */}
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-gray-400 mb-4">MATCH 1</div>
                <div className="flex flex-col gap-4">
                  {/* #1 Seed */}
                  <div className="flex items-center gap-4 bg-gray-900/80 rounded-xl p-4 border-2 border-yellow-500/50">
                    <div className="text-3xl font-black text-yellow-400">#1</div>
                    <AvatarFighter
                      name={semifinalists[0]?.name || "TBD"}
                      avatar={semifinalists[0]?.avatar}
                      side="left"
                      state="idle"
                      size="small"
                    />
                    <div className="text-xl font-bold text-white">
                      {semifinalists[0]?.name || "TBD"}
                    </div>
                    <div className="text-lg text-green-400 ml-auto">
                      {semifinalists[0]?.hp || 0} HP
                    </div>
                  </div>

                  {/* VS */}
                  <div className="text-3xl font-black text-red-500 text-center"
                    style={{ textShadow: "0 0 20px rgba(255,0,0,0.5)" }}
                  >
                    VS
                  </div>

                  {/* #4 Seed */}
                  <div className="flex items-center gap-4 bg-gray-900/80 rounded-xl p-4 border-2 border-gray-500/50">
                    <div className="text-3xl font-black text-gray-400">#4</div>
                    <AvatarFighter
                      name={semifinalists[3]?.name || "TBD"}
                      avatar={semifinalists[3]?.avatar}
                      side="left"
                      state="idle"
                      size="small"
                    />
                    <div className="text-xl font-bold text-white">
                      {semifinalists[3]?.name || "TBD"}
                    </div>
                    <div className="text-lg text-green-400 ml-auto">
                      {semifinalists[3]?.hp || 0} HP
                    </div>
                  </div>
                </div>
              </div>

              {/* Center - Finals placeholder */}
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-yellow-400 mb-4"
                  style={{ textShadow: "0 0 30px rgba(250,204,21,0.5)" }}
                >
                  FINAL
                </div>
                <div className="w-48 h-32 border-2 border-dashed border-yellow-500/30 rounded-xl flex items-center justify-center">
                  <div className="text-xl text-gray-500">Winner</div>
                </div>
                <div className="my-4 text-4xl">🏆</div>
                <div className="w-48 h-32 border-2 border-dashed border-yellow-500/30 rounded-xl flex items-center justify-center">
                  <div className="text-xl text-gray-500">Winner</div>
                </div>
              </div>

              {/* Right side - Match 2: #2 vs #3 */}
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-gray-400 mb-4">MATCH 2</div>
                <div className="flex flex-col gap-4">
                  {/* #2 Seed */}
                  <div className="flex items-center gap-4 bg-gray-900/80 rounded-xl p-4 border-2 border-gray-300/50">
                    <div className="text-lg text-green-400 mr-auto">
                      {semifinalists[1]?.hp || 0} HP
                    </div>
                    <div className="text-xl font-bold text-white">
                      {semifinalists[1]?.name || "TBD"}
                    </div>
                    <AvatarFighter
                      name={semifinalists[1]?.name || "TBD"}
                      avatar={semifinalists[1]?.avatar}
                      side="right"
                      state="idle"
                      size="small"
                    />
                    <div className="text-3xl font-black text-gray-300">#2</div>
                  </div>

                  {/* VS */}
                  <div className="text-3xl font-black text-red-500 text-center"
                    style={{ textShadow: "0 0 20px rgba(255,0,0,0.5)" }}
                  >
                    VS
                  </div>

                  {/* #3 Seed */}
                  <div className="flex items-center gap-4 bg-gray-900/80 rounded-xl p-4 border-2 border-gray-500/50">
                    <div className="text-lg text-green-400 mr-auto">
                      {semifinalists[2]?.hp || 0} HP
                    </div>
                    <div className="text-xl font-bold text-white">
                      {semifinalists[2]?.name || "TBD"}
                    </div>
                    <AvatarFighter
                      name={semifinalists[2]?.name || "TBD"}
                      avatar={semifinalists[2]?.avatar}
                      side="right"
                      state="idle"
                      size="small"
                    />
                    <div className="text-3xl font-black text-gray-400">#3</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
