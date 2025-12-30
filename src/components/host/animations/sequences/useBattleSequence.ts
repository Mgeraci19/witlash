"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { gsap } from "../gsapConfig";
import { BattleSequencer, BattleSequenceConfig } from "./BattleSequencer";
import {
  AnimationTarget,
  BattleSide,
  BattleResult,
} from "../registry/types";

// Import and register all animations on first use
import { registerAllAttacks } from "../attacks";
import { registerAllEffects } from "../effects";

let animationsRegistered = false;

function ensureAnimationsRegistered(): void {
  if (animationsRegistered) return;
  registerAllAttacks();
  registerAllEffects();
  animationsRegistered = true;
  console.log("[useBattleSequence] All animations registered");
}

/**
 * State returned by the hook
 */
export interface BattleSequenceState {
  /** Whether a battle sequence is currently playing */
  isPlaying: boolean;
  /** Current phase of the sequence */
  phase: "idle" | "attacking" | "impact" | "ko" | "victory" | "complete";
  /** The timeline instance (for advanced control) */
  timeline: gsap.core.Timeline | null;
}

/**
 * Actions returned by the hook
 */
export interface BattleSequenceActions {
  /** Start a battle sequence */
  playBattle: (result: BattleResult) => void;
  /** Play a combo sequence (multiple hits) */
  playCombo: (result: BattleResult, hitCount?: number) => void;
  /** Pause the current sequence */
  pause: () => void;
  /** Resume a paused sequence */
  resume: () => void;
  /** Stop and reset the current sequence */
  stop: () => void;
  /** Update sequencer configuration */
  updateConfig: (config: Partial<BattleSequenceConfig>) => void;
}

/**
 * Props for the useBattleSequence hook
 */
export interface UseBattleSequenceProps {
  /** Ref to the left fighter element */
  leftFighter: AnimationTarget;
  /** Ref to the right fighter element */
  rightFighter: AnimationTarget;
  /** Ref to the arena container element */
  arenaContainer: AnimationTarget;
  /** Initial configuration */
  config?: BattleSequenceConfig;
  /** Callback when damage should be applied to a fighter */
  onDamageApplied?: (side: BattleSide, damage: number) => void;
  /** Callback when sequence completes */
  onSequenceComplete?: () => void;
  /** Callback when phase changes */
  onPhaseChange?: (phase: BattleSequenceState["phase"]) => void;
}

/**
 * React hook for managing battle animation sequences
 *
 * Usage:
 * ```tsx
 * function BattleArena() {
 *   const leftRef = useRef<HTMLDivElement>(null);
 *   const rightRef = useRef<HTMLDivElement>(null);
 *   const arenaRef = useRef<HTMLDivElement>(null);
 *
 *   const { state, actions } = useBattleSequence({
 *     leftFighter: leftRef,
 *     rightFighter: rightRef,
 *     arenaContainer: arenaRef,
 *     onDamageApplied: (side, damage) => {
 *       // Update HP state
 *     },
 *   });
 *
 *   // Trigger battle when vote results come in
 *   useEffect(() => {
 *     if (voteResult) {
 *       actions.playBattle({
 *         winnerId: voteResult.winnerId,
 *         winnerSide: voteResult.winnerSide,
 *         loserId: voteResult.loserId,
 *         loserSide: voteResult.loserSide,
 *         damage: voteResult.votes * 5,
 *         isKO: voteResult.isKnockout,
 *         voteCount: voteResult.votes,
 *       });
 *     }
 *   }, [voteResult]);
 *
 *   return (
 *     <div ref={arenaRef}>
 *       <Fighter ref={leftRef} />
 *       <Fighter ref={rightRef} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useBattleSequence(
  props: UseBattleSequenceProps
): { state: BattleSequenceState; actions: BattleSequenceActions } {
  const {
    leftFighter,
    rightFighter,
    arenaContainer,
    config,
    onDamageApplied,
    onSequenceComplete,
    onPhaseChange,
  } = props;

  // Ensure animations are registered
  useEffect(() => {
    ensureAnimationsRegistered();
  }, []);

  const [state, setState] = useState<BattleSequenceState>({
    isPlaying: false,
    phase: "idle",
    timeline: null,
  });

  const sequencerRef = useRef<BattleSequencer | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // Initialize sequencer
  useEffect(() => {
    sequencerRef.current = new BattleSequencer(config);
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  // Update config when it changes
  useEffect(() => {
    if (config && sequencerRef.current) {
      sequencerRef.current.setConfig(config);
    }
  }, [config]);

  const setPhase = useCallback(
    (phase: BattleSequenceState["phase"]) => {
      setState((prev) => ({ ...prev, phase }));
      onPhaseChange?.(phase);
    },
    [onPhaseChange]
  );

  const playBattle = useCallback(
    (result: BattleResult) => {
      if (!sequencerRef.current) return;

      // Kill any existing timeline
      timelineRef.current?.kill();

      setPhase("attacking");
      setState((prev) => ({ ...prev, isPlaying: true }));

      const timeline = sequencerRef.current.createBattleSequence({
        leftFighter,
        rightFighter,
        arenaContainer,
        result,
        onDamageApplied: (side, damage) => {
          setPhase("impact");
          onDamageApplied?.(side, damage);
        },
        onSequenceComplete: () => {
          setPhase("complete");
          setState((prev) => ({ ...prev, isPlaying: false }));
          onSequenceComplete?.();
        },
      });

      timelineRef.current = timeline;
      setState((prev) => ({ ...prev, timeline }));

      // Set phase to victory or complete based on KO
      if (result.isKO) {
        // Add phase markers to timeline
        timeline.call(() => setPhase("ko"), [], result.damage > 0 ? 0.5 : 0);
        timeline.call(() => setPhase("victory"), [], "+=1");
      }
    },
    [
      leftFighter,
      rightFighter,
      arenaContainer,
      onDamageApplied,
      onSequenceComplete,
      setPhase,
    ]
  );

  const playCombo = useCallback(
    (result: BattleResult, hitCount: number = 3) => {
      if (!sequencerRef.current) return;

      timelineRef.current?.kill();

      setPhase("attacking");
      setState((prev) => ({ ...prev, isPlaying: true }));

      const timeline = sequencerRef.current.createComboSequence(
        {
          leftFighter,
          rightFighter,
          arenaContainer,
          result,
          onDamageApplied: (side, damage) => {
            onDamageApplied?.(side, damage);
          },
          onSequenceComplete: () => {
            setPhase("complete");
            setState((prev) => ({ ...prev, isPlaying: false }));
            onSequenceComplete?.();
          },
        },
        hitCount
      );

      timelineRef.current = timeline;
      setState((prev) => ({ ...prev, timeline }));
    },
    [
      leftFighter,
      rightFighter,
      arenaContainer,
      onDamageApplied,
      onSequenceComplete,
      setPhase,
    ]
  );

  const pause = useCallback(() => {
    timelineRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    timelineRef.current?.resume();
  }, []);

  const stop = useCallback(() => {
    timelineRef.current?.kill();
    timelineRef.current = null;
    setState({
      isPlaying: false,
      phase: "idle",
      timeline: null,
    });
  }, []);

  const updateConfig = useCallback((newConfig: Partial<BattleSequenceConfig>) => {
    sequencerRef.current?.setConfig(newConfig);
  }, []);

  return {
    state,
    actions: {
      playBattle,
      playCombo,
      pause,
      resume,
      stop,
      updateConfig,
    },
  };
}
