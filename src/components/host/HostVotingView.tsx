"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { GameState } from "@/lib/types";
import { FighterHealthBar } from "./FighterHealthBar";
import { gsap } from "./animations/gsapConfig";

interface HostVotingViewProps {
    game: GameState;
}

export function HostVotingView({ game }: HostVotingViewProps) {
    const isReveal = game.roundStatus === "REVEAL";
    const [hasAnimated, setHasAnimated] = useState(false);
    const [showVoteAttacks, setShowVoteAttacks] = useState(false);

    // Refs for animations
    const answer1Ref = useRef<HTMLDivElement>(null);
    const answer2Ref = useRef<HTMLDivElement>(null);
    const voteContainerRef = useRef<HTMLDivElement>(null);
    const vsRef = useRef<HTMLDivElement>(null);

    // Get current prompt and its submissions
    const currentPrompt = game.prompts?.find(p => p._id === game.currentPromptId);
    const currentSubmissions = game.submissions?.filter(s => s.promptId === game.currentPromptId) || [];
    const currentVotes = game.votes?.filter(v => v.promptId === game.currentPromptId) || [];

    // Calculate vote counts and winner
    const { voteCounts, maxVotes, totalVotes, votersBySubmission } = useMemo(() => {
        const counts: Record<string, number> = {};
        const voters: Record<string, string[]> = {};
        let max = 0;

        currentVotes.forEach(vote => {
            const subId = vote.submissionId as string;
            counts[subId] = (counts[subId] || 0) + 1;
            if (counts[subId] > max) max = counts[subId];

            // Track who voted for what
            const voter = game.players.find(p => p._id === vote.playerId);
            if (voter) {
                if (!voters[subId]) voters[subId] = [];
                voters[subId].push(voter.name);
            }
        });

        return { voteCounts: counts, maxVotes: max, totalVotes: currentVotes.length, votersBySubmission: voters };
    }, [currentVotes, game.players]);

    // Get battlers with all info
    const battlers = useMemo(() => {
        return currentSubmissions.map((sub, index) => {
            const player = game.players.find(p => p._id === sub.playerId);
            const voteCount = voteCounts[sub._id as string] || 0;
            const isWinner = isReveal && totalVotes > 0 && voteCount === maxVotes && voteCount > 0;
            const voters = votersBySubmission[sub._id as string] || [];
            return {
                ...sub,
                player,
                voteCount,
                isWinner,
                voters,
                side: index === 0 ? "left" : "right" as "left" | "right"
            };
        });
    }, [currentSubmissions, game.players, voteCounts, isReveal, totalVotes, maxVotes, votersBySubmission]);

    const leftBattler = battlers[0];
    const rightBattler = battlers[1];

    // Determine winner and loser for attack animation
    const winner = battlers.find(b => b.isWinner);
    const loser = battlers.find(b => !b.isWinner && battlers.length === 2);

    // Reset animation state when prompt changes
    useEffect(() => {
        setHasAnimated(false);
        setShowVoteAttacks(false);

        // Reset positions
        if (answer1Ref.current) gsap.set(answer1Ref.current, { x: 0, opacity: 1 });
        if (answer2Ref.current) gsap.set(answer2Ref.current, { x: 0, opacity: 1 });
        if (vsRef.current) gsap.set(vsRef.current, { opacity: 1, scale: 1 });
    }, [game.currentPromptId]);

    // Reveal animation sequence
    useEffect(() => {
        if (!isReveal || hasAnimated || battlers.length !== 2) return;

        setHasAnimated(true);

        const tl = gsap.timeline();

        // Step 1: Fade out VS
        tl.to(vsRef.current, {
            opacity: 0,
            scale: 0.5,
            duration: 0.2,
            ease: "power2.in"
        });

        // Step 2: Slide answers to their sides (quick!)
        tl.to(answer1Ref.current, {
            x: -80,
            duration: 0.25,
            ease: "power2.out"
        }, "-=0.1");

        tl.to(answer2Ref.current, {
            x: 80,
            duration: 0.25,
            ease: "power2.out"
        }, "<");

        // Step 3: Show vote attacks
        tl.call(() => {
            setShowVoteAttacks(true);
        }, [], "+=0.1");

    }, [isReveal, hasAnimated, battlers.length]);

    return (
        <div
            id="host-voting"
            data-phase="VOTING"
            data-round-status={game.roundStatus}
            data-prompt-id={game.currentPromptId}
            className="flex flex-col min-h-screen p-8"
        >
            {/* Health Bars at Top */}
            <div className="flex justify-between items-start gap-8 mb-8">
                {leftBattler?.player && (
                    <FighterHealthBar
                        name={leftBattler.player.name}
                        hp={leftBattler.player.hp || 0}
                        maxHp={leftBattler.player.maxHp || 100}
                        side="left"
                        isWinner={leftBattler.isWinner}
                    />
                )}
                {rightBattler?.player && (
                    <FighterHealthBar
                        name={rightBattler.player.name}
                        hp={rightBattler.player.hp || 0}
                        maxHp={rightBattler.player.maxHp || 100}
                        side="right"
                        isWinner={rightBattler.isWinner}
                    />
                )}
            </div>

            {/* Round Indicator */}
            <div className="text-xl text-gray-400 text-center mb-2">
                Round {game.currentRound}
            </div>

            {/* Prompt */}
            {currentPrompt && (
                <div className="text-2xl text-center mb-8 max-w-4xl mx-auto italic text-gray-300">
                    &ldquo;{currentPrompt.text}&rdquo;
                </div>
            )}

            {/* Battle Arena */}
            <div className="flex-1 flex items-center justify-center" ref={voteContainerRef}>
                <div className="relative w-full max-w-5xl flex items-center justify-center gap-4">

                    {/* Left Answer */}
                    {leftBattler && (
                        <div
                            ref={answer1Ref}
                            className={`flex-1 max-w-md transition-all ${isReveal && leftBattler.isWinner ? "ring-4 ring-yellow-400" : ""}`}
                        >
                            <AnswerCard
                                text={leftBattler.text}
                                authorName={isReveal ? leftBattler.player?.name : undefined}
                                voteCount={isReveal ? leftBattler.voteCount : undefined}
                                voters={isReveal ? leftBattler.voters : undefined}
                                isWinner={leftBattler.isWinner}
                                side="left"
                                showAttacks={showVoteAttacks && !leftBattler.isWinner && winner?.voteCount}
                                attackCount={winner?.voteCount || 0}
                            />
                        </div>
                    )}

                    {/* VS Badge */}
                    <div
                        ref={vsRef}
                        className="text-6xl font-bold text-red-500 px-4 z-10"
                        style={{ textShadow: "0 0 20px rgba(255,0,0,0.5)" }}
                    >
                        VS
                    </div>

                    {/* Right Answer */}
                    {rightBattler && (
                        <div
                            ref={answer2Ref}
                            className={`flex-1 max-w-md transition-all ${isReveal && rightBattler.isWinner ? "ring-4 ring-yellow-400" : ""}`}
                        >
                            <AnswerCard
                                text={rightBattler.text}
                                authorName={isReveal ? rightBattler.player?.name : undefined}
                                voteCount={isReveal ? rightBattler.voteCount : undefined}
                                voters={isReveal ? rightBattler.voters : undefined}
                                isWinner={rightBattler.isWinner}
                                side="right"
                                showAttacks={showVoteAttacks && !rightBattler.isWinner && winner?.voteCount}
                                attackCount={winner?.voteCount || 0}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Status */}
            <div className="text-center mt-8">
                {!isReveal ? (
                    <div className="text-2xl text-gray-400 animate-pulse">
                        Players are voting...
                    </div>
                ) : (
                    <div className="text-xl text-gray-500">
                        {winner ? `${winner.player?.name} wins this round!` : "It's a tie!"}
                    </div>
                )}
            </div>
        </div>
    );
}

// Answer Card Component
interface AnswerCardProps {
    text: string;
    authorName?: string;
    voteCount?: number;
    voters?: string[];
    isWinner: boolean;
    side: "left" | "right";
    showAttacks?: boolean | number;
    attackCount: number;
}

function AnswerCard({ text, authorName, voteCount, voters, isWinner, side, showAttacks, attackCount }: AnswerCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const attacksRef = useRef<HTMLDivElement>(null);

    // Attack animation
    useEffect(() => {
        if (!showAttacks || !attacksRef.current || attackCount === 0) return;

        const attacks = attacksRef.current.children;
        const fromX = side === "left" ? 200 : -200;

        // Staggered attack animation - quick and punchy
        gsap.fromTo(attacks,
            { x: fromX, opacity: 0, scale: 0.5 },
            {
                x: 0,
                opacity: 1,
                scale: 1,
                duration: 0.15,
                stagger: 0.08,
                ease: "power2.out",
                onComplete: () => {
                    // Quick shake on impact
                    if (cardRef.current) {
                        gsap.to(cardRef.current, {
                            x: side === "left" ? -10 : 10,
                            duration: 0.05,
                            yoyo: true,
                            repeat: 3,
                            ease: "power1.inOut"
                        });
                    }
                }
            }
        );
    }, [showAttacks, attackCount, side]);

    return (
        <div
            ref={cardRef}
            className={`relative bg-gray-800 rounded-xl p-6 ${isWinner ? "bg-green-900/30" : ""}`}
        >
            {/* Attack Hits (shown on loser) */}
            {showAttacks && attackCount > 0 && (
                <div
                    ref={attacksRef}
                    className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 ${side === "left" ? "-right-16" : "-left-16"}`}
                >
                    {Array.from({ length: attackCount }).map((_, i) => (
                        <div
                            key={i}
                            className="text-3xl"
                            style={{ filter: "drop-shadow(0 0 8px rgba(255,100,0,0.8))" }}
                        >
                            💥
                        </div>
                    ))}
                </div>
            )}

            {/* Answer Text */}
            <div className="text-xl text-white mb-4">
                {text}
            </div>

            {/* Author (shown on reveal) */}
            {authorName && (
                <div className={`text-sm ${isWinner ? "text-yellow-400" : "text-gray-400"} mb-2`}>
                    — {authorName}
                </div>
            )}

            {/* Vote Count */}
            {voteCount !== undefined && (
                <div className={`text-3xl font-bold ${isWinner ? "text-yellow-400" : "text-gray-500"}`}>
                    {voteCount} {voteCount === 1 ? "vote" : "votes"}
                </div>
            )}

            {/* Voters List */}
            {voters && voters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">Voted by:</div>
                    <div className="flex flex-wrap gap-1">
                        {voters.map((voter, i) => (
                            <span key={i} className="text-xs bg-gray-700 px-2 py-1 rounded">
                                {voter}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Winner Badge */}
            {isWinner && (
                <div className="absolute -top-3 -right-3 bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-sm animate-bounce">
                    WINNER!
                </div>
            )}
        </div>
    );
}
