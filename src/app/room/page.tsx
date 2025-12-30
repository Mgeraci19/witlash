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
import { GameStatusBanner } from "@/components/game/GameStatusBanner";
import { GameState } from "@/lib/types";
import { useLLMContext } from "@/hooks/useLLMContext";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";

function RoomContent() {
    const searchParams = useSearchParams();
    const roomCode = searchParams.get("code") || "";
    const router = useRouter();

    const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
    const [sessionToken, setSessionToken] = useState<string>("");
    const [messageText, setMessageText] = useState("");

    // Only query if roomCode exists
    const game = useQuery(api.game.get, roomCode ? { roomCode } : "skip") as GameState | undefined | null;

    const sendMessage = useMutation(api.actions.sendMessage);
    const startGame = useMutation(api.lobby.startGame);
    const submitAnswer = useMutation(api.actions.submitAnswer);
    const submitAnswerForBot = useMutation(api.actions.submitAnswerForBot);
    const submitSuggestion = useMutation(api.actions.submitSuggestion);
    const submitVote = useMutation(api.actions.submitVote);
    const nextBattle = useMutation(api.engine.nextBattle);
    const nextRound = useMutation(api.engine.nextRound);

    const [showDebug, setShowDebug] = useState(false);

    // Generate LLM-friendly context and error state HOOKS MUST BE AT TOP
    const llmContext = useLLMContext(game, playerId);
    const { error, showError, clearError } = useErrorState();

    useEffect(() => {
        if (!roomCode) {
            router.push("/");
            return;
        }

        const storedId = sessionStorage.getItem("playerId");
        const storedToken = sessionStorage.getItem("sessionToken");
        if (!storedId || !storedToken) {
            router.push("/");
        } else {
            setPlayerId(storedId as Id<"players">);
            setSessionToken(storedToken);
        }
    }, [router, roomCode]);

    if (!roomCode) return null;

    if (game === undefined) {
        return (
            <div
                id="room-loading"
                data-state="loading"
                className="text-center p-10"
            >
                Loading Room logic...
            </div>
        );
    }

    if (game === null) {
        return (
            <div
                id="room-not-found"
                data-state="not-found"
                data-room-code={roomCode}
                className="flex flex-col items-center justify-center min-h-screen gap-4"
            >
                <h1 id="not-found-title" className="text-xl font-bold">Room {roomCode} not found</h1>
                <Button
                    id="go-home-button"
                    data-action="navigate-home"
                    onClick={() => router.push("/")}
                >
                    Go Home
                </Button>
            </div>
        );
    }

    const myPlayer = game.players.find(p => p._id === playerId);
    const isVip = myPlayer?.isVip ?? false;

    const handleSend = async () => {
        if (!messageText || !playerId || !sessionToken) return;
        try {
            await sendMessage({ gameId: game._id, playerId, sessionToken, text: messageText });
            setMessageText("");
        } catch (e: any) {
            showError("chat-failed", e.message);
        }
    };

    return (
        <div
            id="room-container"
            data-game-id={game._id}
            data-room-code={game.roomCode}
            data-game-phase={game.status}
            data-current-round={game.currentRound}
            data-max-rounds={game.maxRounds}
            data-round-status={game.roundStatus}
            data-is-vip={isVip}
            data-player-role={myPlayer?.role}
            data-player-hp={myPlayer?.hp}
            data-has-error={!!error}
            className="p-4 max-w-2xl mx-auto space-y-4 min-h-screen bg-gray-50 relative"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            {/* LLM Context - Hidden JSON for programmatic access (safe: uses data attribute, not innerHTML) */}
            <div
                id="llm-game-context"
                data-context={JSON.stringify(llmContext)}
                style={{ display: 'none' }}
                aria-hidden="true"
            />

            {/* Accessible Game Status Banner */}
            <GameStatusBanner game={game} playerId={playerId} />

            {/* DEBUG PANEL */}
            <div id="debug-panel-container" className="mb-2">
                <Button
                    id="toggle-debug-button"
                    data-testid="toggle-debug-button"
                    data-action="toggle-debug"
                    data-debug-visible={showDebug}
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

            <Card id="game-card">
                <div className="p-6">
                    <h1
                        id="room-header"
                        data-room-code={game.roomCode}
                        data-game-status={game.status}
                        className="text-xl font-bold mb-4"
                    >
                        Room {game.roomCode} ({game.status})
                    </h1>

                    {game.status === "LOBBY" && (
                        <LobbyView game={game} playerId={playerId} sessionToken={sessionToken} isVip={isVip} startGame={startGame} />
                    )}

                    {game.status === "PROMPTS" && (
                        <WritingView game={game} playerId={playerId} sessionToken={sessionToken} startGame={startGame} submitAnswer={submitAnswer} submitAnswerForBot={submitAnswerForBot} submitSuggestion={submitSuggestion} />
                    )}

                    {game.status === "VOTING" && (
                        <VotingView
                            game={game}
                            playerId={playerId}
                            sessionToken={sessionToken}
                            isVip={isVip}
                            submitVote={submitVote}
                            nextBattle={nextBattle}
                        />
                    )}

                    {game.status === "ROUND_RESULTS" && (
                        <RoundResultsView game={game} playerId={playerId} sessionToken={sessionToken} isVip={isVip} nextRound={nextRound} />
                    )}

                    {game.status === "RESULTS" && (
                        <GameResultsView game={game} isVip={isVip} />
                    )}

                    <div id="chat-section" className="mt-8 border-t pt-4">
                        <h4 id="chat-header" className="text-xs font-bold text-gray-500 uppercase mb-4">Chat & Logs</h4>
                        <div className="space-y-4">
                            <div
                                id="chat-messages"
                                data-testid="chat-messages"
                                data-message-count={game.messages?.length || 0}
                                className="h-64 overflow-y-auto border p-4 rounded bg-white shadow-inner flex flex-col gap-2"
                            >
                                {game.messages && game.messages.length === 0 && <div id="no-messages" className="text-gray-400 italic">No messages yet</div>}
                                {game.messages && game.messages.map((m: any, i: number) => {
                                    const sender = game.players.find(p => p._id === m.playerId)?.name || "Unknown";
                                    const isMe = m.playerId === playerId;
                                    return (
                                        <div
                                            key={i}
                                            id={`chat-message-${i}`}
                                            data-sender={sender}
                                            data-is-me={isMe}
                                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                        >
                                            <div className={`max-w-[80%] rounded p-2 text-sm ${isMe ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
                                                <div className="font-bold text-xs opacity-75">{sender}</div>
                                                {m.text}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div id="chat-input-container" className="flex gap-2">
                                <Input
                                    id="chat-input"
                                    data-testid="chat-input"
                                    aria-label="Type a chat message"
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    placeholder="Type a message..."
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <Button
                                    id="send-chat-button"
                                    data-testid="send-chat-button"
                                    data-action="send-message"
                                    onClick={handleSend}
                                >
                                    Send
                                </Button>
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
