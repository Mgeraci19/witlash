import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

// Helper Component to handle local state pre-filling
function PromptCard({ prompt, initialValue, isDone, onSubmit, onSetValue }: any) {
    const [value, setValue] = useState("");

    // Initialize with prefill on mount
    useEffect(() => {
        if (initialValue && !value) {
            setValue(initialValue);
        }
    }, [initialValue]);

    // Expose setValue to parent via callback
    useEffect(() => {
        if (onSetValue) {
            onSetValue(setValue);
        }
    }, [onSetValue]);

    return (
        <Card className={isDone ? "opacity-50" : ""}>
            <CardHeader><CardTitle className="text-lg">{prompt.text}</CardTitle></CardHeader>
            <CardContent>
                {isDone ? (
                    <div className="text-green-600 font-bold">Answer Submitted!</div>
                ) : (
                    <div className="flex gap-2">
                        <Input
                            placeholder="Your answer..."
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                        <Button onClick={() => onSubmit(value)}>
                            Submit
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Helper Component for Corner Man Input
function CornerManSuggestionCard({ prompt, game, playerId, submitSuggestion, captainIsBot, captainId, submitAnswer }: any) {
    const [suggestionText, setSuggestionText] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    const mySuggestions = game.suggestions?.filter((s: any) => s.promptId === prompt._id && s.senderId === playerId) || [];

    // Check if Captain has ALREADY submitted
    const captainSubmission = game.submissions?.find((s: any) => s.promptId === prompt._id && s.playerId === captainId);
    if (captainSubmission) {
        return (
            <Card className="opacity-75 bg-gray-50">
                <CardHeader><CardTitle className="text-lg">{prompt.text}</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-green-600 font-bold">Answer Submitted by Team!</div>
                    <div className="text-sm text-gray-500 mt-1">"{captainSubmission.text}"</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader><CardTitle className="text-lg">{prompt.text}</CardTitle></CardHeader>
            <CardContent>
                <div className="flex gap-2">
                    <Input
                        placeholder={captainIsBot ? "Type answer for Bot..." : "Suggest an answer..."}
                        value={suggestionText}
                        onChange={e => setSuggestionText(e.target.value)}
                        disabled={isSubmitted}
                    />
                    <Button onClick={async () => {
                        if (!suggestionText) return;
                        await submitSuggestion({
                            gameId: game._id,
                            playerId: playerId!,
                            promptId: prompt._id,
                            text: suggestionText
                        });
                        setSuggestionText("");
                    }}>
                        Suggest
                    </Button>

                    {captainIsBot && (
                        <Button
                            variant="destructive"
                            className="whitespace-nowrap"
                            onClick={async () => {
                                if (!suggestionText) return;
                                await submitAnswer({
                                    gameId: game._id,
                                    playerId: captainId, // Submit AS the Bot
                                    promptId: prompt._id,
                                    text: suggestionText
                                });
                                setIsSubmitted(true);
                            }}
                        >
                            Submit as Answer
                        </Button>
                    )}
                </div>
                <div className="mt-4 text-xs text-gray-400">
                    My Suggestions:
                    <ul className="list-disc pl-4 mt-1">
                        {mySuggestions.map((s: any, i: number) => <li key={i}>{s.text}</li>)}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

import { GameState } from "@/lib/types";

interface WritingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    startGame: (args: { gameId: Id<"games"> }) => Promise<any>;
    submitAnswer: (args: { gameId: Id<"games">; playerId: Id<"players">; promptId: Id<"prompts">; text: string }) => Promise<any>;
    submitSuggestion: (args: { gameId: Id<"games">; playerId: Id<"players">; promptId: Id<"prompts">; text: string }) => Promise<any>;
    answers?: Record<string, string>;
}

export function WritingView({ game, playerId, startGame, submitAnswer, submitSuggestion }: WritingViewProps) {
    const [submittedPrompts, setSubmittedPrompts] = useState<Set<string>>(new Set());
    const myPlayer = game.players.find((p) => p._id === playerId);

    // Determine Role
    const isCornerMan = myPlayer?.role === "CORNER_MAN";
    const myTeamId = myPlayer?.teamId;
    const captain = game.players.find((p) => p._id === myTeamId);
    const captainIsBot = captain?.isBot;

    if (isCornerMan) {
        // CORNER MAN VIEW
        // Find prompts assigned to my Captain (teamId)
        const captainPrompts = game.prompts?.filter((p) => p.assignedTo?.includes(myTeamId!));

        return (
            <div className="space-y-6">
                <div className="bg-yellow-900/10 border-yellow-500 border p-4 rounded text-center">
                    <h2 className="text-xl font-bold text-yellow-600">CORNER MAN DUTY 🔔</h2>
                    <p className="text-sm">
                        Assist your Captain ({captain?.name})!
                        {captainIsBot ? " Since they are a Bot, YOU control their answer." : " Send them suggestions."}
                    </p>
                </div>


                {captainPrompts.map((p: any) => {
                    const captainPlayer = game.players.find((pl: any) => pl._id === myTeamId);
                    return (
                        <CornerManSuggestionCard
                            key={p._id}
                            prompt={p}
                            game={game}
                            playerId={playerId}
                            submitSuggestion={submitSuggestion}
                            captainId={myTeamId}
                            captainIsBot={captainPlayer?.isBot}
                            submitAnswer={submitAnswer}
                        />

                    )
                })}
                {captainPrompts.length === 0 && <div className="text-center italic">Your Captain has no prompts pending.</div>}
            </div>
        );
    }

    // FIGHTER VIEW (Standard)
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-yellow-100 p-4 rounded">
                <div>
                    <h2 className="text-2xl font-bold mb-2">WRITING PHASE</h2>
                    <p>Answer these prompts creatively!</p>
                </div>
                {/* ADMIN RESET BUTTON */}
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => startGame({ gameId: game._id }).catch((e: any) => alert(e.message))}
                >
                    Reset Phase
                </Button>
            </div>

            {game.prompts
                ?.filter((p: any) => p.assignedTo?.includes(playerId))
                .map((p) => {
                    const isSubmitted = submittedPrompts.has(p._id);
                    const dbSubmission = game.submissions?.find((s) => s.promptId === p._id && s.playerId === playerId);
                    const done = isSubmitted || !!dbSubmission;

                    // Suggestions for this prompt
                    const mySuggestions = game.suggestions?.filter((s) => s.promptId === p._id && s.targetId === playerId);

                    // Store the setValue function for this prompt
                    let setValueCallback: ((value: string) => void) | null = null;

                    return (
                        <div key={p._id} className="space-y-2">
                            <PromptCard
                                prompt={p}
                                initialValue=""
                                isDone={done}
                                onSubmit={async (text: string) => {
                                    await submitAnswer({
                                        gameId: game._id,
                                        playerId: playerId as Id<"players">,
                                        promptId: p._id,
                                        text
                                    });
                                    setSubmittedPrompts(prev => new Set(prev).add(p._id));
                                }}
                                onSetValue={(setter: (value: string) => void) => {
                                    setValueCallback = setter;
                                }}
                            />

                            {/* Display Suggestions if any */}
                            {!done && mySuggestions && mySuggestions.length > 0 && (
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                    <span className="font-bold text-blue-600 uppercase text-xs">Corner Man Suggestions:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {mySuggestions.map((s, i) => (
                                            <div
                                                key={i}
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
                    <div className="text-center animate-pulse mt-4">
                        Waiting for other players to finish...
                    </div>
                )}
        </div>
    );
}
