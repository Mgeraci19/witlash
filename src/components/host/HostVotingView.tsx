"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { GameState } from "@/lib/types";
import { FighterHealthBar } from "./FighterHealthBar";
import { BattleArena } from "./BattleArena";
import { BattleSide } from "./animations/registry/types";

interface HostVotingViewProps {
  game: GameState;
}

export function HostVotingView({ game }: HostVotingViewProps) {
  const isReveal = game.roundStatus === "REVEAL";

  // Track battle completion for status display
  const [battleComplete, setBattleComplete] = useState(false);

  // Local HP tracking for animation sync (animated values, not source of truth)
  const [animatedLeftHp, setAnimatedLeftHp] = useState<number | null>(null);
  const [animatedRightHp, setAnimatedRightHp] = useState<number | null>(null);
  const hasInitializedHp = useRef(false);

  // Get current prompt and its submissions
  const currentPrompt = game.prompts?.find((p) => p._id === game.currentPromptId);

  // Memoize filtered arrays
  const currentSubmissions = useMemo(
    () => game.submissions?.filter((s) => s.promptId === game.currentPromptId) || [],
    [game.submissions, game.currentPromptId]
  );
  const currentVotes = useMemo(
    () => game.votes?.filter((v) => v.promptId === game.currentPromptId) || [],
    [game.votes, game.currentPromptId]
  );

  // Calculate vote counts and winner
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

    return {
      voteCounts: counts,
      maxVotes: max,
      totalVotes: currentVotes.length,
      votersBySubmission: voters,
    };
  }, [currentVotes, game.players]);

  // Get battlers with all info
  const battlers = useMemo(() => {
    return currentSubmissions.map((sub, index) => {
      const player = game.players.find((p) => p._id === sub.playerId);
      const voteCount = voteCounts[sub._id as string] || 0;
      const isWinner = isReveal && totalVotes > 0 && voteCount === maxVotes && voteCount > 0;
      const voters = votersBySubmission[sub._id as string] || [];
      return {
        ...sub,
        player,
        voteCount,
        isWinner,
        voters,
        side: (index === 0 ? "left" : "right") as "left" | "right",
      };
    });
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
      }
    : null;

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
      }
    : null;

  // Initialize animated HP from player data
  useEffect(() => {
    if (leftBattler?.player && rightBattler?.player) {
      // Only initialize once per prompt, or when prompt changes
      if (!hasInitializedHp.current) {
        setAnimatedLeftHp(leftBattler.player.hp ?? 100);
        setAnimatedRightHp(rightBattler.player.hp ?? 100);
        hasInitializedHp.current = true;
      }
    }
  }, [leftBattler?.player, rightBattler?.player]);

  // Callbacks
  const handleBattleComplete = useCallback(() => {
    setBattleComplete(true);
  }, []);

  const handleDamageApplied = useCallback((side: BattleSide, damage: number) => {
    console.log(`[HostVotingView] Damage applied to ${side}: ${damage}`);
    // Update local animated HP immediately for visual feedback
    if (side === "left") {
      setAnimatedLeftHp((prev) => Math.max(0, (prev ?? 100) - damage));
    } else {
      setAnimatedRightHp((prev) => Math.max(0, (prev ?? 100) - damage));
    }
  }, []);

  // Reset battle complete and HP tracking when prompt changes
  useEffect(() => {
    setBattleComplete(false);
    hasInitializedHp.current = false;
    // Re-initialize HP from current player data
    if (leftBattler?.player && rightBattler?.player) {
      setAnimatedLeftHp(leftBattler.player.hp ?? 100);
      setAnimatedRightHp(rightBattler.player.hp ?? 100);
      hasInitializedHp.current = true;
    }
  }, [game.currentPromptId, leftBattler?.player, rightBattler?.player]);

  return (
    <div
      id="host-voting"
      data-phase="VOTING"
      data-round-status={game.roundStatus}
      data-prompt-id={game.currentPromptId}
      className="flex flex-col h-screen p-4 overflow-hidden"
    >
      {/* Header Bar: HP bars on sides, Round in center */}
      <div className="flex items-start gap-4 mb-2 flex-shrink-0">
        {/* Left HP Bar */}
        <div className="w-72 flex-shrink-0">
          {leftBattler?.player && (
            <FighterHealthBar
              name={leftBattler.player.name}
              hp={animatedLeftHp ?? leftBattler.player.hp ?? 0}
              maxHp={leftBattler.player.maxHp || 100}
              side="left"
              isWinner={battleComplete && leftBattler.isWinner}
              avatar={leftBattler.player.avatar}
            />
          )}
        </div>

        {/* Center: Round indicator only */}
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-gray-300">Round {game.currentRound}</div>
        </div>

        {/* Right HP Bar */}
        <div className="w-72 flex-shrink-0">
          {rightBattler?.player && (
            <FighterHealthBar
              name={rightBattler.player.name}
              hp={animatedRightHp ?? rightBattler.player.hp ?? 0}
              maxHp={rightBattler.player.maxHp || 100}
              side="right"
              isWinner={battleComplete && rightBattler.isWinner}
              avatar={rightBattler.player.avatar}
            />
          )}
        </div>
      </div>

      {/* Battle Arena - Takes remaining space */}
      <div className="flex-1 min-h-0">
        <BattleArena
          leftBattler={leftBattlerInfo}
          rightBattler={rightBattlerInfo}
          isReveal={isReveal}
          promptId={game.currentPromptId}
          promptText={currentPrompt?.text}
          onBattleComplete={handleBattleComplete}
          onDamageApplied={handleDamageApplied}
        />
      </div>

      {/* Status - Only show result after battle complete */}
      {battleComplete && (
        <div className="text-center py-2 flex-shrink-0">
          <div className="text-lg text-gray-500">
            {winner ? `${winner.player?.name} wins this round!` : "It's a tie!"}
          </div>
        </div>
      )}
    </div>
  );
}
