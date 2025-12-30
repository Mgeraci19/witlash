import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";

interface RoundResultsViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    isVip: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nextRound: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string }) => Promise<any>;
}

export function RoundResultsView({ game, playerId, sessionToken, isVip, nextRound }: RoundResultsViewProps) {
    const { error, showError, clearError } = useErrorState();

    return (
        <div
            id="round-results-view"
            data-game-phase="round-results"
            data-current-round={game.currentRound}
            data-next-round={game.currentRound + 1}
            data-is-vip={isVip}
            className="text-center p-10 bg-indigo-100 rounded relative"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            <h2 id="round-results-title" className="text-3xl font-bold mb-4">ROUND {game.currentRound} OVER</h2>
            <p className="mb-8">Current Standings:</p>
            <div
                id="round-standings-list"
                data-testid="round-standings-list"
                className="space-y-2 bg-white p-4 rounded shadow-sm"
            >
                {game.players
                    .sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100))
                    .map((p, i) => (
                        <div
                            key={p._id}
                            id={`standing-${i + 1}`}
                            data-player-id={p._id}
                            data-rank={i + 1}
                            data-hp={p.hp ?? 100}
                            data-is-me={p._id === playerId}
                            className="text-xl flex justify-between border-b last:border-0 pb-2 mb-2 last:mb-0 last:pb-0"
                        >
                            <span>#{i + 1} {p.name} {p._id === playerId && "(You)"}</span>
                            <span className="font-bold">{p.hp ?? 100} HP</span>
                        </div>
                    ))}
            </div>

            {isVip ? (
                <Button
                    id="next-round-button"
                    data-testid="next-round-button"
                    data-action="next-round"
                    data-requires-vip="true"
                    data-next-round={game.currentRound + 1}
                    aria-label={`Start Round ${game.currentRound + 1}`}
                    className="mt-8 w-full animate-pulse"
                    size="lg"
                    onClick={() => playerId && nextRound({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                >
                    Start Round {game.currentRound + 1} ⏭️
                </Button>
            ) : (
                <div id="waiting-for-vip" className="mt-8 text-gray-500 italic">
                    Waiting for VIP to start next round...
                </div>
            )}
        </div>
    );
}
