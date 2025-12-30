import { useMemo } from "react";
import { GameState } from "@/lib/types";
import { Id } from "../../convex/_generated/dataModel";

export function useVotingLogic(game: GameState, playerId: Id<"players"> | null) {
    // 1. Memoize Derived State
    return useMemo(() => {
        if (!game.currentPromptId) {
            return {
                currentSubmissions: [],
                currentVotes: [],
                maxVotes: 0,
                myVote: undefined,
                votingState: null,
                promptText: "",
                userRoleState: {
                    amIBattling: false,
                    amISupporting: false,
                    canVote: false
                }
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

        const votingState = {
            hasVoted: !!myVote,
            isReveal: game.roundStatus === "REVEAL",
            totalVotes: currentVotes.length
        };

        // 2. Determine User Role for this Battle
        const battlerIds = currentSubmissions.map((sub) => sub.playerId);
        const me = game.players.find((p) => p._id === playerId);

        const amICornerManForBattler = me?.role === "CORNER_MAN" && me.teamId && battlerIds.includes(me.teamId);

        // Am I the literal person fighting?
        const amITheFighter = currentSubmissions.some((sub) => sub.playerId === playerId);

        // Can I vote?
        // Logic: You cannot vote if you are fighting OR supporting a fighter.
        const canVote = !amITheFighter && !amICornerManForBattler;

        const userRoleState = {
            amIBattling: amITheFighter,
            amISupporting: amICornerManForBattler,
            canVote: canVote && !votingState?.isReveal
        };

        return {
            currentSubmissions,
            currentVotes,
            maxVotes,
            myVote,
            votingState,
            promptText,
            userRoleState
        };

    }, [game.currentPromptId, game.submissions, game.votes, game.prompts, game.roundStatus, game.players, playerId]);
}
