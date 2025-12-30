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
            {/* HIDE FINAL RESULTS ON MOBILE */}
            <div
                id="final-results-hidden-message"
                className="mt-8 p-8 bg-green-50 rounded-lg border-2 border-green-200"
            >
                <h3 className="text-xl font-bold text-green-800 mb-2">👀 Look at the Main Screen!</h3>
                <p className="text-gray-600">The winner is crowned on the host display!</p>
            </div>
            <Button
                id="back-to-home-button"
                data-testid="back-to-home-button"
                data-action="navigate-home"
                className="mt-8"
                onClick={() => {
                    // Clear player session
                    sessionStorage.removeItem("playerId");
                    sessionStorage.removeItem("sessionToken");
                    router.push("/");
                }}
            >
                Back to Home
            </Button>
        </div>
    );
}
