"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "../animations/gsapConfig";
import { AvatarFighter } from "../AvatarFighter";
import { TransitionProps } from "./types";

/**
 * CornerMenReveal - Shows teams with their corner men before Round 3
 *
 * Displays all surviving fighters with their assigned corner men,
 * highlighting the team structure for the Gauntlet round.
 */
export function CornerMenReveal({ gameState, onComplete }: TransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const teamsContainerRef = useRef<HTMLDivElement>(null);
  const [shouldSkip, setShouldSkip] = useState(false);
  const completedRef = useRef(false);

  // Stable reference to onComplete to prevent unnecessary re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Safe completion handler that ensures we only complete once
  const safeComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // Use requestAnimationFrame to ensure we're fully out of React's render cycle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onCompleteRef.current();
      });
    });
  }, []);

  // Get all active fighters (not knocked out)
  const fighters = gameState.players
    ?.filter((p) => p.role === "FIGHTER" && !p.knockedOut) || [];

  // Build teams: each fighter + their corner men
  const teams = fighters.map((fighter) => {
    const cornerMen = gameState.players
      ?.filter((p) => p.role === "CORNER_MAN" && p.teamId === fighter._id) || [];

    return {
      captain: fighter,
      cornerMen,
    };
  });

  // Handle skip case in useEffect to avoid setState during render
  useEffect(() => {
    if (teams.length === 0 && !completedRef.current) {
      setShouldSkip(true);
      safeComplete();
    }
  }, [teams.length, safeComplete]);

  useEffect(() => {
    // Don't run animation if we're skipping or already completed
    if (shouldSkip || teams.length === 0 || completedRef.current) {
      return;
    }

    if (!overlayRef.current || !titleRef.current || !teamsContainerRef.current) {
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        safeComplete();
      },
    });

    // Initial state
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(titleRef.current, { y: -50, opacity: 0 });
    gsap.set(teamsContainerRef.current, { scale: 0.8, opacity: 0 });

    // Animation sequence
    tl
      // Fade in backdrop
      .to(overlayRef.current, {
        opacity: 1,
        duration: 0.3,
      })
      // Slide in title
      .to(titleRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: "back.out(1.7)",
      }, "+=0.2")
      // Zoom in teams
      .to(teamsContainerRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
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
  }, [shouldSkip, teams.length, safeComplete]);

  // Early return AFTER hooks, just render nothing if skipping
  if (shouldSkip || teams.length === 0) {
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
          className="text-5xl md:text-7xl font-bold text-yellow-400 mb-12"
          style={{ textShadow: "0 0 40px rgba(255,200,0,0.8)" }}
        >
          THE TEAMS
        </div>

        {/* Teams Grid */}
        <div
          ref={teamsContainerRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl"
        >
          {teams.map((team) => (
            <div
              key={team.captain._id}
              className="flex flex-col items-center bg-gray-900/50 rounded-2xl p-8 border-4 border-yellow-500/30"
            >
              {/* Captain (larger) */}
              <div className="relative">
                <div className="absolute -top-4 -right-4 z-10 bg-yellow-400 text-black px-4 py-1 rounded-full font-bold text-sm">
                  CAPTAIN
                </div>
                <AvatarFighter
                  name={team.captain.name}
                  avatar={team.captain.avatar}
                  side="left"
                  state="idle"
                  size="large"
                />
              </div>
              <div className="mt-4 text-3xl font-bold text-white">
                {team.captain.name}
              </div>
              <div className="mt-2 text-xl text-green-400 font-bold">
                HP: {team.captain.hp}
              </div>

              {/* Corner Men (smaller, side-by-side) */}
              {team.cornerMen.length > 0 && (
                <div className="mt-8 pt-8 border-t-2 border-gray-700 w-full">
                  <div className="text-lg text-gray-400 mb-4 text-center">
                    Corner {team.cornerMen.length === 1 ? "Man" : "Men"}
                  </div>
                  <div className="flex justify-center gap-6">
                    {team.cornerMen.map((cornerMan) => (
                      <div key={cornerMan._id} className="flex flex-col items-center opacity-75">
                        <AvatarFighter
                          name={cornerMan.name}
                          avatar={cornerMan.avatar}
                          side="left"
                          state="idle"
                          size="small"
                        />
                        <div className="mt-2 text-sm text-gray-300">
                          {cornerMan.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No corner men indicator */}
              {team.cornerMen.length === 0 && (
                <div className="mt-8 pt-8 border-t-2 border-gray-700 w-full text-center text-gray-500 italic">
                  Fighting Solo
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Subtitle */}
        <div className="mt-12 text-2xl md:text-3xl text-gray-400 font-bold tracking-wider">
          ENTERING THE GAUNTLET
        </div>
      </div>
    </div>
  );
}
