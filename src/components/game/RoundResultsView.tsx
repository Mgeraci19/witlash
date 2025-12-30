import { Button } from "@/components/ui/button";
import { Id } from "../../../convex/_generated/dataModel";

import { GameState } from "@/lib/types";

interface RoundResultsViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    isVip: boolean;
    nextRound: (args: { gameId: Id<"games"> }) => Promise<any>;
}

export function RoundResultsView({ game, playerId, isVip, nextRound }: RoundResultsViewProps) {
    return (
        <div className="text-center p-10 bg-indigo-100 rounded">
            <h2 className="text-3xl font-bold mb-4">ROUND {game.currentRound} OVER</h2>
            <p className="mb-8">Current Standings:</p>
            <div className="space-y-2 bg-white p-4 rounded shadow-sm">
                {game.players
                    .sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100))
                    .map((p, i) => (
                        <div key={p._id} className="text-xl flex justify-between border-b last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                            <span>#{i + 1} {p.name} {p._id === playerId && "(You)"}</span>
                            <span className="font-bold">{p.hp ?? 100} HP</span>
                        </div>
                    ))}
            </div>

            {isVip ? (
                <Button
                    className="mt-8 w-full animate-pulse"
                    size="lg"
                    onClick={() => nextRound({ gameId: game._id })}
                >
                    Start Round {game.currentRound + 1} ⏭️
                </Button>
            ) : (
                <div className="mt-8 text-gray-500 italic">
                    Waiting for VIP to start next round...
                </div>
            )}
        </div>
    );
}
