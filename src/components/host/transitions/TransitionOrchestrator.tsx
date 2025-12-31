"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const completedRef = useRef(false);

  // Reset completed flag when a new transition activates
  useEffect(() => {
    if (activeTransition) {
      completedRef.current = false;
    }
  }, [activeTransition]);

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

  // Handle transition completion - uses requestAnimationFrame to safely defer state update
  const handleTransitionComplete = useCallback(() => {
    // Guard against double-completion
    if (completedRef.current) {
      console.log(`[TransitionOrchestrator] Ignoring duplicate completion`);
      return;
    }
    completedRef.current = true;

    console.log(`[TransitionOrchestrator] Transition complete requested`);

    // Use double requestAnimationFrame to ensure we're fully out of React's render cycle
    // This prevents "Cannot update a component while rendering a different component" errors
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setActiveTransition(null);
      });
    });
  }, []);

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
