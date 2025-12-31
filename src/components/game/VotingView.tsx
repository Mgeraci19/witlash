import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useState, useEffect } from "react";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useVotingLogic } from "@/hooks/useVotingLogic";
import { VipControlsPanel } from "./VipControlsPanel";

interface VotingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    isVip: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitVote: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; submissionId: Id<"submissions"> }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nextBattle: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string }) => Promise<any>;
}

export function VotingView({ game, playerId, sessionToken, isVip, submitVote, nextBattle }: VotingViewProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { error, showError, clearError } = useErrorState();

    // Reset submitting state when prompt changes
    useEffect(() => {
        setIsSubmitting(false);
    }, [game.currentPromptId]);

    // Use derived state from hook
    const {
        currentSubmissions,
        currentVotes,
        maxVotes,
        myVote,
        votingState,
        promptText,
        userRoleState
    } = useVotingLogic(game, playerId);

    if (!game.currentPromptId) {
        return (
            <div
                id="voting-loading"
                data-state="loading-battle"
                className="text-center p-10 relative"
            >
                <ErrorBanner error={error} onDismiss={clearError} />
                Loading Battle...
                {isVip && (
                    <Button
                        id="force-next-button"
                        data-action="force-next"
                        aria-label="Force advance to next battle"
                        onClick={() => playerId && nextBattle({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                    >
                        Force Next
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div
            id="voting-view"
            data-game-phase="voting"
            data-round-status={game.roundStatus}
            className="space-y-6 relative"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            {/* Simplified header */}
            <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                    {votingState?.isReveal ? "Results" : "Voting"}
                </h2>
            </div>

            {/* The Prompt - Clean and centered */}
            <div className="mb-8">
                <div className="text-center mb-2">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">The Prompt</span>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl p-6 shadow-lg">
                    <p className="text-2xl font-bold leading-relaxed">
                        &ldquo;{promptText}&rdquo;
                    </p>
                </div>
            </div>

            {/* The Answers - Clean cards */}
            <div className="space-y-4">
                <div className="text-center mb-2">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">The Answers</span>
                </div>

                {currentSubmissions.map((s, index) => {
                    const isMyVote = myVote?.submissionId === s._id;
                    const isMine = s.playerId === playerId;

                    return (
                        <Button
                            key={s._id}
                            id={`vote-button-${s._id}`}
                            data-action="vote"
                            variant={isMyVote ? "default" : "outline"}
                            disabled={!userRoleState.canVote || isSubmitting || votingState?.isReveal}
                            onClick={async () => {
                                if (!userRoleState.canVote || isSubmitting || myVote || votingState?.isReveal) return;

                                setIsSubmitting(true);
                                try {
                                    await submitVote({
                                        gameId: game._id,
                                        playerId: playerId as Id<"players">,
                                        sessionToken,
                                        promptId: game.currentPromptId!,
                                        submissionId: s._id
                                    });
                                } catch (e) {
                                    showError("vote-failed", (e as Error).message);
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}
                            className={`
                                w-full min-h-[120px] text-left p-6 rounded-xl text-lg
                                ${isMyVote
                                    ? "bg-green-600 hover:bg-green-700 text-white shadow-lg"
                                    : "bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200"
                                }
                                ${!userRoleState.canVote || votingState?.isReveal ? "cursor-default opacity-75" : ""}
                                transition-all duration-200
                            `}
                        >
                            <div className="flex flex-col gap-2">
                                <p className="font-bold text-xl leading-relaxed">
                                    &ldquo;{s.text}&rdquo;
                                </p>
                                <div className="flex items-center gap-2 text-sm">
                                    {isMine && (
                                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-semibold">
                                            Your Answer
                                        </span>
                                    )}
                                    {isMyVote && (
                                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold">
                                            ✓ Voted
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Button>
                    );
                })}
            </div>

            {/* Simple status messages */}
            {votingState?.hasVoted && !votingState?.isReveal && (
                <div className="text-center text-sm text-gray-600 mt-4 p-3 bg-green-50 rounded-lg">
                    ✓ Vote recorded
                </div>
            )}

            {votingState?.isReveal && (
                <div className="text-center text-sm text-blue-600 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-semibold">👀 Check the main screen for results!</p>
                </div>
            )}

            {userRoleState.amIBattling && !votingState?.hasVoted && (
                <div className="text-center text-sm text-orange-600 mt-4 p-3 bg-orange-50 rounded-lg">
                    You&apos;re battling - can&apos;t vote
                </div>
            )}

            {/* VIP Controls */}
            {isVip && votingState?.isReveal && (
                <VipControlsPanel>
                    <Button
                        id="next-battle-button"
                        onClick={() => playerId && nextBattle({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg"
                        size="lg"
                    >
                        Skip to Next Battle
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        Auto-advancing soon...
                    </p>
                </VipControlsPanel>
            )}
        </div>
    );
}
