import { GameState } from "@/lib/types";
import { FighterPlaceholder } from "./FighterPlaceholder";

interface HostWritingViewProps {
    game: GameState;
}

export function HostWritingView({ game }: HostWritingViewProps) {
    // Debug: Log player avatar data with clear format
    console.log("[HostWritingView] All players avatar status:");
    game.players.forEach(p => {
        console.log(`  - ${p.name}: hasAvatar=${!!p.avatar}, isBot=${p.isBot}, role=${p.role}, avatarType=${p.avatar?.substring(0, 20)}`);
    });

    // Get all fighters (not corner men) - INCLUDE bots to show their avatars
    const fighters = game.players.filter(p => p.role === "FIGHTER");

    // Build teams: fighters with their corner men
    const fightersWithTeams = fighters.map(fighter => {
        const cornerMen = game.players.filter(
            p => p.role === "CORNER_MAN" && p.teamId === fighter._id
        );
        return { fighter, cornerMen };
    });

    // Round tracking for display purposes
    const isRound3OrLater = game.currentRound >= 3;

    // Count submissions for current round
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
                {fightersWithTeams.map(({ fighter, cornerMen }) => {
                    const hasSubmitted = submittedPlayerIds.has(fighter._id);
                    const hasCornerMen = cornerMen.length > 0;

                    return (
                        <div
                            key={fighter._id}
                            className="flex flex-col items-center relative"
                        >
                            {/* Captain avatar - larger when has corner men */}
                            <FighterPlaceholder
                                name={fighter.name}
                                hp={fighter.hp}
                                maxHp={fighter.maxHp}
                                isKnockedOut={fighter.knockedOut}
                                size={hasCornerMen ? "medium" : "small"}
                                avatar={fighter.avatar}
                            />

                            {/* Status text */}
                            <div className={`mt-2 text-xl font-bold ${hasSubmitted ? "text-green-500" : "text-gray-500 animate-pulse"}`}>
                                {hasSubmitted ? "READY" : "Writing..."}
                            </div>

                            {/* Corner Men display */}
                            {hasCornerMen && (
                                <div className="mt-3 flex flex-col items-center">
                                    {isRound3OrLater && (
                                        <div className="text-sm text-gray-400 mb-2">
                                            Supported by
                                        </div>
                                    )}
                                    <div className="flex gap-2 justify-center">
                                        {cornerMen.map((cm) => (
                                            <div key={cm._id} className="flex flex-col items-center">
                                                <FighterPlaceholder
                                                    name={cm.name}
                                                    hp={0}
                                                    maxHp={100}
                                                    isKnockedOut={true}
                                                    size="tiny"
                                                    avatar={cm.avatar}
                                                />
                                                <div className="text-xs text-purple-300 mt-1 max-w-16 truncate">
                                                    {cm.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
