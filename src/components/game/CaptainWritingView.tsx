import { Id } from "../../../convex/_generated/dataModel";
import { useErrorState } from "@/hooks/useErrorState";
import { ErrorBanner } from "@/components/ui/error-banner";
import { GameState } from "@/lib/types";
import { SuggestionCard } from "./cards/SuggestionCard";

interface CaptainWritingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    myTeamId: Id<"players">;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitSuggestion: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswerForBot: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
}

export function CaptainWritingView({ game, playerId, sessionToken, myTeamId, submitSuggestion, submitAnswerForBot }: CaptainWritingViewProps) {
    const { error, showError, clearError } = useErrorState();

    const captain = game.players.find((p) => p._id === myTeamId);
    const captainIsBot = captain?.isBot;

    // Find prompts assigned to my Captain (teamId)
    const captainPrompts = game.prompts?.filter((p) => p.assignedTo?.includes(myTeamId)) || [];
    const pendingCaptainPrompts = captainPrompts.filter((p) => !game.submissions?.some((s) => s.promptId === p._id && s.playerId === myTeamId));

    return (
        <div
            id="writing-view-corner-man"
            data-game-phase="prompts"
            data-player-role="corner-man"
            data-captain-name={captain?.name}
            data-captain-is-bot={captainIsBot}
            data-prompts-pending={pendingCaptainPrompts.length}
            data-prompts-total={captainPrompts.length}
            className="space-y-6 relative"
        >
            <ErrorBanner error={error} onDismiss={clearError} />

            <div
                id="corner-man-header"
                className="bg-yellow-900/10 border-yellow-500 border p-4 rounded text-center"
            >
                <h2 id="corner-man-title" className="text-xl font-bold text-yellow-600">CORNER MAN DUTY 🔔</h2>
                <p className="text-sm">
                    Assist your Captain ({captain?.name})!
                    {captainIsBot ? " Since they are a Bot, YOU control their answer." : " Send them suggestions."}
                </p>
            </div>


            {captainPrompts.map((p) => {
                const captainPlayer = game.players.find((pl) => pl._id === myTeamId);
                return (
                    <SuggestionCard
                        key={p._id}
                        prompt={p}
                        game={game}
                        playerId={playerId}
                        sessionToken={sessionToken}
                        submitSuggestion={submitSuggestion}
                        captainId={myTeamId}
                        captainIsBot={captainPlayer?.isBot}
                        submitAnswerForBot={submitAnswerForBot}
                        showError={showError}
                    />

                )
            })}
            {captainPrompts.length === 0 && <div id="no-prompts-message" className="text-center italic">Your Captain has no prompts pending.</div>}
        </div>
    );
}
