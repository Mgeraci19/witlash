"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { GameState } from "@/lib/types";
import { FighterPlaceholder } from "./FighterPlaceholder";
import { api } from "../../../convex/_generated/api";
import { AUTO_ADVANCE } from "./animations/config";

interface HostRoundResultsViewProps {
    game: GameState;
}

export function HostRoundResultsView({ game }: HostRoundResultsViewProps) {
    const hostTriggerNextRound = useMutation(api.engine.hostTriggerNextRound);
    const autoAdvanceScheduledRef = useRef(false);

    // Log on mount
    useEffect(() => {
        console.log("[HostRoundResultsView] Mounted, round:", game.currentRound);
        return () => console.log("[HostRoundResultsView] Unmounted");
    }, [game.currentRound]);

    // Auto-advance effect: trigger nextRound after delay
    useEffect(() => {
        console.log("[AUTO-ADVANCE ROUND] Effect running, scheduled:", autoAdvanceScheduledRef.current);

        // Don't auto-advance if already scheduled
        if (autoAdvanceScheduledRef.current) {
            console.log("[AUTO-ADVANCE ROUND] Already scheduled, skipping");
            return;
        }

        // Get host token from sessionStorage
        const hostToken = sessionStorage.getItem("hostToken");
        console.log("[AUTO-ADVANCE ROUND] hostToken:", hostToken ? "found" : "NOT FOUND");
        if (!hostToken) {
            console.log("[AUTO-ADVANCE ROUND] No host token found, skipping auto-advance");
            return;
        }

        autoAdvanceScheduledRef.current = true;
        console.log(`[AUTO-ADVANCE ROUND] Scheduling nextRound in ${AUTO_ADVANCE.ROUND_DELAY}ms for game ${game._id}`);

        const timer = setTimeout(() => {
            console.log("[AUTO-ADVANCE ROUND] Timer fired, triggering nextRound");
            hostTriggerNextRound({ gameId: game._id, hostToken })
                .then(() => console.log("[AUTO-ADVANCE ROUND] nextRound succeeded"))
                .catch((err) => console.error("[AUTO-ADVANCE ROUND] Error:", err));
        }, AUTO_ADVANCE.ROUND_DELAY);

        return () => {
            console.log("[AUTO-ADVANCE ROUND] Cleanup - clearing timer and resetting flag");
            clearTimeout(timer);
            autoAdvanceScheduledRef.current = false; // Reset so it can reschedule on remount
        };
    }, [game._id, hostTriggerNextRound]);
    // Sort fighters by HP (highest first), then filter out corner men
    const fighters = game.players
        .filter(p => p.role === "FIGHTER")
        .sort((a, b) => (b.hp || 0) - (a.hp || 0));

    const knockedOut = fighters.filter(p => p.knockedOut);
    const stillStanding = fighters.filter(p => !p.knockedOut);

    return (
        <div
            id="host-round-results"
            data-phase="ROUND_RESULTS"
            data-round={game.currentRound}
            className="flex flex-col items-center justify-center min-h-screen p-8"
        >
            {/* Round Complete Header */}
            <h1 className="text-6xl font-bold mb-4 text-center">
                ROUND {game.currentRound} COMPLETE
            </h1>

            <p className="text-2xl text-gray-400 mb-12">
                {game.currentRound < (game.maxRounds || 3) ? "Prepare for the next round!" : "Final standings!"}
            </p>

            {/* Standings */}
            <div className="w-full max-w-4xl">
                <h2 className="text-3xl font-bold mb-6 text-center">STANDINGS</h2>

                {/* Still Standing */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
                    {stillStanding.map((fighter, index) => (
                        <div
                            key={fighter._id}
                            className="flex flex-col items-center"
                        >
                            {/* Rank */}
                            <div className="text-4xl font-bold text-yellow-400 mb-2">
                                #{index + 1}
                            </div>

                            <FighterPlaceholder
                                name={fighter.name}
                                hp={fighter.hp}
                                maxHp={fighter.maxHp}
                                isKnockedOut={fighter.knockedOut}
                                size="medium"
                                avatar={fighter.avatar}
                            />
                        </div>
                    ))}
                </div>

                {/* Knocked Out Section */}
                {knockedOut.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-gray-700">
                        <h3 className="text-2xl font-bold text-red-500 mb-4 text-center">
                            KNOCKED OUT
                        </h3>
                        <div className="flex justify-center gap-6">
                            {knockedOut.map((fighter) => (
                                <div key={fighter._id} className="opacity-50">
                                    <FighterPlaceholder
                                        name={fighter.name}
                                        hp={0}
                                        maxHp={fighter.maxHp}
                                        isKnockedOut={true}
                                        size="small"
                                        avatar={fighter.avatar}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Next Round Prompt */}
            <div className="mt-12 text-2xl text-gray-400 animate-pulse">
                Next round starting soon...
            </div>
        </div>
    );
}
