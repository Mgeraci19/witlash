import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";

import { GameState } from "@/lib/types";

interface GameResultsViewProps {
    game: GameState;
    isVip: boolean;
}

export function GameResultsView({ game, isVip }: GameResultsViewProps) {
    const router = useRouter();
    return (
        <div className="text-center p-10 bg-green-100 rounded">
            <h2 className="text-3xl font-bold">GAME OVER</h2>
            <div className="mt-8 space-y-2">
                {game.players
                    .sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100))
                    .map((p, i) => (
                        <div key={p._id} className="text-xl flex justify-between border-b pb-2">
                            <span>#{i + 1} {p.name}</span>
                            <span className="font-bold">{p.hp ?? 100} HP</span>
                        </div>
                    ))}
            </div>
            {isVip && <Button className="mt-8" onClick={() => router.push("/")}>Back to Home</Button>}
        </div>
    );
}
