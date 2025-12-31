"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-4">
        Something went wrong!
      </h1>
      <p className="text-lg md:text-xl text-gray-400 mb-8 text-center max-w-md">
        {error.message || "An unexpected error occurred"}
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
