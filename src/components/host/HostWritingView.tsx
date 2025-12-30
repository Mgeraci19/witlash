import { GameState } from "@/lib/types";
import { FighterPlaceholder } from "./FighterPlaceholder";

interface HostWritingViewProps {
    game: GameState;
}

export function HostWritingView({ game }: HostWritingViewProps) {
    // Get all fighters (not corner men)
    const fighters = game.players.filter(p => p.role === "FIGHTER" && !p.isBot);

    // Count submissions for current round
    const currentPrompts = game.prompts || [];
    const submissions = game.submissions || [];

    // Calculate who has submitted
    const submittedPlayerIds = new Set(submissions.map(s => s.playerId));

    const totalFighters = fighters.length;
    const submittedCount = fighters.filter(f => submittedPlayerIds.has(f._id)).length;

    return (
        <div
            id="host-writing"
            data-phase="PROMPTS"
            data-round={game.currentRound}
            className="flex flex-col items-center justify-center min-h-screen p-8"
        >
            {/* Round Indicator */}
            <div className="text-3xl text-gray-400 mb-4">
                Round {game.currentRound}
            </div>

            <h1 className="text-6xl font-bold mb-12 text-center">
                WRITING PHASE
            </h1>

            {/* Progress */}
            <div className="text-4xl mb-8">
                {submittedCount} / {totalFighters} answers submitted
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-2xl h-8 bg-gray-800 rounded-full overflow-hidden mb-12">
                <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${totalFighters > 0 ? (submittedCount / totalFighters) * 100 : 0}%` }}
                />
            </div>

            {/* Fighter Status Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {fighters.map((fighter) => {
                    const hasSubmitted = submittedPlayerIds.has(fighter._id);

                    return (
                        <div
                            key={fighter._id}
                            className="flex flex-col items-center"
                        >
                            <FighterPlaceholder
                                name={fighter.name}
                                hp={fighter.hp}
                                maxHp={fighter.maxHp}
                                isKnockedOut={fighter.knockedOut}
                                size="small"
                            />
                            <div className={`mt-2 text-xl font-bold ${hasSubmitted ? "text-green-500" : "text-gray-500 animate-pulse"}`}>
                                {hasSubmitted ? "READY" : "Writing..."}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* All Submitted Message */}
            {submittedCount === totalFighters && totalFighters > 0 && (
                <div className="mt-12 text-4xl font-bold text-green-500 animate-pulse">
                    All answers in! Starting voting...
                </div>
            )}
        </div>
    );
}
