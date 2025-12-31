"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { GameState } from "@/lib/types";
import { FighterHealthBar } from "./FighterHealthBar";
import { AnimationOrchestrator } from "./animations/AnimationOrchestrator";
import { BattleSide } from "./animations/core/types";
import { useBattleData } from "@/hooks/useBattleData";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AUTO_ADVANCE } from "./animations/config";

interface HostVotingViewProps {
  game: GameState;
  showWritingIndicator?: boolean;
}

export function HostVotingView({ game, showWritingIndicator = false }: HostVotingViewProps) {
  const isReveal = game.roundStatus === "REVEAL";

  // Track battle completion for status display
  const [battleComplete, setBattleComplete] = useState(false);

  // Local HP tracking for animation sync (animated values, not source of truth)
  // Initialize to 100 (default HP), will sync with actual player HP in useEffect
  const [animatedLeftHp, setAnimatedLeftHp] = useState<number>(100);
  const [animatedRightHp, setAnimatedRightHp] = useState<number>(100);

  // Track damage to show floating numbers
  const [leftShowDamage, setLeftShowDamage] = useState<number | undefined>(undefined);
  const [rightShowDamage, setRightShowDamage] = useState<number | undefined>(undefined);

  // Auto-advance logic
  const autoAdvanceScheduledRef = useRef(false);
  const hostTriggerNextBattle = useMutation(api.engine.hostTriggerNextBattle);

  // Auto-advance effect: trigger nextBattle after delay when battle is complete
  useEffect(() => {
    // Only proceed if battle is complete and we haven't scheduled yet
    if (!battleComplete || autoAdvanceScheduledRef.current) {
      return;
    }

    // Get host token from sessionStorage
    const hostToken = sessionStorage.getItem("hostToken");
    if (!hostToken) {
      console.log("[AUTO-ADVANCE] No host token found, skipping auto-advance");
      return;
    }

    autoAdvanceScheduledRef.current = true;
    console.log(`[AUTO-ADVANCE] Scheduling nextBattle in ${AUTO_ADVANCE.BATTLE_DELAY}ms`);

    const timer = setTimeout(() => {
      console.log("[AUTO-ADVANCE] Triggering nextBattle");
      hostTriggerNextBattle({ gameId: game._id, hostToken })
        .catch((err) => console.error("[AUTO-ADVANCE] Error:", err));
    }, AUTO_ADVANCE.BATTLE_DELAY);

    return () => {
      clearTimeout(timer);
      autoAdvanceScheduledRef.current = false; // Reset so it can reschedule on remount
    };
  }, [battleComplete, game._id, hostTriggerNextBattle]);

  // Get current prompt and its submissions
  const currentPrompt = game.prompts?.find((p) => p._id === game.currentPromptId);

  // Fetch battle data from backend (SINGLE SOURCE OF TRUTH for damage)
  const battleData = useBattleData(game.currentPromptId);

  // Debug: Log battle data
  useEffect(() => {
    console.log("========================================");
    console.log("[BATTLE DATA] Prompt:", game.currentPromptId);
    console.log("[BATTLE DATA] Loading:", battleData.isLoading);
    console.log("[BATTLE DATA] Left Damage:", battleData.leftDamage, "Right Damage:", battleData.rightDamage);
    console.log("[BATTLE DATA] Left Votes:", battleData.leftVotes, "Right Votes:", battleData.rightVotes);
    console.log("========================================");
  }, [game.currentPromptId, battleData]);

  // Memoize filtered arrays
  const currentSubmissions = useMemo(
    () => game.submissions?.filter((s) => s.promptId === game.currentPromptId) || [],
    [game.submissions, game.currentPromptId]
  );
  const currentVotes = useMemo(
    () => game.votes?.filter((v) => v.promptId === game.currentPromptId) || [],
    [game.votes, game.currentPromptId]
  );

  // Calculate vote counts, winner, and voters (damage now comes from backend)
  const { voteCounts, maxVotes, totalVotes, votersBySubmission } = useMemo(() => {
    const counts: Record<string, number> = {};
    const voters: Record<string, string[]> = {};
    let max = 0;

    currentVotes.forEach((vote) => {
      const subId = vote.submissionId as string;
      counts[subId] = (counts[subId] || 0) + 1;
      if (counts[subId] > max) max = counts[subId];

      // Track who voted for what
      const voter = game.players.find((p) => p._id === vote.playerId);
      if (voter) {
        if (!voters[subId]) voters[subId] = [];
        voters[subId].push(voter.name);
      }
    });

    // Calculate total votes
    const total = currentVotes.length;

    return {
      voteCounts: counts,
      maxVotes: max,
      totalVotes: total,
      votersBySubmission: voters,
    };
  }, [currentVotes]);

  // Get battlers with all info
  const battlers = useMemo(() => {
    // Sort submissions by playerId for consistent left/right positioning
    // This ensures the same player always appears on the same side
    const sortedSubmissions = [...currentSubmissions].sort((a, b) => {
      const aId = (a.playerId as string) || "";
      const bId = (b.playerId as string) || "";
      return aId.localeCompare(bId);
    });

    // Check if it's a tie first
    const voteCountsList = sortedSubmissions.map((sub) => voteCounts[sub._id as string] || 0);
    const isTie = voteCountsList.length === 2 && voteCountsList[0] === voteCountsList[1];

    // Check for speed tiebreaker winner
    const speedWinner = sortedSubmissions.find((sub) => sub.wonBySpeed === true);

    const result = sortedSubmissions.map((sub, index) => {
      const player = game.players.find((p) => p._id === sub.playerId);
      const voteCount = voteCounts[sub._id as string] || 0;
      const voters = votersBySubmission[sub._id as string] || [];

      // Winner determination:
      // 1. If this submission won by speed, they're the winner (tie broken by speed)
      // 2. Otherwise, winner has max votes (and no tie)
      const isWinner = isReveal && (
        (sub.wonBySpeed === true) ||
        (!isTie && !speedWinner && totalVotes > 0 && voteCount === maxVotes && voteCount > 0)
      );

      return {
        ...sub,
        player,
        voteCount,
        isWinner,
        voters,
        wonBySpeed: sub.wonBySpeed,
        side: (index === 0 ? "left" : "right") as "left" | "right",
      };
    });

    console.log("========================================");
    console.log("[BATTLERS DATA]", result.map(b => ({
      name: b.player?.name,
      voteCount: b.voteCount,
      isWinner: b.isWinner,
      voters: b.voters,
    })));
    console.log("========================================");

    return result;
  }, [currentSubmissions, game.players, voteCounts, isReveal, totalVotes, maxVotes, votersBySubmission]);

  const leftBattler = battlers[0];
  const rightBattler = battlers[1];

  // Determine winner for status message
  const winner = battlers.find((b) => b.isWinner);

  // Convert to BattleArena format
  const leftBattlerInfo = leftBattler
    ? {
        id: leftBattler._id as string,
        name: leftBattler.player?.name || "Unknown",
        avatar: leftBattler.player?.avatar,
        answer: leftBattler.text,
        voteCount: leftBattler.voteCount,
        isWinner: leftBattler.isWinner,
        voters: leftBattler.voters,
        hp: leftBattler.player?.hp || 100,
        maxHp: leftBattler.player?.maxHp || 100,
        submissionTime: leftBattler._creationTime,
        winStreak: leftBattler.player?.winStreak,
        wonBySpeed: leftBattler.wonBySpeed,
        attackType: leftBattler.attackType as "jab" | "haymaker" | "flyingKick" | undefined,
        specialBar: leftBattler.player?.specialBar ?? 0,
      }
    : null;

  if (leftBattlerInfo) {
    console.log(`[HP BAR DATA] Left fighter: ${leftBattlerInfo.name}, winStreak: ${leftBattlerInfo.winStreak}, specialBar: ${leftBattlerInfo.specialBar}`);
  }

  const rightBattlerInfo = rightBattler
    ? {
        id: rightBattler._id as string,
        name: rightBattler.player?.name || "Unknown",
        avatar: rightBattler.player?.avatar,
        answer: rightBattler.text,
        voteCount: rightBattler.voteCount,
        isWinner: rightBattler.isWinner,
        voters: rightBattler.voters,
        hp: rightBattler.player?.hp || 100,
        maxHp: rightBattler.player?.maxHp || 100,
        submissionTime: rightBattler._creationTime,
        winStreak: rightBattler.player?.winStreak,
        wonBySpeed: rightBattler.wonBySpeed,
        attackType: rightBattler.attackType as "jab" | "haymaker" | "flyingKick" | undefined,
        specialBar: rightBattler.player?.specialBar ?? 0,
      }
    : null;

  if (rightBattlerInfo) {
    console.log(`[HP BAR DATA] Right fighter: ${rightBattlerInfo.name}, winStreak: ${rightBattlerInfo.winStreak}`);
  }

  // Debug: Log what's being passed to AnimationOrchestrator
  useEffect(() => {
    if (leftBattlerInfo && rightBattlerInfo) {
      console.log("========================================");
      console.log("[PASSING TO ANIMATOR]");
      console.log("Left:", leftBattlerInfo.name, "- Votes:", leftBattlerInfo.voteCount, "- isWinner:", leftBattlerInfo.isWinner, "- Damage:", battleData.leftDamage);
      console.log("Right:", rightBattlerInfo.name, "- Votes:", rightBattlerInfo.voteCount, "- isWinner:", rightBattlerInfo.isWinner, "- Damage:", battleData.rightDamage);
      console.log("========================================");
    }
  }, [leftBattlerInfo, rightBattlerInfo, battleData]);

  // Sync animated HP when battlers change (new players in battle)
  useEffect(() => {
    if (leftBattler?.player) {
      setAnimatedLeftHp(leftBattler.player.hp ?? 100);
    }
    if (rightBattler?.player) {
      setAnimatedRightHp(rightBattler.player.hp ?? 100);
    }
  }, [leftBattler?.player?._id, rightBattler?.player?._id]);

  // Callbacks
  const handleBattleComplete = useCallback(() => {
    console.log("[BATTLE COMPLETE] Marking battle as complete, round:", game.currentRound);
    setBattleComplete(true);
  }, [game.currentRound]);

  const handleDamageApplied = useCallback((side: BattleSide, damage: number) => {
    console.log(`[HP UPDATE] ${side} taking ${damage} damage`);
    // Update local animated HP immediately for visual feedback
    if (side === "left") {
      setAnimatedLeftHp((prev) => {
        const newHp = Math.max(0, prev - damage);
        console.log(`[HP UPDATE] Left HP: ${prev} -> ${newHp}`);
        return newHp;
      });
      if (damage > 0) {
        setLeftShowDamage(damage);
        // Clear damage display after animation completes
        setTimeout(() => setLeftShowDamage(undefined), 600);
      }
    } else {
      setAnimatedRightHp((prev) => {
        const newHp = Math.max(0, prev - damage);
        console.log(`[HP UPDATE] Right HP: ${prev} -> ${newHp}`);
        return newHp;
      });
      if (damage > 0) {
        setRightShowDamage(damage);
        // Clear damage display after animation completes
        setTimeout(() => setRightShowDamage(undefined), 600);
      }
    }
  }, []);

  // Reset battle complete and HP tracking when prompt changes
  useEffect(() => {
    console.log("[BATTLE RESET] New prompt, resetting battle state. Prompt ID:", game.currentPromptId);
    setBattleComplete(false);
    // Clear damage displays
    setLeftShowDamage(undefined);
    setRightShowDamage(undefined);
    // Re-sync HP from current player data
    if (leftBattler?.player) {
      setAnimatedLeftHp(leftBattler.player.hp ?? 100);
    }
    if (rightBattler?.player) {
      setAnimatedRightHp(rightBattler.player.hp ?? 100);
    }
  }, [game.currentPromptId, leftBattler?.player?._id, rightBattler?.player?._id]);

  return (
    <div
      id="host-voting"
      data-phase="VOTING"
      data-round-status={game.roundStatus}
      data-prompt-id={game.currentPromptId}
      className="flex flex-col h-screen p-4 overflow-hidden"
    >
      {/* Header Bar: HP bars on sides, Round in center */}
      <div className="flex items-start gap-4 mb-0 flex-shrink-0">
        {/* Left HP Bar */}
        <div className="w-72 flex-shrink-0">
          {leftBattler?.player && (
            <FighterHealthBar
              name={leftBattler.player.name}
              hp={animatedLeftHp}
              maxHp={leftBattler.player.maxHp || 100}
              side="left"
              isWinner={battleComplete && leftBattler.isWinner}
              avatar={leftBattler.player.avatar}
              showDamage={leftShowDamage}
              specialBar={leftBattler.player.specialBar}
              currentRound={game.currentRound}
            />
          )}
        </div>

        {/* Center: Round indicator and prompt type */}
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-gray-300">Round {game.currentRound}</div>
          {/* Semi-Finals (Round 2): Show JAB or HAYMAKER prompt type */}
          {game.currentRound === 2 && currentPrompt?.promptType && (
            <div className={`text-lg font-bold mt-1 ${
              currentPrompt.promptType === "haymaker"
                ? "text-orange-400"
                : "text-blue-400"
            }`}>
              {currentPrompt.promptType === "haymaker" ? "🥊 HAYMAKER" : "👊 JAB"}
            </div>
          )}
        </div>

        {/* Right HP Bar */}
        <div className="w-72 flex-shrink-0">
          {rightBattler?.player && (
            <FighterHealthBar
              name={rightBattler.player.name}
              hp={animatedRightHp}
              maxHp={rightBattler.player.maxHp || 100}
              side="right"
              isWinner={battleComplete && rightBattler.isWinner}
              avatar={rightBattler.player.avatar}
              showDamage={rightShowDamage}
              specialBar={rightBattler.player.specialBar}
              currentRound={game.currentRound}
            />
          )}
        </div>
      </div>

      {/* Battle Arena - Takes remaining space */}
      <div className="flex-1 min-h-0">
        <AnimationOrchestrator
          gameState={game}
          currentPromptId={game.currentPromptId}
          promptText={currentPrompt?.text}
          leftBattler={leftBattlerInfo}
          rightBattler={rightBattlerInfo}
          leftDamage={battleData.leftDamage}
          rightDamage={battleData.rightDamage}
          onBattleComplete={handleBattleComplete}
          onDamageApplied={handleDamageApplied}
        />
      </div>

      {/* Status - Only show result after battle complete */}
      {battleComplete && (
        <div className="text-center py-2 flex-shrink-0">
          {/* Bragging Round Message - Semi-Finals prompt 4 after KO */}
          {game.braggingRoundMessage && (
            <div className="text-2xl md:text-3xl font-bold mb-2"
              style={{
                color: game.braggingRoundMessage === "STOP_ALREADY_DEAD" ? "#ef4444" : "#a855f7",
                textShadow: game.braggingRoundMessage === "STOP_ALREADY_DEAD"
                  ? "0 0 20px rgba(239, 68, 68, 0.5)"
                  : "0 0 20px rgba(168, 85, 247, 0.5)"
              }}
            >
              {game.braggingRoundMessage === "STOP_ALREADY_DEAD"
                ? "\"Stop! He's already dead!\""
                : "\"How did you miss a guy knocked out on the floor?\""}
            </div>
          )}
          <div className="text-lg text-gray-500">
            {winner ? (
              winner.wonBySpeed
                ? `${winner.player?.name} wins by SPEED!`
                : game.braggingRoundMessage
                  ? `${winner.player?.name} wins the BRAGGING ROUND!`
                  : `${winner.player?.name} wins this round!`
            ) : "It's a tie!"}
          </div>
        </div>
      )}

      {/* Final Round Writing Indicator - Shows during PROMPTS phase in Final */}
      {showWritingIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="bg-black/80 px-12 py-8 rounded-2xl border-2 border-yellow-400">
            <div className="text-4xl md:text-5xl font-bold text-yellow-400 mb-3 text-center animate-pulse">
              Players Writing Answers...
            </div>
            <div className="text-xl text-gray-300 text-center">
              Final battle continues when answers are submitted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
