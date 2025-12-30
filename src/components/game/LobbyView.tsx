/* eslint-disable @next/next/no-img-element */
import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRouter } from "next/navigation";

interface LobbyViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    isVip: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startGame: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string }) => Promise<any>;
}

export function LobbyView({ game, playerId, sessionToken, isVip, startGame }: LobbyViewProps) {
    const { error, showError, clearError } = useErrorState();
    const router = useRouter();
    const myPlayer = game.players.find(p => p._id === playerId);

    return (
        <div
            id="lobby-view"
            data-game-phase="lobby"
            data-player-count={game.players.length}
            data-can-start={game.players.length >= 1}
            data-is-vip={isVip}
            className="space-y-4"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            <h3 id="lobby-title" className="font-bold">Waiting for players...</h3>

            {/* Edit Avatar Button */}
            <div className="flex justify-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/avatar?code=${game.roomCode}&edit=true`)}
                    className="flex items-center gap-2"
                >
                    {myPlayer?.avatar ? (
                        <img src={myPlayer.avatar} alt="Your avatar" className="w-6 h-6 rounded" />
                    ) : (
                        <span className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center text-xs">?</span>
                    )}
                    Edit Avatar
                </Button>
            </div>

            <ul
                id="lobby-player-list"
                data-testid="lobby-player-list"
                data-count={game.players.length}
                className="space-y-2 bg-white p-4 rounded border"
            >
                {game.players.map((p) => (
                    <li
                        key={p._id}
                        id={`player-item-${p.name.replace(/\s+/g, '-').toLowerCase()}`}
                        data-player-id={p._id}
                        data-is-vip={p.isVip}
                        data-is-me={p._id === playerId}
                        data-is-bot={p.isBot}
                        className="flex items-center gap-3"
                    >
                        {/* Avatar thumbnail */}
                        {p.avatar ? (
                            <img src={p.avatar} alt={`${p.name}'s avatar`} className="w-10 h-10 rounded border-2 border-gray-300 object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded border-2 border-gray-300 bg-gray-200 flex items-center justify-center text-gray-500">?</div>
                        )}
                        <span className="flex-1">{p.name} {p._id === playerId && "(You)"}</span>
                        {p.isVip && <span aria-label="VIP Player">👑</span>}
                    </li>
                ))}
            </ul>
            {isVip && (
                <>
                    {game.players.length < 1 && <div id="min-players-warning" className="text-destructive font-bold mb-2 text-center text-sm">Need at least 1 player</div>}
                    <Button
                        id="start-game-button"
                        data-testid="start-game-button"
                        data-action="start-game"
                        data-requires-vip="true"
                        data-player-count={game.players.length}
                        data-can-start={game.players.length >= 1}
                        aria-label="Start the game (requires at least 1 player)"
                        className="w-full"
                        size="lg"
                        disabled={game.players.length < 1}
                        onClick={() => playerId && startGame({ gameId: game._id, playerId, sessionToken }).catch((e) => showError("action-failed", (e as Error).message))}
                    >
                        Start Game
                    </Button>
                </>
            )}
        </div>
    );
}
