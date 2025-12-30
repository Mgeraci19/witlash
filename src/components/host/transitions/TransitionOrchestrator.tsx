"use client";

import { useEffect, useRef, useState } from "react";
import { GameState } from "@/lib/types";
import { transitionRegistry } from "./transitionRegistry";
import { TransitionDefinition } from "./types";

interface TransitionOrchestratorProps {
  gameState: GameState;
}

/**
 * TransitionOrchestrator - Event-driven transition manager
 *
 * Watches for game state changes and renders appropriate transitions
 * based on registered trigger conditions.
 *
 * Transitions are completely decoupled from game logic - they're
 * registered via the transitionRegistry and triggered automatically.
 */
export function TransitionOrchestrator({ gameState }: TransitionOrchestratorProps) {
  const previousStateRef = useRef<GameState | null>(null);
  const [activeTransition, setActiveTransition] = useState<TransitionDefinition | null>(null);

  // Detect state changes and trigger matching transitions
  useEffect(() => {
    const prevState = previousStateRef.current;
    const currentState = gameState;

    // Only check for transitions if we have a previous state (not initial load)
    if (prevState !== null) {
      const matchingTransition = transitionRegistry.findMatchingTransition(
        prevState,
        currentState
      );

      if (matchingTransition && matchingTransition !== activeTransition) {
        console.log(
          `[TransitionOrchestrator] Activating transition: ${matchingTransition.id}`
        );
        setActiveTransition(matchingTransition);
      }
    }

    // Update previous state reference
    previousStateRef.current = currentState;
  }, [gameState, activeTransition]);

  // Handle transition completion
  const handleTransitionComplete = () => {
    console.log(
      `[TransitionOrchestrator] Transition complete: ${activeTransition?.id}`
    );
    setActiveTransition(null);
  };

  // Render active transition
  if (activeTransition) {
    const TransitionComponent = activeTransition.component;
    return (
      <TransitionComponent
        gameState={gameState}
        onComplete={handleTransitionComplete}
      />
    );
  }

  return null;
}
