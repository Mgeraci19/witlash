import { gsap } from "../../animations/gsapConfig";
import { BattleActions } from "../types";

interface VoteRevealOptions {
  leftVotes: number;
  rightVotes: number;
  setDisplayedVotes: BattleActions["setDisplayedVotes"];
}

/**
 * addVoteRevealToTimeline - Adds vote tick-up animation to a timeline
 *
 * Votes tick up from 0 to final count, synchronized between both sides.
 */
export function addVoteRevealToTimeline(
  timeline: gsap.core.Timeline,
  { leftVotes, rightVotes, setDisplayedVotes }: VoteRevealOptions
): void {
  const maxVotes = Math.max(leftVotes, rightVotes, 1);
  const tickDuration = 0.6 / maxVotes;

  for (let i = 1; i <= maxVotes; i++) {
    timeline.call(() => {
      setDisplayedVotes({
        left: Math.min(i, leftVotes),
        right: Math.min(i, rightVotes),
      });
    }, [], `+=${tickDuration}`);
  }
}
