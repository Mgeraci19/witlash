import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Id } from "../../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useState } from "react";

interface SuggestionCardProps {
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

export function SuggestionCard({ prompt, game, playerId, sessionToken, submitSuggestion, captainIsBot, captainId, submitAnswerForBot, showError }: SuggestionCardProps) {
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
