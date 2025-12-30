# Animation System Guide

This document explains how to update existing animations and create new ones. Designed for LLM-assisted development.

## Architecture Overview

```
animations/
├── registry/
│   ├── types.ts          # Core interfaces (AnimationDefinition, AnimationContext)
│   └── index.ts           # Singleton registry for all animations
├── attacks/
│   ├── index.ts           # Exports + registration function
│   ├── punch.ts           # Punch animations
│   ├── kick.ts            # Kick animations
│   ├── slam.ts            # Slam animations
│   └── uppercut.ts        # Uppercut animations
├── effects/
│   ├── index.ts           # Exports + registration function
│   ├── impact.ts          # "POW!" burst effects
│   ├── damage.ts          # Floating damage numbers
│   └── ko.ts              # Knockout animations
└── sequences/
    ├── BattleSequencer.ts # Orchestrates attack → impact → damage → ko
    └── useBattleSequence.ts # React hook for components
```

## Key Interfaces

```typescript
interface AnimationDefinition {
  id: string;                    // Unique ID (e.g., "punch", "heavy-kick")
  name: string;                  // Display name
  category: "attack" | "effect"; // Used for filtering
  duration: number;              // Base duration in seconds
  create: (context, options?) => gsap.core.Timeline;
}

interface AnimationContext {
  attacker: AnimationTarget;     // Attacker DOM element/ref
  defender: AnimationTarget;     // Defender DOM element/ref
  attackerSide: "left" | "right"; // Direction for animations
  arenaContainer?: AnimationTarget; // For screen shake
  onImpact?: () => void;         // Called at impact moment
  onComplete?: () => void;       // Called when animation ends
  speedMultiplier?: number;      // From round theme (default: 1)
  shakeIntensity?: number;       // From round theme (default: 1)
}
```

## Updating an Existing Animation

### Example: Make the punch lunge further

Edit `attacks/punch.ts`:

```typescript
// Find the lunge step in punchAnimation.create()
// Change:
const lungeDistance = 120;
// To:
const lungeDistance = 180;  // Increased from 120
```

### Example: Add screen shake to kick

Edit `attacks/kick.ts`, add shake in the impact section:

```typescript
timeline.call(() => {
  onImpact?.();

  // Add screen shake
  const arenaEl = resolveTarget(context.arenaContainer);
  if (arenaEl) {
    gsap.to(arenaEl, {
      x: 10 * shakeIntensity,
      duration: 0.04,
      yoyo: true,
      repeat: 3,
      onComplete: () => gsap.set(arenaEl, { x: 0 }),
    });
  }
});
```

### Example: Change timing

All durations should respect `speedMultiplier`:

```typescript
const speed = 1 / speedMultiplier;

timeline.to(attackerEl, {
  x: 100,
  duration: 0.2 * speed,  // Scales with speed setting
});
```

## Creating a New Animation

### Step 1: Create the animation file

Create `attacks/hadouken.ts`:

```typescript
import { gsap } from "../gsapConfig";
import {
  AnimationDefinition,
  AnimationContext,
  AnimationOptions,
} from "../registry/types";

/**
 * Resolves an animation target to a DOM element
 */
function resolveTarget(target: AnimationContext["attacker"] | undefined): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (typeof target === "string") return document.querySelector(target);
  if ("current" in target) return target.current;
  return null;
}

/**
 * Hadouken - projectile attack
 *
 * Sequence:
 * 1. Windup - hands together
 * 2. Launch - slight push forward
 * 3. Projectile travels (created dynamically)
 * 4. Impact on defender
 * 5. Recovery
 */
export const hadoukenAnimation: AnimationDefinition = {
  id: "hadouken",
  name: "Hadouken",
  category: "attack",
  duration: 1.0,

  create: (context: AnimationContext, options?: AnimationOptions) => {
    const {
      attacker,
      defender,
      attackerSide,
      arenaContainer,
      onImpact,
      speedMultiplier = 1,
      shakeIntensity = 1,
    } = context;

    const attackerEl = resolveTarget(attacker);
    const defenderEl = resolveTarget(defender);
    const arenaEl = resolveTarget(arenaContainer);

    const timeline = gsap.timeline({
      onComplete: context.onComplete,
    });

    if (!attackerEl) {
      console.warn("[hadoukenAnimation] No attacker element found");
      return timeline;
    }

    const direction = attackerSide === "left" ? 1 : -1;
    const speed = 1 / speedMultiplier;

    // Step 1: Windup - crouch and pull back
    timeline.to(attackerEl, {
      scaleY: 0.9,
      x: -20 * direction,
      duration: 0.2 * speed,
      ease: "power2.in",
    });

    // Step 2: Launch pose
    timeline.to(attackerEl, {
      scaleY: 1.05,
      x: 10 * direction,
      duration: 0.1 * speed,
      ease: "power3.out",
    });

    // Step 3: Create and animate projectile
    if (arenaEl) {
      const projectile = document.createElement("div");
      projectile.textContent = "🔥";
      projectile.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 3rem;
        z-index: 1000;
        opacity: 0;
      `;
      arenaEl.appendChild(projectile);

      // Start position near attacker
      timeline.set(projectile, {
        x: attackerSide === "left" ? -200 : 200,
        opacity: 1,
      });

      // Fly across
      timeline.to(projectile, {
        x: attackerSide === "left" ? 200 : -200,
        duration: 0.4 * speed,
        ease: "power1.in",
        onComplete: () => {
          onImpact?.();
          projectile.remove();
        },
      });
    } else {
      // No arena, just call impact
      timeline.call(() => onImpact?.(), [], "+=0.4");
    }

    // Defender recoil
    if (defenderEl) {
      timeline.to(
        defenderEl,
        {
          x: 30 * direction,
          duration: 0.1 * speed,
        },
        "-=0.1"
      );
      timeline.to(defenderEl, {
        x: 0,
        duration: 0.2 * speed,
      });
    }

    // Step 5: Recovery
    timeline.to(
      attackerEl,
      {
        scaleY: 1,
        x: 0,
        duration: 0.2 * speed,
        ease: "power2.out",
      },
      "-=0.2"
    );

    return timeline;
  },
};
```

### Step 2: Register the animation

Edit `attacks/index.ts`:

```typescript
// Add import
import { hadoukenAnimation } from "./hadouken";

// Add to attacks object
export const attacks = {
  // ... existing attacks
  hadouken: hadoukenAnimation,
} as const;

// Add to exports
export { hadoukenAnimation };
```

The animation is now automatically registered when `registerAllAttacks()` is called at app startup, and will be included in the random attack pool.

## Animation Pattern Guidelines

### 1. Always use the resolveTarget helper
Targets can be DOM elements, React refs, or CSS selectors.

### 2. Always respect speedMultiplier
```typescript
const speed = 1 / speedMultiplier;
timeline.to(el, { duration: 0.2 * speed });
```

### 3. Direction is based on attackerSide
```typescript
const direction = attackerSide === "left" ? 1 : -1;
// Positive x = move right, negative = move left
timeline.to(el, { x: 100 * direction });
```

### 4. Call onImpact at the hit moment
This triggers damage numbers, sound effects, and defender state changes.

### 5. Clean up dynamically created elements
```typescript
const el = document.createElement("div");
container.appendChild(el);
// ...
timeline.to(el, {
  onComplete: () => el.remove(),
});
```

### 6. Use GSAP timeline positioning
- `"<"` = start at same time as previous
- `"-=0.2"` = start 0.2s before previous ends
- `"+=0.1"` = start 0.1s after previous ends

### 7. Defend against missing elements
```typescript
if (!attackerEl) {
  console.warn("[myAnimation] No attacker element found");
  return gsap.timeline(); // Return empty timeline
}
```

## Common GSAP Properties

| Property | Description | Example |
|----------|-------------|---------|
| `x`, `y` | Position offset | `x: 100` |
| `scale` | Uniform scale | `scale: 1.2` |
| `scaleX`, `scaleY` | Axis scale | `scaleY: 0.9` |
| `rotation` | Degrees | `rotation: 15` |
| `opacity` | 0-1 | `opacity: 0` |
| `filter` | CSS filters | `filter: "brightness(2)"` |

## Common Eases

- `"power1.out"` - Gentle slow down
- `"power2.out"` - Medium slow down (default)
- `"power3.out"` - Strong slow down
- `"power4.out"` - Very strong slow down
- `"back.out(2)"` - Overshoot and bounce back
- `"elastic.out(1, 0.5)"` - Springy bounce
- `"power2.in"` - Speed up (for windups)

## Testing Animations

Animations are selected randomly during battle. To test a specific animation:

1. Temporarily modify `registry/index.ts`:
```typescript
getRandomAttack(): AnimationDefinition | undefined {
  // Force specific animation for testing
  return this.animations.get("hadouken");

  // Original random logic:
  // const attacks = this.getByCategory("attack");
  // return attacks[Math.floor(Math.random() * attacks.length)];
}
```

2. Run the app and trigger a vote reveal to see your animation.

3. Remember to revert the change after testing.
