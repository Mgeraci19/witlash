import { gsap } from "../gsapConfig";
import { animationRegistry } from "../registry";
import {
  AnimationContext,
  AnimationOptions,
  AnimationTarget,
  BattleSide,
  BattleResult,
  BattleSequenceProps,
} from "../registry/types";

/**
 * Resolves an animation target to a DOM element
 */
function resolveTarget(target: AnimationTarget): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (typeof target === "string") return document.querySelector(target);
  if ("current" in target) return target.current;
  return null;
}

/**
 * Configuration for the battle sequence
 */
export interface BattleSequenceConfig {
  /** Speed multiplier (from round theme) */
  speedMultiplier?: number;
  /** Shake intensity (from round theme) */
  shakeIntensity?: number;
  /** Whether to use dramatic KO for final rounds */
  useDramaticKO?: boolean;
  /** Specific attack animation ID to use (random if not specified) */
  attackId?: string;
}

/**
 * BattleSequencer - Orchestrates complete battle animation sequences
 *
 * Handles the full flow:
 * 1. Idle state
 * 2. Attack animation
 * 3. Impact effect (POW!, starburst)
 * 4. Damage number display
 * 5. HP drain effect
 * 6. KO animation (if applicable)
 * 7. Victory pose (winner)
 *
 * Usage:
 * ```ts
 * const sequencer = new BattleSequencer();
 * const timeline = sequencer.createBattleSequence({
 *   leftFighter: leftRef,
 *   rightFighter: rightRef,
 *   arenaContainer: arenaRef,
 *   result: {
 *     winnerId: "player1",
 *     winnerSide: "left",
 *     loserId: "player2",
 *     loserSide: "right",
 *     damage: 15,
 *     isKO: false,
 *     voteCount: 3
 *   },
 *   onDamageApplied: (side, damage) => { ... }
 * });
 *
 * timeline.play();
 * ```
 */
export class BattleSequencer {
  private config: BattleSequenceConfig;

  constructor(config: BattleSequenceConfig = {}) {
    this.config = {
      speedMultiplier: 1,
      shakeIntensity: 1,
      useDramaticKO: false,
      ...config,
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<BattleSequenceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create the complete battle sequence timeline
   */
  createBattleSequence(props: BattleSequenceProps): gsap.core.Timeline {
    const {
      leftFighter,
      rightFighter,
      arenaContainer,
      result,
      onSequenceComplete,
      onDamageApplied,
    } = props;

    const masterTimeline = gsap.timeline({
      onComplete: () => {
        console.log("[BattleSequencer] Sequence complete");
        onSequenceComplete?.();
      },
    });

    // Determine attacker/defender based on result
    const attackerEl = result.winnerSide === "left" ? leftFighter : rightFighter;
    const defenderEl = result.winnerSide === "left" ? rightFighter : leftFighter;

    // Base context for all animations
    const baseContext: AnimationContext = {
      attacker: attackerEl,
      defender: defenderEl,
      attackerSide: result.winnerSide,
      arenaContainer,
      speedMultiplier: this.config.speedMultiplier,
      shakeIntensity: this.config.shakeIntensity,
    };

    // Step 1: Get attack animation
    const attack = this.config.attackId
      ? animationRegistry.get(this.config.attackId)
      : animationRegistry.getRandomAttack();

    if (!attack) {
      console.warn("[BattleSequencer] No attack animation found, using basic movement");
      // Fallback: simple lunge
      this.addBasicAttack(masterTimeline, baseContext);
    } else {
      // Add the attack animation with impact callback
      const attackTimeline = attack.create(
        {
          ...baseContext,
          onImpact: () => {
            // Trigger impact effects in parallel
            this.triggerImpactEffects(baseContext, result);
          },
        },
        { damage: result.damage }
      );

      masterTimeline.add(attackTimeline, "attack");
    }

    // Step 2: Add damage display (overlaps with attack recovery)
    const damageDelay = attack ? attack.duration * 0.4 : 0.2;
    masterTimeline.call(
      () => {
        onDamageApplied?.(result.loserSide, result.damage);
      },
      [],
      damageDelay
    );

    // Step 3: If KO, add KO sequence
    if (result.isKO) {
      masterTimeline.add(
        this.createKOSequence(baseContext, result),
        "+=0.2"
      );
    }

    return masterTimeline;
  }

  /**
   * Trigger impact effects (called at moment of impact)
   */
  private triggerImpactEffects(
    context: AnimationContext,
    result: BattleResult
  ): void {
    // Impact burst ("POW!" text)
    const impactBurst = animationRegistry.get("impact-burst");
    if (impactBurst) {
      impactBurst.create(context);
    }

    // Starburst effect
    const starburst = animationRegistry.get("starburst");
    if (starburst) {
      starburst.create(context);
    }

    // Flash for heavy hits
    if (result.damage >= 15) {
      const flash = animationRegistry.get("flash");
      if (flash) {
        flash.create(context);
      }
    }

    // Damage number
    const damageNumber = animationRegistry.get("damage-number");
    if (damageNumber) {
      damageNumber.create(context, { damage: result.damage });
    }
  }

  /**
   * Create KO animation sequence
   */
  private createKOSequence(
    context: AnimationContext,
    result: BattleResult
  ): gsap.core.Timeline {
    // Choose KO animation based on config
    const koId = this.config.useDramaticKO ? "dramatic-ko" : "ko";
    const koAnimation = animationRegistry.get(koId);

    if (koAnimation) {
      return koAnimation.create(context, { damage: result.damage });
    }

    // Fallback: basic KO
    return this.createBasicKO(context);
  }

  /**
   * Fallback basic attack animation
   */
  private addBasicAttack(
    timeline: gsap.core.Timeline,
    context: AnimationContext
  ): void {
    const attackerEl = resolveTarget(context.attacker);
    const defenderEl = resolveTarget(context.defender);
    const direction = context.attackerSide === "left" ? 1 : -1;

    if (!attackerEl) return;

    // Simple lunge
    timeline.to(attackerEl, {
      x: 100 * direction,
      duration: 0.2,
      ease: "power3.out",
    });

    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          x: 20 * direction,
          duration: 0.1,
        },
        "-=0.1"
      );
      timeline.to(defenderEl, {
        x: 0,
        duration: 0.15,
      });
    }

    timeline.to(attackerEl, {
      x: 0,
      duration: 0.25,
      ease: "power2.out",
    });
  }

  /**
   * Fallback basic KO animation
   */
  private createBasicKO(context: AnimationContext): gsap.core.Timeline {
    const timeline = gsap.timeline();
    const loserEl = resolveTarget(context.defender);
    const direction = context.attackerSide === "left" ? 1 : -1;

    if (!loserEl) return timeline;

    timeline.to(loserEl, {
      x: 500 * direction,
      rotation: 360 * direction,
      opacity: 0,
      duration: 0.8,
      ease: "power2.in",
    });

    return timeline;
  }

  /**
   * Create a multi-hit combo sequence
   */
  createComboSequence(
    props: BattleSequenceProps,
    hitCount: number = 3
  ): gsap.core.Timeline {
    const {
      leftFighter,
      rightFighter,
      arenaContainer,
      result,
      onSequenceComplete,
      onDamageApplied,
    } = props;

    const masterTimeline = gsap.timeline({
      onComplete: onSequenceComplete,
    });

    const attackerEl = result.winnerSide === "left" ? leftFighter : rightFighter;
    const defenderEl = result.winnerSide === "left" ? rightFighter : leftFighter;
    const damagePerHit = Math.ceil(result.damage / hitCount);

    const baseContext: AnimationContext = {
      attacker: attackerEl,
      defender: defenderEl,
      attackerSide: result.winnerSide,
      arenaContainer,
      speedMultiplier: this.config.speedMultiplier,
      shakeIntensity: this.config.shakeIntensity,
    };

    // Get available attacks for variety
    const attacks = animationRegistry.getByCategory("attack");

    // Create combo hits
    for (let i = 0; i < hitCount; i++) {
      const attack = attacks[i % attacks.length] || animationRegistry.getRandomAttack();
      const isLastHit = i === hitCount - 1;

      if (attack) {
        const hitContext: AnimationContext = {
          ...baseContext,
          onImpact: () => {
            // Smaller impact for combo hits
            const impactBurst = animationRegistry.get("impact-burst");
            if (impactBurst) {
              impactBurst.create(baseContext);
            }
          },
        };

        const attackTimeline = attack.create(hitContext, {
          damage: damagePerHit,
        });

        masterTimeline.add(attackTimeline, i === 0 ? 0 : "-=0.1");

        // Report damage for each hit
        masterTimeline.call(
          () => {
            onDamageApplied?.(result.loserSide, damagePerHit);
          },
          [],
          "-=0.2"
        );

        // Add KO on last hit if applicable
        if (isLastHit && result.isKO) {
          masterTimeline.add(
            this.createKOSequence(baseContext, result),
            "+=0.1"
          );
        }
      }
    }

    return masterTimeline;
  }
}

// Default instance for easy use
export const battleSequencer = new BattleSequencer();
