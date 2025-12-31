import { Id } from "../../../convex/_generated/dataModel";
import { GameState } from "@/lib/types";
import { FighterWritingView } from "./FighterWritingView";
import { CaptainWritingView } from "./CaptainWritingView";

interface WritingViewProps {
    game: GameState;
    playerId: Id<"players"> | null;
    sessionToken: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startGame: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswer: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitAnswerForBot: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitSuggestion: (args: { gameId: Id<"games">; playerId: Id<"players">; sessionToken: string; promptId: Id<"prompts">; text: string }) => Promise<any>;
    answers?: Record<string, string>;
}

export function WritingView({ game, playerId, sessionToken, startGame, submitAnswer, submitAnswerForBot, submitSuggestion }: WritingViewProps) {
    const myPlayer = game.players.find((p) => p._id === playerId);
    const isCornerMan = myPlayer?.role === "CORNER_MAN";
    const myTeamId = myPlayer?.teamId;

    if (isCornerMan && myTeamId) {
        return (
            <CaptainWritingView
                game={game}
                playerId={playerId}
                sessionToken={sessionToken}
                myTeamId={myTeamId}
                submitSuggestion={submitSuggestion}
                submitAnswerForBot={submitAnswerForBot}
            />
        );
    }

    return (
        <FighterWritingView
            game={game}
            playerId={playerId}
            sessionToken={sessionToken}
            submitAnswer={submitAnswer}
        />
    );
}
