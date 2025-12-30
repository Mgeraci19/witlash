import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { GameState } from "@/lib/types";
import { PromptCard } from "./cards/PromptCard";

interface FighterWritingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startGame: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswer: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
}

export function FighterWritingView({ game, playerId, sessionToken, startGame, submitAnswer }: FighterWritingViewProps) {
    const [submittedPrompts, setSubmittedPrompts] = useState<Set<string>>(new Set());
    const { error, showError, clearError } = useErrorState();

    // Calculate pending prompts for data attribute
    const myPrompts = game.prompts?.filter((p) => p.assignedTo?.includes(playerId!)) || [];
    const pendingPrompts = myPrompts.filter((p) => !game.submissions?.some((s) => s.promptId === p._id && s.playerId === playerId));

    return (
        <div
            id="writing-view-fighter"
            data-game-phase="prompts"
            data-player-role="fighter"
            data-prompts-pending={pendingPrompts.length}
            data-prompts-total={myPrompts.length}
            data-all-submitted={pendingPrompts.length === 0}
            className="space-y-6 relative"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            <div
                id="writing-header"
                className="flex justify-between items-center bg-yellow-100 p-4 rounded"
            >
                <div>
                    <h2 id="writing-phase-title" className="text-2xl font-bold mb-2">WRITING PHASE</h2>
                    <p>Answer these prompts creatively!</p>
                </div>
                {/* ADMIN RESET BUTTON */}
                <Button
                    id="reset-phase-button"
                    data-testid="reset-phase-button"
                    data-action="reset-phase"
                    variant="destructive"
                    size="sm"
                    aria-label="Reset the current writing phase (Admin only)"
                    onClick={() => playerId && startGame({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                >
                    Reset Phase
                </Button>
            </div>

            {game.prompts
                ?.filter((p) => playerId && p.assignedTo?.includes(playerId))
                .map((p) => {
                    const isSubmitted = submittedPrompts.has(p._id);
                    const dbSubmission = game.submissions?.find((s) => s.promptId === p._id && s.playerId === playerId);
                    const done = isSubmitted || !!dbSubmission;

                    // Suggestions for this prompt
                    const mySuggestions = game.suggestions?.filter((s) => s.promptId === p._id && s.targetId === playerId);

                    // Store the setValue function for this prompt
                    let setValueCallback: ((value: string) => void) | null = null;

                    return (
                        <div
                            key={p._id}
                            id={`prompt-container-${p._id}`}
                            data-prompt-id={p._id}
                            data-status={done ? "completed" : "pending"}
                            className="space-y-2"
                        >
                            <PromptCard
                                prompt={p}
                                initialValue=""
                                isDone={done}
                                onSubmit={async (text: string) => {
                                    await submitAnswer({
                                        gameId: game._id,
                                        playerId: playerId as Id<"players">,
                                        sessionToken,
                                        promptId: p._id,
                                        text
                                    });
                                    setSubmittedPrompts(prev => new Set(prev).add(p._id));
                                }}
                                onSetValue={(setter: (value: string) => void) => {
                                    setValueCallback = setter;
                                }}
                                showError={showError}
                            />

                            {/* Display Suggestions if any */}
                            {!done && mySuggestions && mySuggestions.length > 0 && (
                                <div
                                    id={`suggestions-container-${p._id}`}
                                    data-suggestion-count={mySuggestions.length}
                                    className="p-2 bg-blue-50 border border-blue-200 rounded text-sm"
                                >
                                    <span className="font-bold text-blue-600 uppercase text-xs">Corner Man Suggestions:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {mySuggestions.map((s, i) => (
                                            <div
                                                key={i}
                                                id={`suggestion-chip-${p._id}-${i}`}
                                                data-testid={`suggestion-chip-${p._id}-${i}`}
                                                data-action="use-suggestion"
                                                data-suggestion-text={s.text}
                                                data-prompt-id={p._id}
                                                role="button"
                                                aria-label={`Use suggestion: ${s.text}`}
                                                className="bg-white border border-blue-300 px-2 py-1 rounded-full text-blue-800 cursor-pointer hover:bg-blue-100 transition-colors"
                                                title="Click to use this suggestion"
                                                onClick={() => {
                                                    if (setValueCallback) {
                                                        setValueCallback(s.text);
                                                    }
                                                }}
                                            >
                                                {s.text}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 italic">(Click a suggestion to use it)</div>
                                </div>
                            )}
                        </div>
                    );
                })}

            {/* Show waiting status if done */}
            {game.prompts?.filter((p) => p.assignedTo?.includes(playerId!))
                .every((p) => submittedPrompts.has(p._id) || game.submissions?.some((s) => s.promptId === p._id && s.playerId === playerId))
                && (
                    <div id="waiting-for-others" data-status="waiting" className="text-center animate-pulse mt-4">
                        Waiting for other players to finish...
                    </div>
                )}
        </div>
    );
}
