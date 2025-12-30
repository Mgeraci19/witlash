import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useState, useEffect } from "react";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useVotingLogic } from "@/hooks/useVotingLogic";

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
            data-is-reveal={votingState?.isReveal}
            data-has-voted={votingState?.hasVoted}
            data-can-vote={userRoleState.canVote}
            data-is-vip={isVip}
            data-current-prompt-id={game.currentPromptId}
            className="space-y-6 relative"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            <div
                id="voting-header"
                className="text-center p-4 bg-blue-100 rounded"
            >
                <h2 id="voting-phase-title" className="text-2xl font-bold mb-2">
                    {votingState?.isReveal ? "RESULTS" : "VOTING PHASE"}
                </h2>
                {isVip && votingState?.isReveal && (
                    <Button
                        id="next-battle-button"
                        data-testid="next-battle-button"
                        data-action="next-battle"
                        data-requires-vip="true"
                        aria-label="Advance to next battle"
                        className="mt-2 w-full animate-bounce"
                        size="lg"
                        onClick={() => playerId && nextBattle({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                    >
                        Next Battle ⏭️
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                <div id="current-prompt-container" className="text-center mb-4">
                    <div className="text-sm uppercase text-gray-500 font-bold tracking-wider">Voting For</div>
                    <div
                        id="current-prompt-text"
                        data-testid="current-prompt-text"
                        data-prompt-id={game.currentPromptId}
                        className="text-xl font-bold text-center border p-6 rounded-xl bg-white shadow-lg mt-1"
                    >
                        {promptText}
                    </div>
                </div>

                <div id="submissions-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentSubmissions.map((s, index) => {
                        const isMyVote = myVote?.submissionId === s._id;
                        const isMine = s.playerId === playerId;

                        const votesForThis = currentVotes.filter((v) => v.submissionId === s._id);
                        const count = votesForThis.length;
                        const percentage = votingState?.totalVotes ? Math.round((count / votingState.totalVotes) * 100) : 0;
                        const author = game.players.find((p) => p._id === s.playerId);

                        const isWinner = votingState?.isReveal && votingState.totalVotes > 0 && count === maxVotes;

                        return (
                            <div
                                key={s._id}
                                id={`submission-card-${index}`}
                                data-submission-id={s._id}
                                data-is-winner={isWinner}
                                data-vote-count={count}
                                data-vote-percentage={percentage}
                                data-author-name={author?.name}
                                className="relative"
                            >
                                {isWinner && (
                                    <div id={`winner-badge-${index}`} className="absolute -top-3 -right-3 z-10 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold shadow-lg animate-bounce border-2 border-white transform rotate-12">
                                        WINNER!
                                    </div>
                                )}
                                <Button
                                    id={`vote-button-${s._id}`}
                                    data-testid={`vote-button-${index}`}
                                    data-action="vote"
                                    data-submission-id={s._id}
                                    data-is-my-answer={isMine}
                                    data-is-my-vote={isMyVote}
                                    data-can-vote={userRoleState.canVote && !myVote}
                                    data-vote-state={isMyVote ? "voted" : myVote ? "other-voted" : "available"}
                                    data-is-winner={isWinner}
                                    aria-label={`Vote for answer: ${s.text}${isMine ? ' (Your answer)' : ''}`}
                                    variant={votingState?.isReveal ? (count > 0 ? "default" : "secondary") : (isMyVote ? "default" : "outline")}
                                    className={`h-48 w-full text-lg whitespace-normal cursor-pointer flex flex-col p-4
                                            ${!votingState?.isReveal && isMyVote ? "bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400" : ""} 
                                            ${!votingState?.isReveal && userRoleState.canVote && !!myVote ? "opacity-50" : "hover:bg-blue-50"}
                                            ${isWinner ? "ring-4 ring-yellow-400 bg-yellow-50 scale-105 transition-transform" : ""}
                                            ${!userRoleState.canVote && !votingState?.isReveal ? "cursor-not-allowed opacity-60 grayscale" : ""}
                                        `}
                                    disabled={!userRoleState.canVote || isSubmitting}
                                    onClick={async () => {
                                        if (!userRoleState.canVote || isSubmitting || myVote) return;

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
                                >
                                    <span id={`submission-text-${index}`} className={`font-bold text-xl ${isWinner ? "text-yellow-800" : ""}`}>&ldquo;{s.text}&rdquo;</span>

                                    {!votingState?.isReveal && isMine && (
                                        <span id={`your-answer-label-${index}`} className="text-xs mt-2 text-gray-500 uppercase font-bold tracking-widest">(Your Answer)</span>
                                    )}

                                    {!votingState?.isReveal && isMyVote && " ✅"}

                                    {votingState?.isReveal && (
                                        <div id={`results-${index}`} className="mt-4 text-sm w-full pt-4 border-t border-black/10">
                                            <div className="font-bold text-2xl mb-1">{percentage}%</div>
                                            <div className="text-xs opacity-75">by {author?.name}</div>
                                        </div>
                                    )}
                                </Button>

                                {votingState?.isReveal && (
                                    <div id={`voters-list-${index}`} data-voter-count={count} className="mt-2 text-center text-xs text-gray-600">
                                        {count > 0 && <div className="font-bold mb-1">Voted for by:</div>}
                                        {votesForThis.map((v) => {
                                            const voter = game.players.find((p) => p._id === v.playerId);
                                            return <div key={v._id} className="bg-gray-200 rounded px-2 py-1 inline-block m-0.5">{voter?.name}</div>
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {!game.roundStatus || game.roundStatus === "VOTING" ? (
                    <>
                        {votingState?.hasVoted && (
                            <div id="vote-recorded-message" data-status="vote-recorded" className="text-center text-gray-500 italic animate-pulse mt-4">
                                Vote recorded! Waiting for others...
                            </div>
                        )}
                        {userRoleState.amIBattling && (
                            <div id="battling-message" data-status="battling" className="text-center text-orange-600 font-bold animate-pulse mt-4 bg-orange-100 p-2 rounded">
                                You are in this battle! You cannot vote. Spectating...
                            </div>
                        )}
                        {userRoleState.amISupporting && (
                            <div id="supporting-message" data-status="supporting" className="text-center text-purple-600 font-bold animate-pulse mt-4 bg-purple-100 p-2 rounded">
                                Your Captain is fighting! You cannot vote. Spectating...
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}
