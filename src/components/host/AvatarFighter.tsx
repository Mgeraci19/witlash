"use client";

import { forwardRef, useEffect, useRef } from "react";
import { gsap } from "./animations/gsapConfig";

export type FighterState = "idle" | "attacking" | "hurt" | "ko" | "victory";

interface AvatarFighterProps {
  /** Player name */
  name: string;
  /** Avatar image (base64 data URL) */
  avatar?: string;
  /** Which side of the arena */
  side: "left" | "right";
  /** Current animation state */
  state?: FighterState;
  /** Whether this fighter is the winner */
  isWinner?: boolean;
  /** Whether this fighter is knocked out */
  isKO?: boolean;
  /** Current win streak (shows warning at 2) */
  winStreak?: number;
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Additional CSS classes */
  className?: string;
}

/**
 * AvatarFighter - Large animated avatar for battle sequences
 *
 * Supports multiple states with automatic animations:
 * - idle: Subtle breathing animation
 * - attacking: No idle animation (controlled by BattleSequencer)
 * - hurt: Red flash effect
 * - ko: Grayscale + spin off (controlled by BattleSequencer)
 * - victory: Golden glow + bounce
 */
export const AvatarFighter = forwardRef<HTMLDivElement, AvatarFighterProps>(
  function AvatarFighter(
    {
      name,
      avatar,
      side,
      state = "idle",
      isWinner = false,
      isKO = false,
      winStreak = 0,
      size = "large",
      className = "",
    },
    ref
  ) {
    const innerRef = useRef<HTMLDivElement>(null);
    const idleAnimationRef = useRef<gsap.core.Tween | null>(null);

    // Size classes - responsive with mobile breakpoints
    const sizeClasses = {
      small: "w-24 h-24",
      medium: "w-32 h-32",
      // Large: 2x bigger - 384px on desktop, scales down on mobile
      large: "w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96",
    };

    // Idle breathing animation
    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      // Kill any existing animation
      idleAnimationRef.current?.kill();

      if (state === "idle") {
        // Subtle breathing effect - only use Y scale to avoid conflicts
        idleAnimationRef.current = gsap.to(el, {
          scaleY: 1.03,
          duration: 1.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }

      return () => {
        idleAnimationRef.current?.kill();
      };
    }, [state]);

    // Victory animation
    useEffect(() => {
      const el = innerRef.current;
      if (!el || state !== "victory") return;

      // Victory bounce
      gsap.to(el, {
        y: -20,
        duration: 0.3,
        ease: "power2.out",
        yoyo: true,
        repeat: 2,
      });
    }, [state]);

    // Hurt flash
    useEffect(() => {
      const el = innerRef.current;
      if (!el || state !== "hurt") return;

      gsap.to(el, {
        filter: "brightness(2) saturate(0.5)",
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          gsap.set(el, { filter: "none" });
        },
      });
    }, [state]);

    // Border/glow styling based on state
    const getBorderStyle = () => {
      if (isWinner || state === "victory") {
        return "border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]";
      }
      if (isKO || state === "ko") {
        return "border-gray-600 grayscale opacity-50";
      }
      if (state === "hurt") {
        return "border-red-500";
      }
      return "border-gray-600";
    };

    return (
      <div
        ref={ref}
        className={`relative flex flex-col items-center ${className}`}
        data-side={side}
        data-state={state}
      >
        {/* Avatar Container */}
        <div
          ref={innerRef}
          className={`
            relative
            ${sizeClasses[size]}
            rounded-xl
            border-4
            ${getBorderStyle()}
            overflow-hidden
            bg-gray-800
            transition-shadow duration-300
          `}
        >
          {/* Name Tag - Small tag at top of avatar */}
          <div
            className={`
              absolute top-2 left-1/2 -translate-x-1/2 z-10
              px-2 py-0.5 rounded text-xs font-bold
              ${isWinner ? "bg-yellow-500 text-black" : "bg-black/70 text-white"}
              backdrop-blur-sm
            `}
          >
            {name}
          </div>

          {avatar ? (
            <img
              src={avatar}
              alt={`${name}'s avatar`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-gray-500">
              ?
            </div>
          )}

          {/* KO Indicator */}
          {isKO && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-red-500 rotate-12">
              K.O.
            </div>
          )}
        </div>

        {/* 2-Win Streak Warning Badge - Shows when next win = FINISHER */}
        {winStreak === 2 && !isKO && (
          <div
            className="absolute -top-4 left-1/2 -translate-x-1/2 z-20
              bg-gradient-to-r from-orange-500 to-yellow-500 text-white
              px-3 py-1 rounded-full text-xs md:text-sm font-bold
              animate-pulse shadow-lg whitespace-nowrap"
            style={{
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              boxShadow: "0 0 15px rgba(255,165,0,0.6)",
            }}
          >
            🔥 NEXT WIN = FINISHER!
          </div>
        )}
      </div>
    );
  }
);
