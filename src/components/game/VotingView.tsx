import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";

interface VotingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    isVip: boolean;
    submitVote: (args: { gameId: Id<"games">; playerId: Id<"players">; promptId: Id<"prompts">; submissionId: Id<"submissions"> }) => Promise<any>;
    nextBattle: (args: { gameId: Id<"games"> }) => Promise<any>;
}

export function VotingView({ game, playerId, isVip, submitVote, nextBattle }: VotingViewProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset submitting state when prompt changes
    useEffect(() => {
        setIsSubmitting(false);
    }, [game.currentPromptId]);
    // 1. Memoize Derived State
    const { currentSubmissions, currentVotes, maxVotes, myVote, votingState, promptText } = useMemo(() => {
        if (!game.currentPromptId) {
            return {
                currentSubmissions: [],
                currentVotes: [],
                maxVotes: 0,
                myVote: undefined,
                votingState: null,
                promptText: ""
            };
        }

        const promptText = game.prompts?.find((p) => p._id === game.currentPromptId)?.text || "";
        const currentSubmissions = game.submissions?.filter((s) => s.promptId === game.currentPromptId) || [];
        const currentVotes = game.votes?.filter((v) => v.promptId === game.currentPromptId) || [];
        const myVote = currentVotes.find((v) => v.playerId === playerId);

        // Max Vote Calculation
        let maxVotes = -1;
        if (currentVotes.length > 0) {
            const voteCounts = new Map<string, number>();
            currentVotes.forEach((v) => {
                const count = (voteCounts.get(v.submissionId) || 0) + 1;
                voteCounts.set(v.submissionId, count);
                if (count > maxVotes) maxVotes = count;
            });
        }

        return {
            currentSubmissions,
            currentVotes,
            maxVotes,
            myVote,
            votingState: {
                hasVoted: !!myVote,
                isReveal: game.roundStatus === "REVEAL",
                totalVotes: currentVotes.length
            },
            promptText
        };

    }, [game.currentPromptId, game.submissions, game.votes, game.prompts, game.roundStatus, playerId]);

    // 2. Determine User Role for this Battle
    // 2. Determine User Role for this Battle
    const userRoleState = useMemo(() => {
        const battlerIds = currentSubmissions.map((sub) => sub.playerId);
        const me = game.players.find((p) => p._id === playerId);

        const amICornerManForBattler = me?.role === "CORNER_MAN" && me.teamId && battlerIds.includes(me.teamId);

        // Am I the literal person fighting?
        const amITheFighter = currentSubmissions.some((sub) => sub.playerId === playerId);

        // Can I vote?
        // Logic: You cannot vote if you are fighting OR supporting a fighter.
        const canVote = !amITheFighter && !amICornerManForBattler;

        return {
            amIBattling: amITheFighter,
            amISupporting: amICornerManForBattler,
            canVote: canVote && !votingState?.isReveal
        };
    }, [currentSubmissions, game.players, playerId, votingState?.isReveal]);


    if (!game.currentPromptId) {
        return (
            <div className="text-center p-10">
                Loading Battle...
                {isVip && <Button onClick={() => nextBattle({ gameId: game._id })}>Force Next</Button>}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center p-4 bg-blue-100 rounded">
                <h2 className="text-2xl font-bold mb-2">
                    {votingState?.isReveal ? "RESULTS" : "VOTING PHASE"}
                </h2>
                {isVip && votingState?.isReveal && (
                    <Button className="mt-2 w-full animate-bounce" size="lg" onClick={() => nextBattle({ gameId: game._id })}>
                        Next Battle ⏭️
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                <div className="text-center mb-4">
                    <div className="text-sm uppercase text-gray-500 font-bold tracking-wider">Voting For</div>
                    <div className="text-xl font-bold text-center border p-6 rounded-xl bg-white shadow-lg mt-1">
                        {promptText}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentSubmissions.map((s) => {
                        const isMyVote = myVote?.submissionId === s._id;
                        const isMine = s.playerId === playerId;

                        const votesForThis = currentVotes.filter((v) => v.submissionId === s._id);
                        const count = votesForThis.length;
                        const percentage = votingState?.totalVotes ? Math.round((count / votingState.totalVotes) * 100) : 0;
                        const author = game.players.find((p) => p._id === s.playerId);

                        const isWinner = votingState?.isReveal && votingState.totalVotes > 0 && count === maxVotes;

                        return (
                            <div key={s._id} className="relative">
                                {isWinner && (
                                    <div className="absolute -top-3 -right-3 z-10 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold shadow-lg animate-bounce border-2 border-white transform rotate-12">
                                        WINNER!
                                    </div>
                                )}
                                <Button
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
                                                promptId: game.currentPromptId!,
                                                submissionId: s._id
                                            });
                                        } catch (e: any) {
                                            alert(e.message);
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }}
                                >
                                    <span className={`font-bold text-xl ${isWinner ? "text-yellow-800" : ""}`}>"{s.text}"</span>

                                    {!votingState?.isReveal && isMine && (
                                        <span className="text-xs mt-2 text-gray-500 uppercase font-bold tracking-widest">(Your Answer)</span>
                                    )}

                                    {!votingState?.isReveal && isMyVote && " ✅"}

                                    {votingState?.isReveal && (
                                        <div className="mt-4 text-sm w-full pt-4 border-t border-black/10">
                                            <div className="font-bold text-2xl mb-1">{percentage}%</div>
                                            <div className="text-xs opacity-75">by {author?.name}</div>
                                        </div>
                                    )}
                                </Button>

                                {votingState?.isReveal && (
                                    <div className="mt-2 text-center text-xs text-gray-600">
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
                            <div className="text-center text-gray-500 italic animate-pulse mt-4">
                                Vote recorded! Waiting for others...
                            </div>
                        )}
                        {userRoleState.amIBattling && (
                            <div className="text-center text-orange-600 font-bold animate-pulse mt-4 bg-orange-100 p-2 rounded">
                                You are in this battle! You cannot vote. Spectating...
                            </div>
                        )}
                        {userRoleState.amISupporting && (
                            <div className="text-center text-purple-600 font-bold animate-pulse mt-4 bg-purple-100 p-2 rounded">
                                Your Captain is fighting! You cannot vote. Spectating...
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}
