/* eslint-disable react-hooks/refs */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "../animations/gsapConfig";
import { useScreenShake } from "../animations/useScreenShake";
import { AvatarFighter } from "../AvatarFighter";
import { TransitionProps } from "./types";

/**
 * SuddenDeathIntro - Dramatic face-off animation for Final (Round 3)
 *
 * Shows the final two fighters in a Mortal Kombat-style VS screen
 * with split-screen avatars, dramatic lighting, and HP reset animation.
 */
export function SuddenDeathIntro({ gameState, onComplete }: TransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const leftFighterRef = useRef<HTMLDivElement>(null);
  const rightFighterRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const { containerRef, shake } = useScreenShake();
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

  // Get the two finalists (fighters with role "FIGHTER" in Final round)
  const finalists = gameState.players
    ?.filter((p) => p.role === "FIGHTER" && !p.knockedOut)
    .sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0))
    .slice(0, 2) || [];

  const leftFighter = finalists[0];
  const rightFighter = finalists[1];

  // Handle skip case in useEffect to avoid setState during render
  useEffect(() => {
    if ((!leftFighter || !rightFighter) && !completedRef.current) {
      setShouldSkip(true);
      safeComplete();
    }
  }, [leftFighter, rightFighter, safeComplete]);

  useEffect(() => {
    // Don't run animation if we're skipping or already completed
    if (shouldSkip || !leftFighter || !rightFighter || completedRef.current) {
      return;
    }

    if (!overlayRef.current || !leftFighterRef.current || !rightFighterRef.current || !textRef.current || !subtitleRef.current) {
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setTimeout(() => safeComplete(), 300);
      },
    });

    // Initial state
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(leftFighterRef.current, { x: -200, opacity: 0 });
    gsap.set(rightFighterRef.current, { x: 200, opacity: 0 });
    gsap.set(textRef.current, { scale: 0, opacity: 0, rotationZ: -45 });
    gsap.set(subtitleRef.current, { y: 50, opacity: 0 });

    // Animation sequence
    tl
      // Fade in backdrop
      .to(overlayRef.current, {
        opacity: 1,
        duration: 0.3,
      })
      // Slam fighters toward center from sides
      .to(leftFighterRef.current, {
        x: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
      }, "+=0.2")
      .to(rightFighterRef.current, {
        x: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
      }, "<") // Same time as left fighter
      // Screen shake on impact
      .call(() => {
        shake("heavy");
      })
      // Slam in "SUDDEN DEATH" text
      .to(textRef.current, {
        scale: 1,
        opacity: 1,
        rotationZ: 0,
        duration: 0.4,
        ease: "back.out(3)",
      }, "+=0.1")
      // Another shake
      .call(() => {
        shake("medium");
      })
      // Slide in subtitle
      .to(subtitleRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.3,
        ease: "power2.out",
      }, "+=0.2")
      // Hold for dramatic effect
      .to({}, { duration: 2.5 })
      // Fade out
      .to(overlayRef.current, {
        opacity: 0,
        duration: 0.5,
      });

    return () => {
      tl.kill();
    };
  }, [shouldSkip, leftFighter, rightFighter, shake, safeComplete]);

  // Early return AFTER hooks, just render nothing if skipping
  if (shouldSkip || !leftFighter || !rightFighter) {
    return null;
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black flex items-center justify-center"
        style={{
          background: "radial-gradient(ellipse at center, #1a0000 0%, #000000 100%)",
        }}
      >
        {/* Split-screen fighters */}
        <div className="absolute inset-0 flex items-center justify-between px-8 md:px-16">
          {/* Left Fighter */}
          <div ref={leftFighterRef} className="flex flex-col items-center">
            <AvatarFighter
              name={leftFighter.name}
              avatar={leftFighter.avatar}
              side="left"
              state="idle"
              size="large"
            />
            <div className="mt-4 text-3xl md:text-5xl font-bold text-white">
              {leftFighter.name}
            </div>
            <div className="mt-2 text-xl md:text-2xl text-green-400 font-bold">
              HP: {leftFighter.hp} → 200
            </div>
          </div>

          {/* Right Fighter */}
          <div ref={rightFighterRef} className="flex flex-col items-center">
            <AvatarFighter
              name={rightFighter.name}
              avatar={rightFighter.avatar}
              side="right"
              state="idle"
              size="large"
            />
            <div className="mt-4 text-3xl md:text-5xl font-bold text-white">
              {rightFighter.name}
            </div>
            <div className="mt-2 text-xl md:text-2xl text-green-400 font-bold">
              HP: {rightFighter.hp} → 200
            </div>
          </div>
        </div>

        {/* Center "LAST MAN STANDING" text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            ref={textRef}
            className="text-[6rem] md:text-[10rem] font-bold leading-none text-center"
            style={{
              textShadow: "0 0 60px rgba(255,0,0,1), 0 0 120px rgba(255,0,0,0.8), 0 0 180px rgba(255,0,0,0.6)",
              color: "#ff0000",
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              WebkitTextStroke: "3px #8b0000",
            }}
          >
            LAST MAN
            <br />
            STANDING
          </div>

          <div
            ref={subtitleRef}
            className="mt-4 text-2xl md:text-3xl font-bold tracking-wider text-yellow-400"
            style={{ textShadow: "0 0 30px rgba(255,200,0,0.8)" }}
          >
            Non-stop battles until one remains!
          </div>
        </div>

        {/* Lightning effects (decorative) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "repeating-linear-gradient(90deg, transparent, transparent 100px, rgba(255,0,0,0.05) 100px, rgba(255,0,0,0.05) 101px)",
            animation: "lightning 0.2s infinite",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes lightning {
          0%, 90%, 100% {
            opacity: 0;
          }
          92%, 94% {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
