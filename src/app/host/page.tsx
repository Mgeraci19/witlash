"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GameState } from "@/lib/types";
import { HostLobbyView } from "@/components/host/HostLobbyView";
import { HostWritingView } from "@/components/host/HostWritingView";
import { HostVotingView } from "@/components/host/HostVotingView";
import { HostRoundResultsView } from "@/components/host/HostRoundResultsView";
import { HostGameResultsView } from "@/components/host/HostGameResultsView";
import { TransitionOrchestrator } from "@/components/host/transitions";

function HostContent() {
    const searchParams = useSearchParams();
    const roomCode = searchParams.get("code") || "";
    const router = useRouter();

    const [hostToken, setHostToken] = useState<string>("");

    // Get hostToken from sessionStorage
    useEffect(() => {
        if (!roomCode) {
            router.push("/");
            return;
        }

        const storedToken = sessionStorage.getItem("hostToken");
        if (!storedToken) {
            router.push("/");
        } else {
            // LINT FIX: setState during initial setup effect is intentional
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHostToken(storedToken);
        }
    }, [router, roomCode]);

    // Query game state with host authentication
    const game = useQuery(
        api.game.getForHost,
        roomCode && hostToken ? { roomCode, hostToken } : "skip"
    ) as GameState | undefined | null;

    if (!roomCode || !hostToken) return null;

    if (game === undefined) {
        return (
            <div
                id="host-loading"
                data-state="loading"
                className="flex items-center justify-center min-h-screen bg-black text-white text-4xl"
            >
                Loading...
            </div>
        );
    }

    if (game === null) {
        return (
            <div
                id="host-unauthorized"
                data-state="unauthorized"
                className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-4"
            >
                <h1 className="text-4xl font-bold">Access Denied</h1>
                <p className="text-xl text-gray-400">Invalid host token or room not found</p>
                <button
                    onClick={() => router.push("/")}
                    className="mt-4 px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200"
                >
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div
            id="host-container"
            data-game-id={game._id}
            data-room-code={game.roomCode}
            data-game-phase={game.status}
            data-current-round={game.currentRound}
            data-round-status={game.roundStatus}
            className="min-h-screen bg-black text-white overflow-hidden"
        >
            {/* Transition Orchestrator - Event-driven transitions */}
            <TransitionOrchestrator gameState={game} />

            {/* Phase Views */}
            {game.status === "LOBBY" && (
                <HostLobbyView game={game} />
            )}

            {game.status === "PROMPTS" && game.currentRound !== 3 && (
                <HostWritingView game={game} />
            )}

            {game.status === "PROMPTS" && game.currentRound === 3 && (
                <HostVotingView game={game} showWritingIndicator={true} />
            )}

            {game.status === "VOTING" && (
                <HostVotingView game={game} />
            )}

            {game.status === "ROUND_RESULTS" && (
                <HostRoundResultsView game={game} />
            )}

            {game.status === "RESULTS" && (
                <HostGameResultsView game={game} />
            )}
        </div>
    );
}

export default function HostPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-black text-white text-4xl">Loading...</div>}>
            <HostContent />
        </Suspense>
    );
}
