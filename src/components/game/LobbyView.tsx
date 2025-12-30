import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";

import { GameState } from "@/lib/types";

interface LobbyViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    isVip: boolean;
    startGame: (args: { gameId: Id<"games"> }) => Promise<any>;
}

export function LobbyView({ game, playerId, isVip, startGame }: LobbyViewProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-bold">Waiting for players...</h3>
            <ul className="space-y-1 bg-white p-4 rounded border">
                {game.players.map((p) => (
                    <li key={p._id} className="flex justify-between">
                        <span>{p.name} {p._id === playerId && "(You)"}</span>
                        {p.isVip && <span>👑</span>}
                    </li>
                ))}
            </ul>
            {isVip && (
                <>
                    {game.players.length < 1 && <div className="text-destructive font-bold mb-2 text-center text-sm">Need at least 1 player</div>}
                    <Button
                        className="w-full"
                        size="lg"
                        disabled={game.players.length < 1}
                        onClick={() => startGame({ gameId: game._id }).catch((e: any) => alert(e.message))}
                    >
                        Start Game
                    </Button>
                </>
            )}
        </div>
    );
}
