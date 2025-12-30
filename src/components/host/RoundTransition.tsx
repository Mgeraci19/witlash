"use client";

import { useEffect, useRef } from "react";
import { gsap } from "./animations/gsapConfig";
import { useScreenShake } from "./animations/useScreenShake";

interface RoundTransitionProps {
    roundNumber: number;
    subtitle?: string;
    onComplete: () => void;
}

export function RoundTransition({ roundNumber, subtitle = "FIGHT!", onComplete }: RoundTransitionProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const roundTextRef = useRef<HTMLDivElement>(null);
    const subtitleRef = useRef<HTMLDivElement>(null);
    const { containerRef, shake } = useScreenShake();

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
            }, "-=0.1")
            // Hold for viewing
            .to({}, { duration: 1.2 })
            // Fade out
            .to(overlayRef.current, {
                opacity: 0,
                duration: 0.4,
            });

        return () => {
            tl.kill();
        };
    }, [roundNumber, onComplete, shake]);

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
            </div>
        </div>
    );
}
