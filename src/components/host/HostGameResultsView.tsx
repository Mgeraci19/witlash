"use client";

import { GameState } from "@/lib/types";
import { AvatarFighter } from "./AvatarFighter";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

interface HostGameResultsViewProps {
    game: GameState;
}

export function HostGameResultsView({ game }: HostGameResultsViewProps) {
    const router = useRouter();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const confettiTriggeredRef = useRef(false);

    // Sort fighters by HP to get winner
    const fighters = game.players
        .filter(p => p.role === "FIGHTER")
        .sort((a, b) => (b.hp || 0) - (a.hp || 0));

    const winner = fighters[0];

    // Get all prompts with their submissions for Q&A carousel
    const questionsWithAnswers = game.prompts?.map((prompt) => {
        const submissions = game.submissions?.filter((s) => s.promptId === prompt._id) || [];
        const votes = game.votes?.filter((v) => v.promptId === prompt._id) || [];

        // Get vote counts per submission
        const submissionsWithVotes = submissions.map((sub) => {
            const subVotes = votes.filter((v) => v.submissionId === sub._id);
            const player = game.players?.find((p) => p._id === sub.playerId);
            return {
                text: sub.text,
                playerName: player?.name || "Unknown",
                voteCount: subVotes.length,
                isWinner: subVotes.length > 0 && subVotes.length >= Math.max(...submissions.map(s => votes.filter(v => v.submissionId === s._id).length)),
            };
        }).sort((a, b) => b.voteCount - a.voteCount);

        return {
            question: prompt.text,
            answers: submissionsWithVotes,
        };
    }).filter((q) => q.answers.length > 0) || [];

    // Confetti effect on mount
    useEffect(() => {
        if (confettiTriggeredRef.current) return;
        confettiTriggeredRef.current = true;

        // Initial burst
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 },
                colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 },
                colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();

        // Periodic bursts
        const interval = setInterval(() => {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
            });
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll Q&A carousel
    useEffect(() => {
        if (questionsWithAnswers.length === 0) return;

        const interval = setInterval(() => {
            setCurrentQuestionIndex((prev) => (prev + 1) % questionsWithAnswers.length);
        }, 4000); // 4 seconds per question

        return () => clearInterval(interval);
    }, [questionsWithAnswers.length]);

    const currentQuestion = questionsWithAnswers[currentQuestionIndex];

    return (
        <div
            id="host-game-results"
            data-phase="RESULTS"
            className="flex flex-col items-center justify-center min-h-screen p-8 relative overflow-hidden"
        >
            {/* Game Over Header with Golden Glow */}
            <h1
                className="text-8xl md:text-9xl font-bold mb-8 text-center text-yellow-400"
                style={{
                    textShadow: "0 0 60px rgba(255,215,0,0.8), 0 0 120px rgba(255,215,0,0.6)",
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                }}
            >
                VICTORY!
            </h1>

            {/* Champion Spotlight - Only the Winner */}
            {winner && (
                <div className="mb-12 text-center">
                    <div
                        className="text-4xl md:text-5xl text-yellow-400 mb-6 font-bold tracking-wider"
                        style={{ textShadow: "0 0 30px rgba(255,215,0,0.6)" }}
                    >
                        👑 CHAMPION 👑
                    </div>
                    <div className="transform scale-110">
                        <AvatarFighter
                            name={winner.name}
                            avatar={winner.avatar}
                            side="left"
                            state="victory"
                            size="large"
                        />
                    </div>
                    <div
                        className="mt-6 text-5xl md:text-6xl font-bold text-white"
                        style={{ textShadow: "0 0 20px rgba(255,255,255,0.5)" }}
                    >
                        {winner.name}
                    </div>
                    <div className="mt-3 text-3xl text-green-400 font-bold">
                        Final HP: {winner.hp}
                    </div>
                </div>
            )}

            {/* Scrolling Q&A Carousel */}
            {currentQuestion && (
                <div className="w-full max-w-4xl bg-gray-900/70 rounded-2xl p-8 border-2 border-yellow-500/30 mb-8">
                    <div className="text-center mb-6">
                        <div className="text-sm text-gray-400 mb-2">
                            Question {currentQuestionIndex + 1} of {questionsWithAnswers.length}
                        </div>
                        <div className="text-2xl md:text-3xl font-bold text-white mb-6">
                            &ldquo;{currentQuestion.question}&rdquo;
                        </div>
                    </div>

                    <div className="space-y-4">
                        {currentQuestion.answers.map((answer, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-xl transition-all duration-300 ${
                                    answer.isWinner
                                        ? "bg-green-900/50 border-2 border-yellow-400"
                                        : "bg-gray-800/50 border border-gray-700"
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="text-lg md:text-xl text-white font-medium mb-2">
                                            {answer.text}
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            by {answer.playerName}
                                        </div>
                                    </div>
                                    <div
                                        className={`ml-4 text-xl md:text-2xl font-bold ${
                                            answer.isWinner ? "text-yellow-400" : "text-gray-400"
                                        }`}
                                    >
                                        {answer.voteCount} {answer.voteCount === 1 ? "vote" : "votes"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New Game Button */}
            <button
                id="new-game-button"
                data-testid="new-game-button"
                data-action="new-game"
                className="mt-8 px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-lg transition-colors shadow-lg"
                onClick={() => {
                    // Clear host session
                    sessionStorage.removeItem("hostToken");
                    router.push("/");
                }}
            >
                New Game
            </button>

            {/* Footer */}
            <div className="mt-8 text-xl text-gray-500">
                Thanks for playing SmackTalk!
            </div>
        </div>
    );
}
