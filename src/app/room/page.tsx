"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Id } from "../../../convex/_generated/dataModel";
import { LobbyView } from "@/components/game/LobbyView";
import { WritingView } from "@/components/game/WritingView";
import { VotingView } from "@/components/game/VotingView";
import { RoundResultsView } from "@/components/game/RoundResultsView";
import { GameResultsView } from "@/components/game/GameResultsView";
import { DebugPanel } from "@/components/game/DebugPanel";
import { GameState } from "@/lib/types";

function RoomContent() {
    const searchParams = useSearchParams();
    const roomCode = searchParams.get("code") || "";
    const router = useRouter();

    const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
    const [messageText, setMessageText] = useState("");

    // Only query if roomCode exists
    const game = useQuery(api.game.get, roomCode ? { roomCode } : "skip") as GameState | undefined | null;

    const sendMessage = useMutation(api.actions.sendMessage);
    const startGame = useMutation(api.lobby.startGame);
    const submitAnswer = useMutation(api.actions.submitAnswer);
    const submitSuggestion = useMutation(api.actions.submitSuggestion);
    const submitVote = useMutation(api.actions.submitVote);
    const nextBattle = useMutation(api.engine.nextBattle);
    const nextRound = useMutation(api.engine.nextRound);

    const [showDebug, setShowDebug] = useState(false);

    useEffect(() => {
        if (!roomCode) {
            router.push("/");
            return;
        }

        const storedId = sessionStorage.getItem("playerId");
        if (!storedId) {
            router.push("/");
        } else {
            setPlayerId(storedId as Id<"players">);
        }
    }, [router, roomCode]);

    if (!roomCode) return null;

    if (game === undefined) {
        return <div className="text-center p-10">Loading Room logic...</div>;
    }

    if (game === null) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <h1 className="text-xl font-bold">Room {roomCode} not found</h1>
                <Button onClick={() => router.push("/")}>Go Home</Button>
            </div>
        );
    }

    const myPlayer = game.players.find(p => p._id === playerId);
    const isVip = myPlayer?.isVip ?? false;

    const handleSend = async () => {
        if (!messageText || !playerId) return;
        await sendMessage({ gameId: game._id, playerId, text: messageText });
        setMessageText("");
    };

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-4 min-h-screen bg-gray-50">
            {/* DEBUG PANEL */}
            <div className="mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDebug(!showDebug)}
                    className="w-full text-xs opacity-50 hover:opacity-100"
                >
                    {showDebug ? "Hide Debug Panel" : "Show Debug Panel"}
                </Button>
                {showDebug && (
                    <DebugPanel game={game} />
                )}
            </div>

            <Card>
                <div className="p-6">
                    <h1 className="text-xl font-bold mb-4">Room {game.roomCode} ({game.status})</h1>

                    {game.status === "LOBBY" && (
                        <LobbyView game={game} playerId={playerId} isVip={isVip} startGame={startGame} />
                    )}

                    {game.status === "PROMPTS" && (
                        <WritingView game={game} playerId={playerId} startGame={startGame} submitAnswer={submitAnswer} submitSuggestion={submitSuggestion} />
                    )}

                    {game.status === "VOTING" && (
                        <VotingView
                            game={game}
                            playerId={playerId}
                            isVip={isVip}
                            submitVote={submitVote}
                            nextBattle={nextBattle}
                        />
                    )}

                    {game.status === "ROUND_RESULTS" && (
                        <RoundResultsView game={game} playerId={playerId} isVip={isVip} nextRound={nextRound} />
                    )}

                    {game.status === "RESULTS" && (
                        <GameResultsView game={game} isVip={isVip} />
                    )}

                    <div className="mt-8 border-t pt-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Chat & Logs</h4>
                        <div className="space-y-4">
                            <div className="h-64 overflow-y-auto border p-4 rounded bg-white shadow-inner flex flex-col gap-2">
                                {game.messages && game.messages.length === 0 && <div className="text-gray-400 italic">No messages yet</div>}
                                {game.messages && game.messages.map((m: any, i: number) => {
                                    const sender = game.players.find(p => p._id === m.playerId)?.name || "Unknown";
                                    const isMe = m.playerId === playerId;
                                    return (
                                        <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[80%] rounded p-2 text-sm ${isMe ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
                                                <div className="font-bold text-xs opacity-75">{sender}</div>
                                                {m.text}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    placeholder="Type a message..."
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <Button onClick={handleSend}>Send</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div >
    );
}

export default function RoomPage() {
    return (
        <Suspense fallback={<div className="text-center p-20">Loading Room...</div>}>
            <RoomContent />
        </Suspense>
    );
}
