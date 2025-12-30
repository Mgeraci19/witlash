import { GameState } from "@/lib/types";
import { Id } from "../../../convex/_generated/dataModel";

interface GameStatusBannerProps {
    game: GameState;
    playerId: Id<"players"> | null;
}

/**
 * A hidden but accessible component that provides structured game state information
 * for LLMs and screen readers. This component is visually hidden but semantically rich.
 */
export function GameStatusBanner({ game, playerId }: GameStatusBannerProps) {
    const myPlayer = game.players.find(p => p._id === playerId);

    // Calculate game state summary
    const activeFighters = game.players.filter(p => p.role === "FIGHTER" && !p.knockedOut);
    const knockedOutPlayers = game.players.filter(p => p.knockedOut);
    const cornerMen = game.players.filter(p => p.role === "CORNER_MAN");

    // Get current prompt info if in voting
    const currentPrompt = game.prompts?.find(p => p._id === game.currentPromptId);

    // Calculate pending submissions for writing phase
    const myPrompts = game.prompts?.filter(p => p.assignedTo?.includes(playerId!)) || [];
    const myPendingPrompts = myPrompts.filter(p =>
        !game.submissions?.some(s => s.promptId === p._id && s.playerId === playerId)
    );

    // Get available actions based on current state
    const getAvailableActions = () => {
        const actions: string[] = [];

        if (game.status === "LOBBY" && myPlayer?.isVip) {
            actions.push("Start the game using the Start Game button");
        }

        if (game.status === "PROMPTS") {
            if (myPlayer?.role === "FIGHTER" && myPendingPrompts.length > 0) {
                actions.push(`Answer ${myPendingPrompts.length} pending prompt(s)`);
            }
            if (myPlayer?.role === "CORNER_MAN") {
                const captain = game.players.find(p => p._id === myPlayer.teamId);
                if (captain?.isBot) {
                    actions.push(`Submit answers for your Bot captain ${captain.name}`);
                } else {
                    actions.push(`Send suggestions to your captain ${captain?.name}`);
                }
            }
        }

        if (game.status === "VOTING") {
            if (game.roundStatus === "VOTING") {
                const hasVoted = game.votes?.some(v => v.playerId === playerId && v.promptId === game.currentPromptId);
                const isBattling = game.submissions?.some(s => s.promptId === game.currentPromptId && s.playerId === playerId);
                const isSupporting = myPlayer?.role === "CORNER_MAN" &&
                    game.submissions?.some(s => s.promptId === game.currentPromptId && s.playerId === myPlayer.teamId);

                if (!hasVoted && !isBattling && !isSupporting) {
                    actions.push("Vote for your favorite answer");
                } else if (hasVoted) {
                    actions.push("Wait for other players to vote");
                } else if (isBattling) {
                    actions.push("You are battling - wait for results");
                } else if (isSupporting) {
                    actions.push("Your captain is battling - wait for results");
                }
            } else if (game.roundStatus === "REVEAL" && myPlayer?.isVip) {
                actions.push("Click Next Battle to continue");
            }
        }

        if (game.status === "ROUND_RESULTS" && myPlayer?.isVip) {
            actions.push(`Click to start Round ${game.currentRound + 1}`);
        }

        if (game.status === "RESULTS" && myPlayer?.isVip) {
            actions.push("Click Back to Home to create a new game");
        }

        return actions;
    };

    const availableActions = getAvailableActions();

    return (
        <div
            id="game-status-banner"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-game-phase={game.status}
            data-current-round={game.currentRound}
            data-max-rounds={game.maxRounds}
            data-round-status={game.roundStatus}
            data-player-count={game.players.length}
            data-active-fighters={activeFighters.length}
            data-knocked-out={knockedOutPlayers.length}
            data-corner-men={cornerMen.length}
            data-my-role={myPlayer?.role}
            data-my-hp={myPlayer?.hp}
            data-is-vip={myPlayer?.isVip}
            data-is-knocked-out={myPlayer?.knockedOut}
            data-pending-prompts={myPendingPrompts.length}
            data-current-prompt-id={game.currentPromptId}
            className="sr-only"
            style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0
            }}
        >
            <h2>Game Status Summary</h2>
            <p>
                Game Phase: {game.status}.
                Round {game.currentRound} of {game.maxRounds}.
                {game.roundStatus && ` Current phase: ${game.roundStatus}.`}
            </p>

            <p>
                You are {myPlayer?.name}.
                {myPlayer?.isVip && " You are the VIP and can control game progression."}
                Your role is {myPlayer?.role || "FIGHTER"}.
                {myPlayer?.hp !== undefined && ` Your HP: ${myPlayer.hp}/${myPlayer.maxHp || 100}.`}
                {myPlayer?.knockedOut && " You have been knocked out."}
            </p>

            <p>
                Players: {game.players.length} total, {activeFighters.length} active fighters,
                {cornerMen.length} corner men, {knockedOutPlayers.length} knocked out.
            </p>

            {currentPrompt && (
                <p>Current prompt: &ldquo;{currentPrompt.text}&rdquo;</p>
            )}

            {availableActions.length > 0 && (
                <div>
                    <h3>Available Actions:</h3>
                    <ul>
                        {availableActions.map((action, i) => (
                            <li key={i}>{action}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
