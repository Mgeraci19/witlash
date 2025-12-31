"use client";

import { useEffect } from "react";

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Room Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
      <div className="text-6xl mb-4">😵</div>
      <h1 className="text-3xl md:text-4xl font-bold text-red-500 mb-4 text-center">
        Game Error
      </h1>
      <p className="text-base md:text-lg text-gray-400 mb-6 text-center max-w-sm">
        {error.message || "Something went wrong with the game"}
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}
