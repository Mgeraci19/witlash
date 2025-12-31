/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "./animations/gsapConfig";

interface FighterHealthBarProps {
    name: string;
    hp: number;
    maxHp: number;
    side: "left" | "right";
    isWinner?: boolean;
    showDamage?: number; // Flash damage number when set
    avatar?: string; // Base64 avatar image
    specialBar?: number; // Special attack meter (0-3.0, triggers at 3.0)
    currentRound?: number; // For round-specific display
}

export function FighterHealthBar({ name, hp, maxHp, side, isWinner, showDamage, avatar, specialBar, currentRound }: FighterHealthBarProps) {
    console.log(`[FIGHTER HP BAR] Render - ${name}, specialBar: ${specialBar}`);

    const hpBarRef = useRef<HTMLDivElement>(null);
    const damageRef = useRef<HTMLDivElement>(null);
    const prevHpRef = useRef(hp);
    const [displayedHp, setDisplayedHp] = useState(hp);

    const hpPercentage = Math.max(0, (hp / maxHp) * 100);
    const hpColor = hpPercentage > 50 ? "bg-green-500" : hpPercentage > 25 ? "bg-yellow-500" : "bg-red-500";

    // Animate HP bar changes and number counting
    useEffect(() => {
        if (!hpBarRef.current) return;
        if (prevHpRef.current !== hp) {
            const previousHp = prevHpRef.current;

            // Quick punch animation on HP change
            gsap.fromTo(hpBarRef.current,
                { scaleY: 1.3 },
                { scaleY: 1, duration: 0.15, ease: "power2.out" }
            );

            // Animate the HP number counting down/up
            gsap.to({ value: previousHp }, {
                value: hp,
                duration: 0.3,
                ease: "power2.out",
                onUpdate: function() {
                    setDisplayedHp(Math.round(this.targets()[0].value));
                },
            });

            prevHpRef.current = hp;
        }
    }, [hp]);

    // Animate damage number
    useEffect(() => {
        if (!showDamage) return;

        // Wait for next frame to ensure ref is attached
        requestAnimationFrame(() => {
            if (!damageRef.current) return;

            gsap.fromTo(damageRef.current,
                { opacity: 1, y: 0, scale: 1.5 },
                { opacity: 0, y: -30, scale: 1, duration: 0.6, ease: "power2.out" }
            );
        });
    }, [showDamage]);

    return (
        <div className={`flex-1 ${side === "right" ? "text-right" : "text-left"}`}>
            {/* Avatar + Name Row */}
            <div className={`flex items-center gap-3 mb-1 ${side === "right" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                {avatar ? (
                    <img
                        src={avatar}
                        alt={`${name}'s avatar`}
                        className={`w-16 h-16 rounded-lg border-2 object-cover ${isWinner ? "border-yellow-400" : "border-gray-600"}`}
                    />
                ) : (
                    <div className={`w-16 h-16 rounded-lg border-2 bg-gray-700 flex items-center justify-center text-2xl text-gray-500 ${isWinner ? "border-yellow-400" : "border-gray-600"}`}>
                        ?
                    </div>
                )}

                {/* Fighter Name */}
                <div className={`text-2xl font-bold ${isWinner ? "text-yellow-400" : "text-white"}`}>
                    {name}
                </div>
            </div>

            {/* Special Bar - 3 segments that fill with wins (triggers KO at 3.0) */}
            <div className={`flex flex-col gap-1 mb-2`}>
                <div className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
                    <span className="text-xs text-gray-400 uppercase">Special</span>
                    <div className="flex gap-1">
                        {[0, 1, 2].map((segment) => (
                            <div
                                key={segment}
                                className={`w-8 h-4 rounded-sm border-2 transition-all duration-300 ${
                                    (specialBar ?? 0) > segment
                                        ? "bg-gradient-to-r from-orange-500 to-yellow-400 border-yellow-500 shadow-[0_0_10px_rgba(255,165,0,0.7)]"
                                        : "bg-gray-700 border-gray-600"
                                }`}
                            />
                        ))}
                    </div>
                    {(specialBar ?? 0) >= 2 && (
                        <span className={`text-xs font-bold animate-pulse ${
                            (specialBar ?? 0) >= 3 ? "text-red-500" : "text-yellow-400"
                        }`}>
                            {(specialBar ?? 0) >= 3
                                ? (currentRound === 3 ? "FINISHER!" : "KO!")
                                : "READY!"}
                        </span>
                    )}
                </div>
                {/* Final round clarification - special bar resets on loss */}
                {currentRound === 3 && (
                    <div className={`text-xs text-gray-500 ${side === "right" ? "text-right" : "text-left"}`}>
                        3 consecutive wins = Instant KO! {(specialBar ?? 0) > 0 ? "(Resets on loss)" : ""}
                    </div>
                )}
            </div>

            {/* HP Bar Container */}
            <div className={`relative h-6 bg-gray-800 rounded ${side === "right" ? "ml-auto" : "mr-auto"}`} style={{ maxWidth: "300px" }}>
                {/* HP Fill */}
                <div
                    ref={hpBarRef}
                    className={`h-full ${hpColor} rounded transition-all duration-300 origin-${side}`}
                    style={{
                        width: `${hpPercentage}%`,
                        float: side === "right" ? "right" : "left"
                    }}
                />

                {/* HP Text */}
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-lg">
                    {displayedHp}/{maxHp}
                </div>

                {/* Damage Number (floats up) */}
                {showDamage && showDamage > 0 && (
                    <div
                        ref={damageRef}
                        className="absolute -top-8 left-1/2 -translate-x-1/2 text-red-500 font-bold text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none z-10"
                        style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)' }}
                    >
                        -{showDamage}
                    </div>
                )}
            </div>
        </div>
    );
}
