"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { GameState } from "@/lib/types";
import { FighterHealthBar } from "./FighterHealthBar";
import { BattleArena } from "./BattleArena";
import { BattleSide } from "./animations/registry/types";
import { CornerManAssignment } from "./CornerManAssignment";

interface HostVotingViewProps {
  game: GameState;
  showWritingIndicator?: boolean;
}

export function HostVotingView({ game, showWritingIndicator = false }: HostVotingViewProps) {
  const isReveal = game.roundStatus === "REVEAL";

  // Track battle completion for status display
  const [battleComplete, setBattleComplete] = useState(false);

  // Local HP tracking for animation sync (animated values, not source of truth)
  const [animatedLeftHp, setAnimatedLeftHp] = useState<number | null>(null);
  const [animatedRightHp, setAnimatedRightHp] = useState<number | null>(null);
  const hasInitializedHp = useRef(false);

  // Track damage to show floating numbers
  const [leftShowDamage, setLeftShowDamage] = useState<number | undefined>(undefined);
  const [rightShowDamage, setRightShowDamage] = useState<number | undefined>(undefined);

  // Track corner man assignment display
  const [showCornerManAssignment, setShowCornerManAssignment] = useState(false);
  const [cornerManAssignment, setCornerManAssignment] = useState<{
    cornerManName: string;
    cornerManAvatar?: string;
    champName: string;
    champAvatar?: string;
  } | null>(null);

  // Track which players we've already shown corner man assignments for
  const shownCornerManRef = useRef<Set<string>>(new Set());

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

  // Calculate vote counts, winner, and damage
  const { voteCounts, maxVotes, totalVotes, votersBySubmission, leftDamage, rightDamage } = useMemo(() => {
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

    // Calculate total votes first
    const total = currentVotes.length;

    // Round multipliers (matches backend)
    const getRoundMultiplier = (round: number): number => {
      switch (round) {
        case 1: return 1.0;   // 35 max damage
        case 2: return 1.3;   // 45.5 max damage
        case 3: return 1.0;   // 35 max damage
        case 4: return 1.5;   // 52.5 max damage
        default: return 1.0;
      }
    };

    // Calculate damage based on votes (matches backend logic)
    const DAMAGE_CAP = 35;
    const COMBO_BONUS_DAMAGE = 15;
    let leftDmg = 0;
    let rightDmg = 0;

    if (currentSubmissions.length === 2 && total > 0) {
      const leftSubId = currentSubmissions[0]._id as string;
      const rightSubId = currentSubmissions[1]._id as string;
      const leftVotesFor = counts[leftSubId] || 0;
      const rightVotesFor = counts[rightSubId] || 0;

      // Check if it's a tie
      const isTie = leftVotesFor === rightVotesFor;

      if (isTie) {
        // Tie: both take 50% of DAMAGE_CAP with round multiplier
        const damage = 0.5 * DAMAGE_CAP * getRoundMultiplier(game.currentRound);
        leftDmg = Math.floor(damage);
        rightDmg = Math.floor(damage);
        console.log(`[TIE] Both players take ${Math.floor(damage)} damage. Combos will reset (unless KO tiebreaker applies).`);
      } else {
        // Non-tie: Only loser takes damage
        const loserIsLeft = leftVotesFor < rightVotesFor;

        // Get winner's player data from submissions
        const winnerSubmission = loserIsLeft ? currentSubmissions[1] : currentSubmissions[0];
        const winnerPlayer = game.players.find((p) => p._id === winnerSubmission.playerId);
        const winnerStreak = winnerPlayer?.winStreak || 0;

        const loserVotesFor = loserIsLeft ? leftVotesFor : rightVotesFor;
        const votesAgainst = total - loserVotesFor;

        let damage = (votesAgainst / total) * DAMAGE_CAP * getRoundMultiplier(game.currentRound);

        // Apply combo bonuses (matches backend logic)
        if (winnerStreak === 2) {
          // 3rd win = instant KO
          damage = 999;
          console.log(`[COMBO x3] ${winnerPlayer?.name} has 2-win streak, dealing instant KO damage!`);
        } else if (winnerStreak === 1) {
          // 2nd win = bonus damage
          damage += COMBO_BONUS_DAMAGE;
          console.log(`[COMBO x2] ${winnerPlayer?.name} has 1-win streak, dealing +${COMBO_BONUS_DAMAGE} bonus damage!`);
        }

        if (loserIsLeft) {
          leftDmg = Math.floor(damage);
          rightDmg = 0;
        } else {
          leftDmg = 0;
          rightDmg = Math.floor(damage);
        }
      }
    }

    return {
      voteCounts: counts,
      maxVotes: max,
      totalVotes: total,
      votersBySubmission: voters,
      leftDamage: leftDmg,
      rightDamage: rightDmg,
    };
  }, [currentVotes, currentSubmissions, game.players, game.currentRound]);

  // Get battlers with all info
  const battlers = useMemo(() => {
    // Check if it's a tie first
    const voteCountsList = currentSubmissions.map((sub) => voteCounts[sub._id as string] || 0);
    const isTie = voteCountsList.length === 2 && voteCountsList[0] === voteCountsList[1];

    return currentSubmissions.map((sub, index) => {
      const player = game.players.find((p) => p._id === sub.playerId);
      const voteCount = voteCounts[sub._id as string] || 0;
      // Only mark as winner if NOT a tie and has max votes
      const isWinner = !isTie && isReveal && totalVotes > 0 && voteCount === maxVotes && voteCount > 0;
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
        submissionTime: leftBattler._creationTime,
        winStreak: leftBattler.player?.winStreak,
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
        submissionTime: rightBattler._creationTime,
        winStreak: rightBattler.player?.winStreak,
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

  // Watch for corner man assignments reactively (rounds 1 and 2 only)
  useEffect(() => {
    console.log("[CORNER MAN CHECK] Effect triggered", {
      currentRound: game.currentRound,
      roundStatus: game.roundStatus,
      promptId: game.currentPromptId,
    });

    if (game.currentRound !== 1 && game.currentRound !== 2) {
      console.log("[CORNER MAN CHECK] Skipping - not round 1 or 2");
      return;
    }

    // Check ALL players for new corner man assignments
    console.log("[CORNER MAN CHECK] All players roles:", game.players.map(p => ({
      name: p.name,
      role: p.role,
      teamId: p.teamId,
      hp: p.hp,
      knockedOut: p.knockedOut,
      winStreak: p.winStreak,
    })));

    // Check for COMBO KO (3 straight wins triggers instant KO)
    game.players.forEach(p => {
      if (p.knockedOut && (p.winStreak || 0) >= 3) {
        console.log(`%c[COMBO KO!!!] ${p.name} achieved a 3-win combo and got instant KO!`, 'color: red; font-weight: bold; font-size: 16px');
      }
    });

    // Find any player who just became a corner man and hasn't been shown yet
    const newCornerMan = game.players.find(
      (p) => p.role === "CORNER_MAN" && p.teamId && !shownCornerManRef.current.has(p._id)
    );

    if (newCornerMan) {
      const champ = game.players.find((p) => p._id === newCornerMan.teamId);

      console.log("[CORNER MAN DETECTED]", newCornerMan.name, "supporting", champ?.name);

      if (champ) {
        console.log("[CORNER MAN ANIMATION] Showing animation for:", newCornerMan.name, "→", champ.name);

        // Mark this player as shown
        shownCornerManRef.current.add(newCornerMan._id);

        setCornerManAssignment({
          cornerManName: newCornerMan.name,
          cornerManAvatar: newCornerMan.avatar,
          champName: champ.name,
          champAvatar: champ.avatar,
        });
        // Show immediately
        setShowCornerManAssignment(true);
      }
    } else {
      console.log("[CORNER MAN CHECK] No new corner man assignments detected");
    }
  }, [game.currentRound, game.roundStatus, game.players, game.currentPromptId]);

  // Callbacks
  const handleBattleComplete = useCallback(() => {
    console.log("[BATTLE COMPLETE] Marking battle as complete, round:", game.currentRound);
    setBattleComplete(true);
  }, [game.currentRound]);

  const handleDamageApplied = useCallback((side: BattleSide, damage: number) => {
    // Update local animated HP immediately for visual feedback
    if (side === "left") {
      setAnimatedLeftHp((prev) => Math.max(0, (prev ?? 100) - damage));
      if (damage > 0) {
        setLeftShowDamage(damage);
        // Clear damage display after animation completes
        setTimeout(() => setLeftShowDamage(undefined), 600);
      }
    } else {
      setAnimatedRightHp((prev) => Math.max(0, (prev ?? 100) - damage));
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
    hasInitializedHp.current = false;
    // Clear damage displays
    setLeftShowDamage(undefined);
    setRightShowDamage(undefined);
    // DON'T clear corner man assignment - it has its own timer and will hide itself
    // Re-initialize HP from current player data
    if (leftBattler?.player && rightBattler?.player) {
      setAnimatedLeftHp(leftBattler.player.hp ?? 100);
      setAnimatedRightHp(rightBattler.player.hp ?? 100);
      hasInitializedHp.current = true;
    }
  }, [game.currentPromptId, leftBattler?.player, rightBattler?.player]);

  // Reset corner man tracking when round changes
  useEffect(() => {
    console.log("[ROUND CHANGE] Clearing shown corner man tracking. New round:", game.currentRound);
    shownCornerManRef.current.clear();
  }, [game.currentRound]);

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
              hp={animatedLeftHp ?? leftBattler.player.hp ?? 0}
              maxHp={leftBattler.player.maxHp || 100}
              side="left"
              isWinner={battleComplete && leftBattler.isWinner}
              avatar={leftBattler.player.avatar}
              showDamage={leftShowDamage}
              winStreak={leftBattler.player.winStreak}
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
              showDamage={rightShowDamage}
              winStreak={rightBattler.player.winStreak}
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
          leftDamage={leftDamage}
          rightDamage={rightDamage}
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

      {/* Corner Man Assignment - Shows when a player gets KO'd and becomes a corner man */}
      {showCornerManAssignment && cornerManAssignment && (
        <CornerManAssignment
          cornerManName={cornerManAssignment.cornerManName}
          cornerManAvatar={cornerManAssignment.cornerManAvatar}
          champName={cornerManAssignment.champName}
          champAvatar={cornerManAssignment.champAvatar}
          onComplete={() => setShowCornerManAssignment(false)}
        />
      )}

      {/* Round 4 Writing Indicator - Shows during PROMPTS phase in Round 4 */}
      {showWritingIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="bg-black/80 px-12 py-8 rounded-2xl border-2 border-yellow-400">
            <div className="text-4xl md:text-5xl font-bold text-yellow-400 mb-3 text-center animate-pulse">
              Players Writing Answers...
            </div>
            <div className="text-xl text-gray-300 text-center">
              Sudden Death continues when answers are submitted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
