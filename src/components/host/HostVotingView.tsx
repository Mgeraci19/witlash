"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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

  // Callbacks
  const handleBattleComplete = useCallback(() => {
    setBattleComplete(true);
  }, []);

  const handleDamageApplied = useCallback((side: BattleSide, damage: number) => {
    console.log(`[HostVotingView] Damage applied to ${side}: ${damage}`);
    // HP is managed by Convex, this is just for visual feedback
  }, []);

  // Reset battle complete when prompt changes
  // Note: setState in effect is intentional here to reset UI state when prompt changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBattleComplete(false);
  }, [game.currentPromptId]);

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
            isWinner={battleComplete && leftBattler.isWinner}
            avatar={leftBattler.player.avatar}
          />
        )}
        {rightBattler?.player && (
          <FighterHealthBar
            name={rightBattler.player.name}
            hp={rightBattler.player.hp || 0}
            maxHp={rightBattler.player.maxHp || 100}
            side="right"
            isWinner={battleComplete && rightBattler.isWinner}
            avatar={rightBattler.player.avatar}
          />
        )}
      </div>

      {/* Round Indicator */}
      <div className="text-xl text-gray-400 text-center mb-2">Round {game.currentRound}</div>

      {/* Prompt */}
      {currentPrompt && (
        <div className="text-2xl text-center mb-8 max-w-4xl mx-auto italic text-gray-300">
          &ldquo;{currentPrompt.text}&rdquo;
        </div>
      )}

      {/* Battle Arena */}
      <div className="flex-1 flex items-center justify-center">
        <BattleArena
          leftBattler={leftBattlerInfo}
          rightBattler={rightBattlerInfo}
          isReveal={isReveal}
          promptId={game.currentPromptId}
          onBattleComplete={handleBattleComplete}
          onDamageApplied={handleDamageApplied}
        />
      </div>

      {/* Status */}
      <div className="text-center mt-8">
        {!isReveal ? (
          <div className="text-2xl text-gray-400 animate-pulse">Players are voting...</div>
        ) : battleComplete ? (
          <div className="text-xl text-gray-500">
            {winner ? `${winner.player?.name} wins this round!` : "It's a tie!"}
          </div>
        ) : (
          <div className="text-xl text-gray-500 animate-pulse">Revealing results...</div>
        )}
      </div>
    </div>
  );
}
