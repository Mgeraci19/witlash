import { GameState } from "@/lib/types";
import { FighterPlaceholder } from "./FighterPlaceholder";
import { useRouter } from "next/navigation";

interface HostGameResultsViewProps {
    game: GameState;
}

export function HostGameResultsView({ game }: HostGameResultsViewProps) {
    const router = useRouter();

    // Sort fighters by HP to get final standings
    const fighters = game.players
        .filter(p => p.role === "FIGHTER")
        .sort((a, b) => (b.hp || 0) - (a.hp || 0));

    const winner = fighters[0];
    const runnerUp = fighters[1];
    const rest = fighters.slice(2);

    return (
        <div
            id="host-game-results"
            data-phase="RESULTS"
            className="flex flex-col items-center justify-center min-h-screen p-8"
        >
            {/* Game Over Header */}
            <h1 className="text-8xl font-bold mb-8 text-center" style={{ textShadow: "0 0 40px rgba(255,215,0,0.5)" }}>
                GAME OVER
            </h1>

            {/* Winner Spotlight */}
            {winner && (
                <div className="mb-12 text-center">
                    <div className="text-3xl text-yellow-400 mb-4">CHAMPION</div>
                    <div className="transform scale-125">
                        <FighterPlaceholder
                            name={winner.name}
                            hp={winner.hp}
                            maxHp={winner.maxHp}
                            size="large"
                            avatar={winner.avatar}
                        />
                    </div>
                    <div className="mt-4 text-4xl font-bold text-yellow-400">
                        {winner.name}
                    </div>
                </div>
            )}

            {/* Podium */}
            <div className="flex items-end justify-center gap-8 mb-12">
                {/* Runner Up */}
                {runnerUp && (
                    <div className="text-center">
                        <div className="text-xl text-gray-400 mb-2">2nd Place</div>
                        <FighterPlaceholder
                            name={runnerUp.name}
                            hp={runnerUp.hp}
                            maxHp={runnerUp.maxHp}
                            size="medium"
                            avatar={runnerUp.avatar}
                        />
                    </div>
                )}
            </div>

            {/* Rest of Fighters */}
            {rest.length > 0 && (
                <div className="w-full max-w-4xl">
                    <h3 className="text-2xl font-bold text-gray-400 mb-4 text-center">
                        Also Competed
                    </h3>
                    <div className="flex justify-center gap-4 flex-wrap">
                        {rest.map((fighter, index) => (
                            <div key={fighter._id} className="text-center opacity-75">
                                <div className="text-sm text-gray-500 mb-1">#{index + 3}</div>
                                <FighterPlaceholder
                                    name={fighter.name}
                                    hp={fighter.hp}
                                    maxHp={fighter.maxHp}
                                    isKnockedOut={fighter.knockedOut}
                                    size="small"
                                    avatar={fighter.avatar}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Thanks for Playing */}
            <div className="mt-12 text-2xl text-gray-400">
                Thanks for playing SmackTalk!
            </div>

            {/* New Game Button */}
            <button
                id="new-game-button"
                data-testid="new-game-button"
                data-action="new-game"
                className="mt-8 px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-lg transition-colors shadow-lg"
                onClick={() => {
                    // Clear host session
                    sessionStorage.removeItem("hostToken");
                    router.push("/");
                }}
            >
                New Game
            </button>
        </div>
    );
}
