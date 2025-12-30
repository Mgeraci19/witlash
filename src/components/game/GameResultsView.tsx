import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { GameState } from "@/lib/types";

interface GameResultsViewProps {
    game: GameState;
    isVip: boolean;
}

export function GameResultsView({ game, isVip }: GameResultsViewProps) {
    const router = useRouter();
    const winner = game.players.sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100))[0];

    return (
        <div
            id="game-results-view"
            data-game-phase="results"
            data-winner-name={winner?.name}
            data-winner-hp={winner?.hp ?? 100}
            data-is-vip={isVip}
            className="text-center p-10 bg-green-100 rounded"
        >
            <h2 id="game-over-title" className="text-3xl font-bold">GAME OVER</h2>
            <div
                id="final-standings-list"
                data-testid="final-standings-list"
                className="mt-8 space-y-2"
            >
                {game.players
                    .sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100))
                    .map((p, i) => (
                        <div
                            key={p._id}
                            id={`final-standing-${i + 1}`}
                            data-player-id={p._id}
                            data-rank={i + 1}
                            data-hp={p.hp ?? 100}
                            data-is-winner={i === 0}
                            className="text-xl flex justify-between border-b pb-2"
                        >
                            <span>#{i + 1} {p.name}</span>
                            <span className="font-bold">{p.hp ?? 100} HP</span>
                        </div>
                    ))}
            </div>
            {isVip && (
                <Button
                    id="back-to-home-button"
                    data-testid="back-to-home-button"
                    data-action="navigate-home"
                    className="mt-8"
                    onClick={() => router.push("/")}
                >
                    Back to Home
                </Button>
            )}
        </div>
    );
}
