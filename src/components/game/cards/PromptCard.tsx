import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

export type AttackType = "jab" | "haymaker" | "flyingKick";

interface AttackTypeInfo {
    type: AttackType;
    label: string;
    dealtMultiplier: string;
    receivedMultiplier: string;
    riskLevel: "low" | "medium" | "high";
    description: string;
}

export const ATTACK_TYPES: AttackTypeInfo[] = [
    {
        type: "jab",
        label: "Jab",
        dealtMultiplier: "1×",
        receivedMultiplier: "1×",
        riskLevel: "low",
        description: "Safe and steady"
    },
    {
        type: "haymaker",
        label: "Haymaker",
        dealtMultiplier: "2×",
        receivedMultiplier: "2×",
        riskLevel: "medium",
        description: "High risk, high reward"
    },
    {
        type: "flyingKick",
        label: "Flying Kick",
        dealtMultiplier: "3×",
        receivedMultiplier: "4×",
        riskLevel: "high",
        description: "Maximum damage, but very risky!"
    }
];

interface PromptCardProps {
    prompt: { _id: Id<"prompts">; text: string; promptType?: "jab" | "haymaker" };
    initialValue: string;
    isDone: boolean;
    onSubmit: (text: string, attackType?: AttackType) => Promise<void>;
    onSetValue?: (setter: (value: string) => void) => void;
    showError: (code: string, message: string) => void;
    /** Show attack type selector (only in Final round) */
    showAttackTypeSelector?: boolean;
    /** Current round (used for Semi-Finals jab validation) */
    currentRound?: number;
}

export function PromptCard({ prompt, initialValue, isDone, onSubmit, onSetValue, showError, showAttackTypeSelector, currentRound }: PromptCardProps) {
    const [value, setValue] = useState("");
    const [selectedAttackType, setSelectedAttackType] = useState<AttackType>("jab");

    // Semi-Finals (Round 2) jab prompts require single word
    const isSemiFinalsJab = currentRound === 2 && prompt.promptType === "jab";
    const isSemiFinalsHaymaker = currentRound === 2 && prompt.promptType === "haymaker";

    // Client-side validation for jab (single word)
    const wordCount = value.trim().split(/\s+/).filter(w => w.length > 0).length;
    const isValidJabAnswer = !isSemiFinalsJab || wordCount <= 1;

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
                {/* Semi-Finals prompt type indicator */}
                {isSemiFinalsJab && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-blue-600 font-bold text-sm">👊 JAB</span>
                        <span className="text-blue-500 text-xs">(Single word only!)</span>
                    </div>
                )}
                {isSemiFinalsHaymaker && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-orange-600 font-bold text-sm">🥊 HAYMAKER</span>
                        <span className="text-orange-500 text-xs">(Go wild!)</span>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {isDone ? (
                    <div id={`prompt-submitted-${promptIdSafe}`} data-status="submitted" className="text-green-600 font-bold">Answer Submitted!</div>
                ) : (
                    <div className="space-y-3">
                        {/* Attack Type Selector (Final round only) */}
                        {showAttackTypeSelector && (
                            <div
                                id={`attack-type-selector-${promptIdSafe}`}
                                data-testid={`attack-type-selector-${promptIdSafe}`}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                    Choose Your Attack
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {ATTACK_TYPES.map((attack) => {
                                        const isSelected = selectedAttackType === attack.type;
                                        const riskColors = {
                                            low: "border-green-500 bg-green-50 hover:bg-green-100",
                                            medium: "border-yellow-500 bg-yellow-50 hover:bg-yellow-100",
                                            high: "border-red-500 bg-red-50 hover:bg-red-100"
                                        };
                                        const selectedColors = {
                                            low: "border-green-600 bg-green-200 ring-2 ring-green-400",
                                            medium: "border-yellow-600 bg-yellow-200 ring-2 ring-yellow-400",
                                            high: "border-red-600 bg-red-200 ring-2 ring-red-400"
                                        };

                                        return (
                                            <button
                                                key={attack.type}
                                                id={`attack-type-${attack.type}-${promptIdSafe}`}
                                                data-testid={`attack-type-${attack.type}-${promptIdSafe}`}
                                                data-attack-type={attack.type}
                                                data-selected={isSelected}
                                                type="button"
                                                className={`p-2 rounded-lg border-2 text-center transition-all ${
                                                    isSelected
                                                        ? selectedColors[attack.riskLevel]
                                                        : riskColors[attack.riskLevel]
                                                }`}
                                                onClick={() => setSelectedAttackType(attack.type)}
                                                aria-pressed={isSelected}
                                                aria-label={`${attack.label}: Deal ${attack.dealtMultiplier} damage, receive ${attack.receivedMultiplier} damage`}
                                            >
                                                <div className="font-bold text-sm">{attack.label}</div>
                                                <div className="text-xs text-gray-600">
                                                    Deal {attack.dealtMultiplier} / Take {attack.receivedMultiplier}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500 italic text-center">
                                    {ATTACK_TYPES.find(a => a.type === selectedAttackType)?.description}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Input
                                id={`answer-input-${promptIdSafe}`}
                                data-testid={`answer-input-${promptIdSafe}`}
                                data-prompt-id={prompt._id}
                                aria-label={`Your answer for: ${prompt.text}`}
                                placeholder={isSemiFinalsJab ? "One word only..." : "Your answer..."}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className={isSemiFinalsJab && !isValidJabAnswer ? "border-red-500" : ""}
                            />
                            <Button
                                id={`submit-answer-${promptIdSafe}`}
                                data-testid={`submit-answer-${promptIdSafe}`}
                                data-action="submit-answer"
                                data-prompt-id={prompt._id}
                                data-has-value={value.trim().length > 0}
                                data-attack-type={showAttackTypeSelector ? selectedAttackType : undefined}
                                aria-label={`Submit answer for: ${prompt.text}`}
                                // VALIDATION: Disable if empty, whitespace only, or invalid jab (multi-word)
                                disabled={value.trim().length === 0 || !isValidJabAnswer}
                                onClick={() => {
                                    const trimmed = value.trim();
                                    if (trimmed.length === 0) return;
                                    if (!isValidJabAnswer) {
                                        showError("jab-validation", "Jab answers must be a single word!");
                                        return;
                                    }
                                    onSubmit(trimmed, showAttackTypeSelector ? selectedAttackType : undefined)
                                        .catch((e) => showError("submit-failed", (e as Error).message));
                                }}
                            >
                                Submit
                            </Button>
                        </div>
                        {/* Jab validation warning */}
                        {isSemiFinalsJab && !isValidJabAnswer && (
                            <p className="text-red-500 text-xs mt-1">⚠️ Jab answers must be a single word! ({wordCount} words detected)</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
