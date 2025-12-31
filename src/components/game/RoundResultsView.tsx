import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VipControlsPanel } from "./VipControlsPanel";

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
            {/* HIDE STANDINGS ON MOBILE */}
            <div
                id="round-standings-hidden-message"
                className="p-8 bg-indigo-50 rounded-lg border-2 border-indigo-200"
            >
                <h3 className="text-xl font-bold text-indigo-800 mb-2">👀 Look at the Main Screen!</h3>
                <p className="text-gray-600">Check the host display to see who is winning!</p>
            </div>

            {isVip ? (
                <VipControlsPanel>
                    <Button
                        id="next-round-button"
                        data-testid="next-round-button"
                        data-action="next-round"
                        data-requires-vip="true"
                        data-next-round={game.currentRound + 1}
                        aria-label={`Start Round ${game.currentRound + 1}`}
                        className="w-full"
                        size="lg"
                        onClick={() => playerId && nextRound({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                    >
                        Skip to Round {game.currentRound + 1}
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        Auto-advancing soon...
                    </p>
                </VipControlsPanel>
            ) : (
                <div id="waiting-for-vip" className="mt-8 text-gray-500 italic">
                    Next round starting soon...
                </div>
            )}
        </div>
    );
}
