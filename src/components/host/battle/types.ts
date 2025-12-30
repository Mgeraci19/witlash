import { BattleSide } from "../animations/registry/types";
import { FighterState } from "../AvatarFighter";

export interface BattlerInfo {
  id: string;
  name: string;
  avatar?: string;
  answer: string;
  voteCount: number;
  isWinner: boolean;
  voters: string[];
  hp: number;
  maxHp: number;
}

export type RevealPhase =
  | "waiting"       // Waiting for data
  | "question"      // Question animating in
  | "avatars_push"  // Avatars pushing to sides
  | "slam1"         // First answer slamming in
  | "slam2"         // Second answer slamming in
  | "voting"        // Players voting
  | "sliding"       // Answers sliding to bottom corners
  | "revealing"     // Vote counts ticking up
  | "attacking"     // Attack animation
  | "complete";     // Done

export interface BattleArenaProps {
  leftBattler: BattlerInfo | null;
  rightBattler: BattlerInfo | null;
  isReveal: boolean;
  promptId?: string;
  promptText?: string;
  onBattleComplete?: () => void;
  onDamageApplied?: (side: BattleSide, damage: number) => void;
}

export interface BattleRefs {
  arena: React.RefObject<HTMLDivElement | null>;
  question: React.RefObject<HTMLDivElement | null>;
  leftFighter: React.RefObject<HTMLDivElement | null>;
  rightFighter: React.RefObject<HTMLDivElement | null>;
  answer1: React.RefObject<HTMLDivElement | null>;
  answer2: React.RefObject<HTMLDivElement | null>;
  vsBadge: React.RefObject<HTMLDivElement | null>;
}

export interface BattleState {
  phase: RevealPhase;
  displayedVotes: { left: number; right: number };
  tieMessage: string | null;
  leftFighterState: FighterState;
  rightFighterState: FighterState;
  answerOrder: { first: "left" | "right"; second: "left" | "right" };
}

export interface BattleActions {
  setPhase: (phase: RevealPhase) => void;
  setDisplayedVotes: (votes: { left: number; right: number }) => void;
  setTieMessage: (message: string | null) => void;
  setLeftFighterState: (state: FighterState) => void;
  setRightFighterState: (state: FighterState) => void;
  reset: () => void;
}

// Derived state helpers
export function getVisibilityFlags(phase: RevealPhase) {
  return {
    showVotes: phase === "revealing" || phase === "attacking" || phase === "complete",
    showWinner: phase === "attacking" || phase === "complete",
    showAuthors: phase === "sliding" || phase === "revealing" || phase === "attacking" || phase === "complete",
  };
}
