import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition, BattleSide } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";
import {
  createParticleDissolve,
  createMagicCircle,
  createEnergyProjectile,
  createImpactExplosion,
  createScreenShake,
  createFlashOverlay,
} from "../effects/visualEffects";

/**
 * Helper to determine winner and get common attack data
 */
function getAttackData(context: Parameters<AnimationDefinition["create"]>[0]) {
  const leftBattler = context.getLeftBattler?.() ?? context.leftBattler;
  const rightBattler = context.getRightBattler?.() ?? context.rightBattler;
  const leftDamage = context.getLeftDamage?.() ?? context.leftDamage;
  const rightDamage = context.getRightDamage?.() ?? context.rightDamage;

  let winnerIsLeft: boolean;
  if (leftBattler?.isWinner) {
    winnerIsLeft = true;
  } else if (rightBattler?.isWinner) {
    winnerIsLeft = false;
  } else {
    const leftVotes = leftBattler?.voteCount || 0;
    const rightVotes = rightBattler?.voteCount || 0;
    winnerIsLeft = leftVotes > rightVotes;
  }

  const damage = winnerIsLeft ? rightDamage : leftDamage;
  const direction = winnerIsLeft ? 1 : -1;
  const winnerRef = winnerIsLeft
    ? context.refs.leftFighter
    : context.refs.rightFighter;
  const loserRef = winnerIsLeft
    ? context.refs.rightFighter
    : context.refs.leftFighter;
  const loserSide: BattleSide = winnerIsLeft ? "right" : "left";
  const winnerSide: BattleSide = winnerIsLeft ? "left" : "right";
  const winner = winnerIsLeft ? leftBattler : rightBattler;
  const loser = winnerIsLeft ? rightBattler : leftBattler;

  return {
    winnerIsLeft,
    damage,
    direction,
    winnerRef,
    loserRef,
    loserSide,
    winnerSide,
    winner,
    loser,
  };
}

/**
 * attack-finisher-spell - Magic spell, loser dissolves to particles
 *
 * Flow:
 * 1. Show "SPECIAL K.O.!" message
 * 2. Winner raises up (casting pose) (0.3s)
 * 3. Magic circle appears around loser (0.3s)
 * 4. Loser dissolves into particles (1.2s)
 * 5. Winner returns to idle (0.2s)
 * 6. Hold for dramatic effect (1.5s)
 *
 * Total duration: 4.0s
 */
export const attackFinisherSpellAnimation: AnimationDefinition = {
  id: "attack-finisher-spell",
  name: "Spell Finisher",
  category: "effect",
  duration: 4.0,
  canRunInParallel: false,
  priority: 20,
  tags: ["attack", "ko", "finisher", "special"],

  create: (context) => {
    const { direction: _direction, winnerRef, loserRef, loserSide, winnerSide, damage, winner, loser: _loser } =
      getAttackData(context);
    const arenaRef = context.refs.arena;

    console.log(`[SPELL FINISHER TRIGGERED!] ${winner?.name} casts the finishing spell!`);

    // Show SPECIAL K.O.! message
    context.setTieMessage?.("SPECIAL K.O.!");
    context.setFighterState?.(winnerSide, "attacking");

    const timeline = gsap.timeline({
      onComplete: () => {
        context.setTieMessage?.(null);
        context.setFighterState?.(loserSide, "ko");
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Hold message for dramatic effect
    timeline.to({}, { duration: 0.5 });

    // Winner raises up (casting pose)
    timeline.to(winnerRef.current, {
      y: -30,
      scale: 1.1,
      duration: 0.3,
      ease: "power2.out",
    });

    // Create magic circle around loser
    timeline.call(() => {
      const circleResult = createMagicCircle(
        loserRef.current,
        arenaRef.current,
        {
          size: 180,
          duration: 0.3,
          color: "#8B5CF6",
        }
      );

      // Apply damage
      console.log(`[attackFinisherSpellAnimation] Applying ${damage} damage to ${loserSide}`);
      context.setFighterState?.(loserSide, "hurt");
      context.onDamageApplied?.(loserSide, damage);

      // Clean up circle after dissolve
      if (circleResult) {
        gsap.to(circleResult.element, {
          opacity: 0,
          scale: 1.5,
          duration: 0.5,
          delay: 1.0,
          onComplete: () => circleResult.element.remove(),
        });
      }
    });

    // Pause for circle effect
    timeline.to({}, { duration: 0.4 });

    // Loser dissolves into particles
    timeline.call(() => {
      createParticleDissolve(loserRef.current, arenaRef.current, {
        particleCount: 25,
        duration: 1.2,
        color: "#A78BFA",
      });
    });

    // Fade out loser while particles scatter
    timeline.to(loserRef.current, {
      opacity: 0,
      scale: 0.5,
      duration: 1.0,
      ease: "power2.in",
    });

    // Winner returns to position
    timeline.to(winnerRef.current, {
      y: 0,
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
    });

    // Hold for dramatic effect
    timeline.to({}, { duration: 1.2 });

    return timeline;
  },
};

/**
 * attack-finisher-energy - Energy beam/fireball hits loser
 *
 * Flow:
 * 1. Show "SPECIAL K.O.!" message
 * 2. Winner pulls back (charging) (0.4s)
 * 3. Energy projectile fires toward loser (0.3s)
 * 4. Impact explosion on loser (0.2s)
 * 5. Loser blasts off screen (0.5s)
 * 6. Winner returns (0.2s)
 * 7. Hold (1.5s)
 *
 * Total duration: 4.0s
 */
export const attackFinisherEnergyAnimation: AnimationDefinition = {
  id: "attack-finisher-energy",
  name: "Energy Finisher",
  category: "effect",
  duration: 4.0,
  canRunInParallel: false,
  priority: 20,
  tags: ["attack", "ko", "finisher", "special"],

  create: (context) => {
    const { direction: _direction, winnerRef, loserRef, loserSide, winnerSide, damage, winner, loser: _loser } =
      getAttackData(context);
    const arenaRef = context.refs.arena;
    const arenaWidth = arenaRef.current?.clientWidth || 800;
    const offscreenDist = arenaWidth * 1.2;

    console.log(`[ENERGY FINISHER TRIGGERED!] ${winner?.name} fires the finishing blast!`);

    // Show SPECIAL K.O.! message
    context.setTieMessage?.("SPECIAL K.O.!");
    context.setFighterState?.(winnerSide, "attacking");

    const timeline = gsap.timeline({
      onComplete: () => {
        context.setTieMessage?.(null);
        context.setFighterState?.(loserSide, "ko");
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Hold message
    timeline.to({}, { duration: 0.4 });

    // Winner pulls back (charging)
    timeline.to(winnerRef.current, {
      x: direction * -50,
      scale: 1.15,
      duration: 0.4,
      ease: "power2.out",
    });

    // Add glow effect during charge
    timeline.call(() => {
      gsap.to(winnerRef.current, {
        filter: "brightness(1.3) drop-shadow(0 0 20px #F97316)",
        duration: 0.3,
      });
    }, [], "-=0.3");

    // Fire projectile
    timeline.call(() => {
      createEnergyProjectile(
        winnerRef.current,
        loserRef.current,
        arenaRef.current,
        {
          size: 50,
          duration: 0.3,
          color: "#F97316",
          trailCount: 6,
        }
      );
    });

    // Wait for projectile to hit
    timeline.to({}, { duration: 0.3 });

    // Impact explosion + damage
    timeline.call(() => {
      createImpactExplosion(loserRef.current, arenaRef.current, {
        size: 180,
        duration: 0.3,
        color: "#FBBF24",
      });
      createScreenShake(arenaRef.current, { intensity: 15, duration: 0.4 });
      createFlashOverlay(arenaRef.current, { color: "#FBBF24", duration: 0.2 });

      console.log(`[attackFinisherEnergyAnimation] Applying ${damage} damage to ${loserSide}`);
      context.setFighterState?.(loserSide, "hurt");
      context.onDamageApplied?.(loserSide, damage);

      // Remove glow from winner
      gsap.to(winnerRef.current, {
        filter: "none",
        duration: 0.2,
      });
    });

    // Pause for impact
    timeline.to({}, { duration: 0.2 });

    // Loser blasts off screen
    timeline.to(loserRef.current, {
      x: direction * offscreenDist,
      rotation: direction * 720,
      opacity: 0,
      scale: 0.6,
      duration: 0.5,
      ease: "power3.in",
    });

    // Winner returns
    timeline.to(winnerRef.current, {
      x: 0,
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
    }, "-=0.3");

    // Hold
    timeline.to({}, { duration: 1.3 });

    return timeline;
  },
};

/**
 * attack-finisher-punch - Extended punch sends loser flying with impact
 *
 * Flow:
 * 1. Show "SPECIAL K.O.!" message
 * 2. Winner dashes forward fast (0.15s)
 * 3. Dramatic impact (screen shake, flash)
 * 4. Loser rockets offscreen with spin (0.6s)
 * 5. Winner returns (0.3s)
 * 6. Hold (1.5s)
 *
 * Total duration: 3.5s
 */
export const attackFinisherPunchAnimation: AnimationDefinition = {
  id: "attack-finisher-punch",
  name: "Punch Finisher",
  category: "effect",
  duration: 3.5,
  canRunInParallel: false,
  priority: 20,
  tags: ["attack", "ko", "finisher", "special"],

  create: (context) => {
    const { direction: _direction, winnerRef, loserRef, loserSide, winnerSide, damage, winner, loser: _loser } =
      getAttackData(context);
    const arenaRef = context.refs.arena;
    const arenaWidth = arenaRef.current?.clientWidth || 800;
    const offscreenDist = arenaWidth * 1.3;

    console.log(`[PUNCH FINISHER TRIGGERED!] ${winner?.name} delivers the finishing blow!`);

    // Show SPECIAL K.O.! message
    context.setTieMessage?.("SPECIAL K.O.!");
    context.setFighterState?.(winnerSide, "attacking");

    const timeline = gsap.timeline({
      onComplete: () => {
        context.setTieMessage?.(null);
        context.setFighterState?.(loserSide, "ko");
        context.setPhase?.("complete");
        context.onComplete?.();
      },
    });

    // Hold message
    timeline.to({}, { duration: 0.4 });

    // Wind up
    timeline.to(winnerRef.current, {
      x: direction * -40,
      scale: 1.05,
      duration: 0.15,
      ease: "power2.out",
    });

    // Super fast dash forward
    timeline.to(winnerRef.current, {
      x: direction * 180,
      scale: 1.2,
      duration: 0.12,
      ease: "power4.in",
    });

    // Impact effects + damage
    timeline.call(() => {
      createScreenShake(arenaRef.current, { intensity: 20, duration: 0.5 });
      createFlashOverlay(arenaRef.current, { color: "white", duration: 0.15 });
      createImpactExplosion(loserRef.current, arenaRef.current, {
        size: 200,
        duration: 0.25,
        color: "#EF4444",
      });

      console.log(`[attackFinisherPunchAnimation] Applying ${damage} damage to ${loserSide}`);
      context.setFighterState?.(loserSide, "hurt");
      context.onDamageApplied?.(loserSide, damage);
    });

    // Brief pause for impact
    timeline.to({}, { duration: 0.08 });

    // Loser rockets offscreen with extra spin
    timeline.to(loserRef.current, {
      x: direction * offscreenDist,
      rotation: direction * 1080,
      opacity: 0,
      scale: 0.4,
      duration: 0.6,
      ease: "power2.in",
    });

    // Winner returns with power
    timeline.to(winnerRef.current, {
      x: direction * 50,
      scale: 1.0,
      duration: 0.15,
      ease: "power2.out",
    }, "-=0.4");

    timeline.to(winnerRef.current, {
      x: 0,
      duration: 0.25,
      ease: "elastic.out(1, 0.5)",
    });

    // Hold for dramatic effect
    timeline.to({}, { duration: 1.2 });

    return timeline;
  },
};

// Auto-register all finisher animations
animationRegistry.register(attackFinisherSpellAnimation);
animationRegistry.register(attackFinisherEnergyAnimation);
animationRegistry.register(attackFinisherPunchAnimation);
