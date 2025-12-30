import { GameState } from "@/lib/types";

interface HostLobbyViewProps {
    game: GameState;
}

export function HostLobbyView({ game }: HostLobbyViewProps) {
    const players = game.players || [];
    const vip = players.find(p => p.isVip);

    return (
        <div
            id="host-lobby"
            data-player-count={players.length}
            className="flex flex-col items-center justify-center min-h-screen p-8"
        >
            {/* Title */}
            <h1 className="text-6xl font-bold mb-8 text-center">
                SmackTalk
            </h1>

            {/* Room Code - Extra large for TV viewing */}
            <div className="mb-12 text-center">
                <p className="text-2xl text-gray-400 mb-2">JOIN WITH CODE</p>
                <div
                    id="room-code-display"
                    className="text-[12rem] font-mono font-bold tracking-widest leading-none"
                    style={{ textShadow: "0 0 40px rgba(255,255,255,0.3)" }}
                >
                    {game.roomCode}
                </div>
            </div>

            {/* Players List */}
            <div className="w-full max-w-2xl">
                <h2 className="text-3xl font-bold mb-6 text-center">
                    Players ({players.length})
                </h2>

                {players.length === 0 ? (
                    <p className="text-2xl text-gray-500 text-center animate-pulse">
                        Waiting for players to join...
                    </p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {players.map((player) => (
                            <div
                                key={player._id}
                                id={`player-${player._id}`}
                                data-is-vip={player.isVip}
                                className="bg-gray-800 rounded-lg p-4 text-center"
                            >
                                <span className="text-2xl font-bold">
                                    {player.name}
                                </span>
                                {player.isVip && (
                                    <span className="ml-2 text-yellow-400">VIP</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="mt-12 text-center">
                {players.length === 0 ? (
                    <p className="text-xl text-gray-500">
                        Scan the code or enter it on your phone
                    </p>
                ) : vip ? (
                    <p className="text-2xl text-gray-400 animate-pulse">
                        Waiting for {vip.name} to start the game...
                    </p>
                ) : (
                    <p className="text-xl text-gray-500">
                        First player to join will be the VIP
                    </p>
                )}
            </div>
        </div>
    );
}
