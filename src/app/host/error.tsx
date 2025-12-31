"use client";

import { useEffect } from "react";

export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Host Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <div className="text-8xl mb-6 animate-pulse">⚠️</div>
      <h1 className="text-5xl md:text-7xl font-bold text-red-500 mb-4 text-center"
        style={{
          textShadow: "0 0 40px rgba(239,68,68,0.6)",
          fontFamily: "'Impact', 'Arial Black', sans-serif",
        }}
      >
        TECHNICAL DIFFICULTIES
      </h1>
      <p className="text-xl md:text-2xl text-gray-400 mb-8 text-center max-w-lg">
        {error.message || "The host display encountered an error"}
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-xl transition-colors"
          style={{ boxShadow: "0 0 20px rgba(239,68,68,0.4)" }}
        >
          Retry
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-xl transition-colors"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
