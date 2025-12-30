import { GameState } from "@/lib/types";
import { FighterPlaceholder } from "./FighterPlaceholder";

interface HostRoundResultsViewProps {
    game: GameState;
}

export function HostRoundResultsView({ game }: HostRoundResultsViewProps) {
    // Sort fighters by HP (highest first), then filter out corner men
    const fighters = game.players
        .filter(p => p.role === "FIGHTER")
        .sort((a, b) => (b.hp || 0) - (a.hp || 0));

    const knockedOut = fighters.filter(p => p.knockedOut);
    const stillStanding = fighters.filter(p => !p.knockedOut);

    return (
        <div
            id="host-round-results"
            data-phase="ROUND_RESULTS"
            data-round={game.currentRound}
            className="flex flex-col items-center justify-center min-h-screen p-8"
        >
            {/* Round Complete Header */}
            <h1 className="text-6xl font-bold mb-4 text-center">
                ROUND {game.currentRound} COMPLETE
            </h1>

            <p className="text-2xl text-gray-400 mb-12">
                {game.currentRound < (game.maxRounds || 4) ? "Prepare for the next round!" : "Final standings!"}
            </p>

            {/* Standings */}
            <div className="w-full max-w-4xl">
                <h2 className="text-3xl font-bold mb-6 text-center">STANDINGS</h2>

                {/* Still Standing */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
                    {stillStanding.map((fighter, index) => (
                        <div
                            key={fighter._id}
                            className="flex flex-col items-center"
                        >
                            {/* Rank */}
                            <div className="text-4xl font-bold text-yellow-400 mb-2">
                                #{index + 1}
                            </div>

                            <FighterPlaceholder
                                name={fighter.name}
                                hp={fighter.hp}
                                maxHp={fighter.maxHp}
                                isKnockedOut={fighter.knockedOut}
                                size="medium"
                            />
                        </div>
                    ))}
                </div>

                {/* Knocked Out Section */}
                {knockedOut.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-gray-700">
                        <h3 className="text-2xl font-bold text-red-500 mb-4 text-center">
                            KNOCKED OUT
                        </h3>
                        <div className="flex justify-center gap-6">
                            {knockedOut.map((fighter) => (
                                <div key={fighter._id} className="opacity-50">
                                    <FighterPlaceholder
                                        name={fighter.name}
                                        hp={0}
                                        maxHp={fighter.maxHp}
                                        isKnockedOut={true}
                                        size="small"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Next Round Prompt */}
            <div className="mt-12 text-2xl text-gray-400 animate-pulse">
                Waiting for VIP to start next round...
            </div>
        </div>
    );
}
