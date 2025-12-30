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
      size = "large",
      className = "",
    },
    ref
  ) {
    const innerRef = useRef<HTMLDivElement>(null);
    const idleAnimationRef = useRef<gsap.core.Tween | null>(null);

    // Size classes
    const sizeClasses = {
      small: "w-24 h-24",
      medium: "w-32 h-32",
      large: "w-48 h-48",
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
            ${sizeClasses[size]}
            rounded-xl
            border-4
            ${getBorderStyle()}
            overflow-hidden
            bg-gray-800
            transition-shadow duration-300
          `}
        >
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
        </div>

        {/* Name Tag */}
        <div
          className={`
            mt-3 px-4 py-1 rounded-full text-lg font-bold
            ${isWinner ? "bg-yellow-500 text-black" : "bg-gray-700 text-white"}
          `}
        >
          {name}
        </div>

        {/* Winner Crown */}
        {isWinner && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl animate-bounce">
            👑
          </div>
        )}

        {/* KO Indicator */}
        {isKO && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-red-500 rotate-12">
            K.O.
          </div>
        )}
      </div>
    );
  }
);
