import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { GameState } from "@/lib/types";

interface PromptCardProps {
    prompt: { _id: Id<"prompts">; text: string };
    initialValue: string;
    isDone: boolean;
    onSubmit: (text: string) => Promise<void>;
    onSetValue?: (setter: (value: string) => void) => void;
    showError: (code: string, message: string) => void;
}

// Helper Component to handle local state pre-filling
function PromptCard({ prompt, initialValue, isDone, onSubmit, onSetValue, showError }: PromptCardProps) {
    const [value, setValue] = useState("");

    // Initialize with prefill on mount or when value is cleared
    useEffect(() => {
        if (initialValue && !value) {
            // LINT FIX: setState to initialize from prop is intentional
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setValue(initialValue);
        }
    // LINT FIX: Added 'value' to dependencies to avoid stale closure
    }, [initialValue, value]);

    // Expose setValue to parent via callback
    useEffect(() => {
        if (onSetValue) {
            onSetValue(setValue);
        }
    }, [onSetValue]);

    // Create a URL-safe ID from prompt ID
    const promptIdSafe = prompt._id;

    return (
        <Card
            id={`prompt-card-${promptIdSafe}`}
            data-prompt-id={prompt._id}
            data-status={isDone ? "completed" : "pending"}
            className={isDone ? "opacity-50" : ""}
        >
            <CardHeader>
                <CardTitle id={`prompt-text-${promptIdSafe}`} className="text-lg">{prompt.text}</CardTitle>
            </CardHeader>
            <CardContent>
                {isDone ? (
                    <div id={`prompt-submitted-${promptIdSafe}`} data-status="submitted" className="text-green-600 font-bold">Answer Submitted!</div>
                ) : (
                    <div className="flex gap-2">
                        <Input
                            id={`answer-input-${promptIdSafe}`}
                            data-testid={`answer-input-${promptIdSafe}`}
                            data-prompt-id={prompt._id}
                            aria-label={`Your answer for: ${prompt.text}`}
                            placeholder="Your answer..."
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                        <Button
                            id={`submit-answer-${promptIdSafe}`}
                            data-testid={`submit-answer-${promptIdSafe}`}
                            data-action="submit-answer"
                            data-prompt-id={prompt._id}
                            data-has-value={value.length > 0}
                            aria-label={`Submit answer for: ${prompt.text}`}
                            onClick={() => onSubmit(value).catch((e) => showError("submit-failed", (e as Error).message))}
                        >
                            Submit
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface CornerManSuggestionCardProps {
    prompt: { _id: Id<"prompts">; text: string };
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitSuggestion: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    captainIsBot?: boolean;
    captainId: Id<"players"> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswerForBot: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    showError: (code: string, message: string) => void;
}

// Helper Component for Corner Man Input
function CornerManSuggestionCard({ prompt, game, playerId, sessionToken, submitSuggestion, captainIsBot, captainId, submitAnswerForBot, showError }: CornerManSuggestionCardProps) {
    const [suggestionText, setSuggestionText] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    const mySuggestions = game.suggestions?.filter((s) => s.promptId === prompt._id && s.senderId === playerId) || [];
    const promptIdSafe = prompt._id;

    // Check if Captain has ALREADY submitted
    const captainSubmission = game.submissions?.find((s) => s.promptId === prompt._id && s.playerId === captainId);
    if (captainSubmission) {
        return (
            <Card
                id={`corner-prompt-card-${promptIdSafe}`}
                data-prompt-id={prompt._id}
                data-status="captain-submitted"
                className="opacity-75 bg-gray-50"
            >
                <CardHeader><CardTitle className="text-lg">{prompt.text}</CardTitle></CardHeader>
                <CardContent>
                    <div id={`corner-submitted-${promptIdSafe}`} className="text-green-600 font-bold">Answer Submitted by Team!</div>
                    <div className="text-sm text-gray-500 mt-1">&ldquo;{captainSubmission.text}&rdquo;</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            id={`corner-prompt-card-${promptIdSafe}`}
            data-prompt-id={prompt._id}
            data-status="pending"
            data-captain-is-bot={captainIsBot}
        >
            <CardHeader><CardTitle className="text-lg">{prompt.text}</CardTitle></CardHeader>
            <CardContent>
                <div className="flex gap-2">
                    <Input
                        id={`corner-suggestion-input-${promptIdSafe}`}
                        data-testid={`corner-suggestion-input-${promptIdSafe}`}
                        data-prompt-id={prompt._id}
                        aria-label={captainIsBot ? `Type answer for Bot captain: ${prompt.text}` : `Suggest an answer for: ${prompt.text}`}
                        placeholder={captainIsBot ? "Type answer for Bot..." : "Suggest an answer..."}
                        value={suggestionText}
                        onChange={e => setSuggestionText(e.target.value)}
                        disabled={isSubmitted}
                    />
                    <Button
                        id={`corner-suggest-button-${promptIdSafe}`}
                        data-testid={`corner-suggest-button-${promptIdSafe}`}
                        data-action="submit-suggestion"
                        data-prompt-id={prompt._id}
                        aria-label={`Suggest answer for: ${prompt.text}`}
                        onClick={async () => {
                            if (!suggestionText) return;
                            try {
                                await submitSuggestion({
                                    gameId: game._id,
                                    playerId: playerId!,
                                    sessionToken,
                                    promptId: prompt._id,
                                    text: suggestionText
                                });
                                setSuggestionText("");
                            } catch (e) {
                                showError("action-failed", (e as Error).message);
                            }
                        }}
                    >
                        Suggest
                    </Button>

                    {captainIsBot && (
                        <Button
                            id={`corner-submit-for-bot-${promptIdSafe}`}
                            data-testid={`corner-submit-for-bot-${promptIdSafe}`}
                            data-action="submit-answer-for-bot"
                            data-prompt-id={prompt._id}
                            variant="destructive"
                            className="whitespace-nowrap"
                            aria-label={`Submit answer for Bot for: ${prompt.text}`}
                            onClick={async () => {
                                if (!suggestionText) return;
                                try {
                                    await submitAnswerForBot({
                                        gameId: game._id,
                                        playerId: playerId!, // Corner man's ID for auth
                                        sessionToken,
                                        promptId: prompt._id,
                                        text: suggestionText
                                    });
                                    setIsSubmitted(true);
                                } catch (e) {
                                    showError("submit-failed", (e as Error).message);
                                }
                            }}
                        >
                            Submit as Answer
                        </Button>
                    )}
                </div>
                <div
                    id={`corner-suggestions-list-${promptIdSafe}`}
                    data-suggestion-count={mySuggestions.length}
                    className="mt-4 text-xs text-gray-400"
                >
                    My Suggestions:
                    <ul className="list-disc pl-4 mt-1">
                        {mySuggestions.map((s, i) => <li key={i}>{s.text}</li>)}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

interface WritingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startGame: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswer: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswerForBot: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitSuggestion: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    answers?: Record<string, string>;
}

export function WritingView({ game, playerId, sessionToken, startGame, submitAnswer, submitAnswerForBot, submitSuggestion }: WritingViewProps) {
    const [submittedPrompts, setSubmittedPrompts] = useState<Set<string>>(new Set());
    const { error, showError, clearError } = useErrorState();
    const myPlayer = game.players.find((p) => p._id === playerId);

    // Determine Role
    const isCornerMan = myPlayer?.role === "CORNER_MAN";
    const myTeamId = myPlayer?.teamId;
    const captain = game.players.find((p) => p._id === myTeamId);
    const captainIsBot = captain?.isBot;

    // Calculate pending prompts for data attribute
    const myPrompts = game.prompts?.filter((p) => p.assignedTo?.includes(playerId!)) || [];
    const pendingPrompts = myPrompts.filter((p) => !game.submissions?.some((s) => s.promptId === p._id && s.playerId === playerId));

    if (isCornerMan) {
        // CORNER MAN VIEW
        // Find prompts assigned to my Captain (teamId)
        const captainPrompts = game.prompts?.filter((p) => p.assignedTo?.includes(myTeamId!)) || [];
        const pendingCaptainPrompts = captainPrompts.filter((p) => !game.submissions?.some((s) => s.promptId === p._id && s.playerId === myTeamId));

        return (
            <div
                id="writing-view-corner-man"
                data-game-phase="prompts"
                data-player-role="corner-man"
                data-captain-name={captain?.name}
                data-captain-is-bot={captainIsBot}
                data-prompts-pending={pendingCaptainPrompts.length}
                data-prompts-total={captainPrompts.length}
                className="space-y-6 relative"
            >
                <ErrorBanner error={error} onDismiss={clearError} />

                <div
                    id="corner-man-header"
                    className="bg-yellow-900/10 border-yellow-500 border p-4 rounded text-center"
                >
                    <h2 id="corner-man-title" className="text-xl font-bold text-yellow-600">CORNER MAN DUTY 🔔</h2>
                    <p className="text-sm">
                        Assist your Captain ({captain?.name})!
                        {captainIsBot ? " Since they are a Bot, YOU control their answer." : " Send them suggestions."}
                    </p>
                </div>


                {captainPrompts.map((p) => {
                    const captainPlayer = game.players.find((pl) => pl._id === myTeamId);
                    return (
                        <CornerManSuggestionCard
                            key={p._id}
                            prompt={p}
                            game={game}
                            playerId={playerId}
                            sessionToken={sessionToken}
                            submitSuggestion={submitSuggestion}
                            captainId={myTeamId}
                            captainIsBot={captainPlayer?.isBot}
                            submitAnswerForBot={submitAnswerForBot}
                            showError={showError}
                        />

                    )
                })}
                {captainPrompts.length === 0 && <div id="no-prompts-message" className="text-center italic">Your Captain has no prompts pending.</div>}
            </div>
        );
    }

    // FIGHTER VIEW (Standard)
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
