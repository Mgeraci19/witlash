import { Card, CardContent } from "@/components/ui/card";
import { GameState } from "@/lib/types";

interface DebugPanelProps {
    game: GameState;
}

export function DebugPanel({ game }: DebugPanelProps) {
    const currentBattleFighters = game.prompts && game.submissions
        ? game.submissions.filter((s) => s.promptId === game.currentPromptId).length
        : 0;

    return (
        <Card className="mt-2 bg-slate-900 text-green-400 font-mono text-xs shadow-xl border-green-800">
            <CardContent className="p-4 space-y-2">
                <h3 className="font-bold underline text-green-500">DEBUG STATE</h3>
                <div>Status: <span className="text-white">{game.status}</span> | Round: <span className="text-white">{game.currentRound}/{game.maxRounds}</span></div>
                <div>Round Status: <span className="text-white">{game.roundStatus || "N/A"}</span></div>
                <div>Current Prompt: <span className="text-white">{game.currentPromptId || "None"}</span></div>
                <div className="grid grid-cols-2 gap-2 mt-1 border-t border-green-800 pt-1">
                    <div>Prompts: {game.prompts?.length || 0}</div>
                    <div>Subs: {game.submissions?.length || 0}</div>
                    <div>Votes: {game.votes?.length || 0}</div>
                    <div>Suggestions: {game.suggestions?.length || 0}</div>
                </div>
                {game.currentPromptId && (
                    <div className="text-[10px] mt-1 text-gray-400">
                        Current Battle: {currentBattleFighters} Fighters
                    </div>
                )}

                <div className="mt-4">
                    <h4 className="font-bold mb-1 text-green-500">PLAYERS ({game.players.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {game.players.map((p) => (
                            <div key={p._id} className={`border p-2 rounded ${p.knockedOut ? 'border-red-900 bg-red-900/10 text-red-400' : 'border-green-800 bg-black/20'}`}>
                                <div className="font-bold text-sm flex justify-between">
                                    <span>{p.name} {p.isVip && "👑"}</span>
                                    <span className="text-xs opacity-50">{p._id.slice(-4)}</span>
                                </div>
                                <div className="text-xs">
                                    Role: <span className={p.role === "CORNER_MAN" ? "text-yellow-500 font-bold" : "text-blue-300"}>{p.role || "FIGHTER"}</span>
                                </div>
                                {p.role === "CORNER_MAN" && (
                                    <div className="text-xs text-yellow-500">
                                        Team: {game.players.find((pl) => pl._id === p.teamId)?.name || p.teamId?.slice(-4) || "None"}
                                    </div>
                                )}
                                <div className="text-xs">HP: <span className={(p.hp ?? 100) < 40 ? "text-red-500 font-bold" : "text-white"}>{p.hp ?? 100}</span>/{p.maxHp ?? 100}</div>
                                <div className="text-xs">KO: {p.knockedOut ? "YES" : "NO"}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
