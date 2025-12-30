interface FighterPlaceholderProps {
    name: string;
    hp?: number;
    maxHp?: number;
    isKnockedOut?: boolean;
    side?: "left" | "right";
    size?: "small" | "medium" | "large";
    avatar?: string; // Base64 PNG image
}

export function FighterPlaceholder({
    name,
    hp,
    maxHp = 100,
    isKnockedOut = false,
    side = "left",
    size = "medium",
    avatar,
}: FighterPlaceholderProps) {
    const sizeClasses = {
        small: "w-24 h-32",
        medium: "w-40 h-52",
        large: "w-56 h-72",
    };

    const hpPercentage = hp !== undefined ? (hp / maxHp) * 100 : 100;

    const hpColor = hpPercentage > 50 ? "bg-green-500" : hpPercentage > 25 ? "bg-yellow-500" : "bg-red-500";

    return (
        <div
            className={`flex flex-col items-center ${side === "right" ? "scale-x-[-1]" : ""}`}
            data-fighter-name={name}
            data-hp={hp}
            data-knocked-out={isKnockedOut}
        >
            {/* Avatar */}
            <div
                className={`${sizeClasses[size]} bg-gray-700 rounded-lg border-4 ${
                    isKnockedOut ? "border-red-500 opacity-50" : "border-gray-500"
                } flex items-center justify-center relative overflow-hidden`}
                style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
            >
                {avatar ? (
                    <img
                        src={avatar}
                        alt={`${name}'s avatar`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    /* Placeholder silhouette */
                    <div className="text-gray-600 text-6xl">
                        {isKnockedOut ? "X" : "?"}
                    </div>
                )}
            </div>

            {/* Name plate */}
            <div
                className={`mt-2 px-4 py-1 bg-gray-800 rounded text-center ${
                    side === "right" ? "scale-x-[-1]" : ""
                }`}
            >
                <span className={`font-bold text-xl ${isKnockedOut ? "line-through text-gray-500" : "text-white"}`}>
                    {name}
                </span>
            </div>

            {/* HP Bar */}
            {hp !== undefined && (
                <div
                    className={`mt-2 w-full max-w-[200px] ${side === "right" ? "scale-x-[-1]" : ""}`}
                >
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
                        <div
                            className={`h-full ${hpColor} transition-all duration-500`}
                            style={{ width: `${hpPercentage}%` }}
                        />
                    </div>
                    <div className="text-center text-sm text-gray-400 mt-1">
                        {hp}/{maxHp} HP
                    </div>
                </div>
            )}
        </div>
    );
}
