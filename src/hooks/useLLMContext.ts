import { useMemo } from "react";
import { GameState } from "@/lib/types";
import { Id } from "../../convex/_generated/dataModel";

interface LLMAction {
    action: string;
    description: string;
    element: string;
    inputElement?: string;
    requiresVip?: boolean;
    promptText?: string;
    promptId?: string;
}

interface LLMContext {
    phase: string;
    round: number;
    maxRounds: number | undefined;
    roundStatus: string | undefined;
    roomCode: string;
    player: {
        id: string | null;
        name: string | undefined;
        isVip: boolean;
        role: string | undefined;
        hp: number | undefined;
        maxHp: number | undefined;
        knockedOut: boolean;
        teamCaptain: string | null;
    };
    gameStats: {
        totalPlayers: number;
        activeFighters: number;
        cornerMen: number;
        knockedOut: number;
        bots: number;
    };
    availableActions: LLMAction[];
    waitingFor: string | null;
    currentPrompt: {
        id: string | undefined;
        text: string | undefined;
    } | null;
}

/**
 * Hook that generates a structured LLM-friendly context object describing
 * the current game state and available actions.
 */
export function useLLMContext(game: GameState | null | undefined, playerId: Id<"players"> | null): LLMContext | null {
    return useMemo(() => {
        if (!game) return null;

        const myPlayer = game.players.find(p => p._id === playerId);
        const captain = myPlayer?.teamId ? game.players.find(p => p._id === myPlayer.teamId) : null;

        // Game stats
        const activeFighters = game.players.filter(p => p.role === "FIGHTER" && !p.knockedOut);
        const cornerMen = game.players.filter(p => p.role === "CORNER_MAN");
        const knockedOut = game.players.filter(p => p.knockedOut);
        const bots = game.players.filter(p => p.isBot);

        // Current prompt info
        const currentPrompt = game.currentPromptId
            ? game.prompts?.find(p => p._id === game.currentPromptId)
            : null;

        // Calculate available actions
        const availableActions: LLMAction[] = [];

        // LOBBY phase actions
        if (game.status === "LOBBY") {
            if (myPlayer?.isVip && game.players.length >= 1) {
                availableActions.push({
                    action: "start-game",
                    description: "Start the game (adds bots to fill to 6 players)",
                    element: "#start-game-button",
                    requiresVip: true
                });
            }
        }

        // PROMPTS (Writing) phase actions
        if (game.status === "PROMPTS") {
            if (myPlayer?.role === "FIGHTER" || !myPlayer?.role) {
                // Find unanswered prompts
                const myPrompts = game.prompts?.filter(p => p.assignedTo?.includes(playerId!)) || [];
                const pendingPrompts = myPrompts.filter(p =>
                    !game.submissions?.some(s => s.promptId === p._id && s.playerId === playerId)
                );

                pendingPrompts.forEach(prompt => {
                    availableActions.push({
                        action: "submit-answer",
                        description: `Answer the prompt: "${prompt.text}"`,
                        element: `#submit-answer-${prompt._id}`,
                        inputElement: `#answer-input-${prompt._id}`,
                        promptText: prompt.text,
                        promptId: prompt._id
                    });
                });
            }

            if (myPlayer?.role === "CORNER_MAN" && myPlayer.teamId) {
                const captainPrompts = game.prompts?.filter(p => p.assignedTo?.includes(myPlayer.teamId!)) || [];
                const pendingCaptainPrompts = captainPrompts.filter(p =>
                    !game.submissions?.some(s => s.promptId === p._id && s.playerId === myPlayer.teamId)
                );

                pendingCaptainPrompts.forEach(prompt => {
                    if (captain?.isBot) {
                        availableActions.push({
                            action: "submit-answer-for-bot",
                            description: `Submit answer for bot captain: "${prompt.text}"`,
                            element: `#corner-submit-for-bot-${prompt._id}`,
                            inputElement: `#corner-suggestion-input-${prompt._id}`,
                            promptText: prompt.text,
                            promptId: prompt._id
                        });
                    } else {
                        availableActions.push({
                            action: "submit-suggestion",
                            description: `Suggest answer to captain for: "${prompt.text}"`,
                            element: `#corner-suggest-button-${prompt._id}`,
                            inputElement: `#corner-suggestion-input-${prompt._id}`,
                            promptText: prompt.text,
                            promptId: prompt._id
                        });
                    }
                });
            }
        }

        // VOTING phase actions
        if (game.status === "VOTING" && game.currentPromptId) {
            const hasVoted = game.votes?.some(v => v.playerId === playerId && v.promptId === game.currentPromptId);
            const isBattling = game.submissions?.some(s => s.promptId === game.currentPromptId && s.playerId === playerId);
            const isSupporting = myPlayer?.role === "CORNER_MAN" &&
                game.submissions?.some(s => s.promptId === game.currentPromptId && s.playerId === myPlayer.teamId);

            if (game.roundStatus === "VOTING" && !hasVoted && !isBattling && !isSupporting) {
                const submissions = game.submissions?.filter(s => s.promptId === game.currentPromptId) || [];
                submissions.forEach((sub) => {
                    if (sub.playerId !== playerId) {
                        availableActions.push({
                            action: "vote",
                            description: `Vote for answer: "${sub.text}"`,
                            element: `#vote-button-${sub._id}`,
                            promptId: game.currentPromptId as string
                        });
                    }
                });
            }

            if (game.roundStatus === "REVEAL" && myPlayer?.isVip) {
                availableActions.push({
                    action: "next-battle",
                    description: "Advance to the next battle or round",
                    element: "#next-battle-button",
                    requiresVip: true
                });
            }
        }

        // ROUND_RESULTS phase actions
        if (game.status === "ROUND_RESULTS" && myPlayer?.isVip) {
            availableActions.push({
                action: "next-round",
                description: `Start Round ${game.currentRound + 1}`,
                element: "#next-round-button",
                requiresVip: true
            });
        }

        // RESULTS (Game Over) phase actions
        if (game.status === "RESULTS" && myPlayer?.isVip) {
            availableActions.push({
                action: "navigate-home",
                description: "Return to home page to start a new game",
                element: "#back-to-home-button",
                requiresVip: true
            });
        }

        // Determine what the game is waiting for
        let waitingFor: string | null = null;
        if (game.status === "LOBBY") {
            waitingFor = myPlayer?.isVip ? null : "Waiting for VIP to start the game";
        } else if (game.status === "PROMPTS") {
            const allSubmitted = game.prompts?.every(p => {
                const assignees = p.assignedTo || [];
                return assignees.every(pid =>
                    game.submissions?.some(s => s.promptId === p._id && s.playerId === pid)
                );
            });
            waitingFor = allSubmitted ? null : "Waiting for all players to submit answers";
        } else if (game.status === "VOTING") {
            if (game.roundStatus === "VOTING") {
                waitingFor = "Waiting for all votes to be cast";
            } else if (game.roundStatus === "REVEAL") {
                waitingFor = myPlayer?.isVip ? null : "Waiting for VIP to advance to next battle";
            }
        } else if (game.status === "ROUND_RESULTS") {
            waitingFor = myPlayer?.isVip ? null : "Waiting for VIP to start next round";
        }

        return {
            phase: game.status,
            round: game.currentRound,
            maxRounds: game.maxRounds,
            roundStatus: game.roundStatus,
            roomCode: game.roomCode,
            player: {
                id: playerId,
                name: myPlayer?.name,
                isVip: myPlayer?.isVip ?? false,
                role: myPlayer?.role,
                hp: myPlayer?.hp,
                maxHp: myPlayer?.maxHp,
                knockedOut: myPlayer?.knockedOut ?? false,
                teamCaptain: captain?.name ?? null
            },
            gameStats: {
                totalPlayers: game.players.length,
                activeFighters: activeFighters.length,
                cornerMen: cornerMen.length,
                knockedOut: knockedOut.length,
                bots: bots.length
            },
            availableActions,
            waitingFor,
            currentPrompt: currentPrompt ? {
                id: currentPrompt._id,
                text: currentPrompt.text
            } : null
        };
    }, [game, playerId]);
}
