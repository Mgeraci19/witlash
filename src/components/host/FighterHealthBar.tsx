"use client";

import { useEffect, useRef } from "react";
import { gsap } from "./animations/gsapConfig";

interface FighterHealthBarProps {
    name: string;
    hp: number;
    maxHp: number;
    side: "left" | "right";
    isWinner?: boolean;
    showDamage?: number; // Flash damage number when set
}

export function FighterHealthBar({ name, hp, maxHp, side, isWinner, showDamage }: FighterHealthBarProps) {
    const hpBarRef = useRef<HTMLDivElement>(null);
    const damageRef = useRef<HTMLDivElement>(null);
    const prevHpRef = useRef(hp);

    const hpPercentage = Math.max(0, (hp / maxHp) * 100);
    const hpColor = hpPercentage > 50 ? "bg-green-500" : hpPercentage > 25 ? "bg-yellow-500" : "bg-red-500";

    // Animate HP bar changes
    useEffect(() => {
        if (!hpBarRef.current) return;
        if (prevHpRef.current !== hp) {
            // Quick punch animation on HP change
            gsap.fromTo(hpBarRef.current,
                { scaleY: 1.3 },
                { scaleY: 1, duration: 0.15, ease: "power2.out" }
            );
            prevHpRef.current = hp;
        }
    }, [hp]);

    // Animate damage number
    useEffect(() => {
        if (!damageRef.current || !showDamage) return;

        gsap.fromTo(damageRef.current,
            { opacity: 1, y: 0, scale: 1.5 },
            { opacity: 0, y: -30, scale: 1, duration: 0.6, ease: "power2.out" }
        );
    }, [showDamage]);

    return (
        <div className={`flex-1 ${side === "right" ? "text-right" : "text-left"}`}>
            {/* Fighter Name */}
            <div className={`text-2xl font-bold mb-1 ${isWinner ? "text-yellow-400" : "text-white"}`}>
                {name}
                {isWinner && <span className="ml-2 text-sm">WINNER</span>}
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
                    {hp}/{maxHp}
                </div>

                {/* Damage Number (floats up) */}
                {showDamage && showDamage > 0 && (
                    <div
                        ref={damageRef}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 text-red-500 font-bold text-xl"
                    >
                        -{showDamage}
                    </div>
                )}
            </div>
        </div>
    );
}
