import { useCallback, useRef } from "react";
import { gsap } from "./gsapConfig";

type ShakeIntensity = "light" | "medium" | "heavy";

export function useScreenShake() {
    const containerRef = useRef<HTMLDivElement>(null);

    const shake = useCallback((intensity: ShakeIntensity = "medium") => {
        if (!containerRef.current) return;

        const intensityMap = {
            light: 5,
            medium: 15,
            heavy: 30,
        };

        const amount = intensityMap[intensity];

        gsap.to(containerRef.current, {
            x: `random(-${amount}, ${amount})`,
            y: `random(-${amount / 2}, ${amount / 2})`,
            duration: 0.05,
            repeat: intensity === "heavy" ? 12 : intensity === "medium" ? 8 : 4,
            yoyo: true,
            ease: "power1.inOut",
            onComplete: () => {
                gsap.set(containerRef.current, { x: 0, y: 0 });
            },
        });
    }, []);

    return { containerRef, shake };
}
