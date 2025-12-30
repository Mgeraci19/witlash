import { GameState } from "@/lib/types";

interface HostLobbyViewProps {
    game: GameState;
}

export function HostLobbyView({ game }: HostLobbyViewProps) {
    const players = game.players || [];
    const vip = players.find(p => p.isVip);

    // Debug: Log player avatar data
    console.log("[HostLobbyView] Players:", players.map(p => ({
        name: p.name,
        hasAvatar: !!p.avatar,
        avatarPrefix: p.avatar?.substring(0, 30)
    })));

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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {players.map((player) => (
                            <div
                                key={player._id}
                                id={`player-${player._id}`}
                                data-is-vip={player.isVip}
                                className="bg-gray-800 rounded-lg p-4 flex flex-col items-center"
                            >
                                {/* Avatar */}
                                {player.avatar ? (
                                    <img
                                        src={player.avatar}
                                        alt={`${player.name}'s avatar`}
                                        className="w-20 h-20 rounded-lg border-4 border-gray-600 object-cover mb-3"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-lg border-4 border-gray-600 bg-gray-700 flex items-center justify-center text-4xl text-gray-500 mb-3">
                                        ?
                                    </div>
                                )}
                                <span className="text-2xl font-bold">
                                    {player.name}
                                </span>
                                {player.isVip && (
                                    <span className="text-yellow-400 text-sm mt-1">VIP</span>
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
