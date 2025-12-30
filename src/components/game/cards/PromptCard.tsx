import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

interface PromptCardProps {
    prompt: { _id: Id<"prompts">; text: string };
    initialValue: string;
    isDone: boolean;
    onSubmit: (text: string) => Promise<void>;
    onSetValue?: (setter: (value: string) => void) => void;
    showError: (code: string, message: string) => void;
}

export function PromptCard({ prompt, initialValue, isDone, onSubmit, onSetValue, showError }: PromptCardProps) {
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
