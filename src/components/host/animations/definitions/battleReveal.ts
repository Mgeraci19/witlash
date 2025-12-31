import { gsap } from "../../animations/gsapConfig";
import type { AnimationDefinition } from "../core/types";
import { animationRegistry } from "../core/AnimationRegistry";
import { TIMINGS } from "../config";

// Configuration (from useSlideSequence.ts)
const SCALE = 0.65;
const MOBILE_BREAKPOINT = 768;
const VERTICAL_OFFSET = 0;

/**
 * slideAnswersAnimation - Slides answers from center to positions beside fighters
 *
 * Flow:
 * 1. Fade out VS badge (0.3s)
 * 2. Slide both answers to bottom corners (0.5s)
 * 3. Scale down to 0.65
 *
 * Total duration: 0.5s (concurrent with fade)
 */
export const slideAnswersAnimation: AnimationDefinition = {
  id: "slide-answers",
  name: "Slide Answers to Corners",
  category: "battle",
  duration: TIMINGS.slideAnswers,
  canRunInParallel: false,
  priority: 10,
  tags: ["battle", "reveal"],

  create: (context) => {
    const timeline = gsap.timeline({ onComplete: context.onComplete });

    context.setPhase?.("sliding");

    // Fade out VS badge
    timeline.to(context.refs.vsBadge.current, {
      opacity: 0,
      duration: 0.3,
    });

    const arenaRect = context.refs.arena.current?.getBoundingClientRect();
    const answer1Rect = context.refs.answer1.current?.getBoundingClientRect();
    const answer2Rect = context.refs.answer2.current?.getBoundingClientRect();
    const leftFighterRect = context.refs.leftFighter.current?.getBoundingClientRect();
    const rightFighterRect = context.refs.rightFighter.current?.getBoundingClientRect();

    if (arenaRect && answer1Rect && answer2Rect && leftFighterRect && rightFighterRect) {
      const isMobile = arenaRect.width < MOBILE_BREAKPOINT;

      // Determine which answer goes where based on answer order from context
      const leftAnswerRef = context.answerOrder.first === "left" ? context.refs.answer1 : context.refs.answer2;
      const rightAnswerRef = context.answerOrder.first === "right" ? context.refs.answer1 : context.refs.answer2;
      const leftAnswerRect = context.answerOrder.first === "left" ? answer1Rect : answer2Rect;
      const rightAnswerRect = context.answerOrder.first === "right" ? answer1Rect : answer2Rect;

      // Current center positions relative to arena
      const leftCurrentCenterX = leftAnswerRect.left + leftAnswerRect.width / 2 - arenaRect.left;
      const leftCurrentCenterY = leftAnswerRect.top + leftAnswerRect.height / 2 - arenaRect.top;
      const rightCurrentCenterX = rightAnswerRect.left + rightAnswerRect.width / 2 - arenaRect.left;
      const rightCurrentCenterY = rightAnswerRect.top + rightAnswerRect.height / 2 - arenaRect.top;

      // Scaled dimensions
      const leftScaledWidth = leftAnswerRect.width * SCALE;
      const leftScaledHeight = leftAnswerRect.height * SCALE;
      const rightScaledWidth = rightAnswerRect.width * SCALE;
      const rightScaledHeight = rightAnswerRect.height * SCALE;

      // Fighter positions relative to arena
      const leftFighterBottom = leftFighterRect.bottom - arenaRect.top;
      const rightFighterBottom = rightFighterRect.bottom - arenaRect.top;

      // Calculate vertical position (aligned by bottom edge)
      const fighterBaseline = Math.max(leftFighterBottom, rightFighterBottom);
      const targetBottom = fighterBaseline + VERTICAL_OFFSET;
      const safeTargetBottom = Math.min(targetBottom, arenaRect.height - 50);

      // Convert bottom position to center Y for each answer
      const leftTargetCenterY = safeTargetBottom - leftScaledHeight / 2;
      const rightTargetCenterY = safeTargetBottom - rightScaledHeight / 2;

      let leftTargetCenterX, rightTargetCenterX;

      if (isMobile) {
        // Mobile: Stack vertically, centered
        leftTargetCenterX = arenaRect.width / 2;
        rightTargetCenterX = arenaRect.width / 2;
      } else {
        // Desktop: Bottom corners
        const edgePadding = 20;
        leftTargetCenterX = edgePadding + leftScaledWidth / 2;
        rightTargetCenterX = arenaRect.width - edgePadding - rightScaledWidth / 2;
      }

      // Calculate offsets from current position to target
      const leftOffsetX = leftTargetCenterX - leftCurrentCenterX;
      const leftOffsetY = leftTargetCenterY - leftCurrentCenterY;
      const rightOffsetX = rightTargetCenterX - rightCurrentCenterX;
      const rightOffsetY = rightTargetCenterY - rightCurrentCenterY;

      // Animate left answer
      timeline.to(
        leftAnswerRef.current,
        {
          x: leftOffsetX,
          y: leftOffsetY,
          scale: SCALE,
          duration: TIMINGS.slideAnswers,
          ease: "power2.out",
        },
        "slide"
      );

      // Animate right answer
      timeline.to(
        rightAnswerRef.current,
        {
          x: rightOffsetX,
          y: rightOffsetY,
          scale: SCALE,
          duration: TIMINGS.slideAnswers,
          ease: "power2.out",
        },
        "slide"
      );
    }

    return timeline;
  },
};

/**
 * revealVotesAnimation - Tick up vote counts from 0 to final values
 *
 * Flow:
 * 1. Votes tick up from 0 to final count
 * 2. Both sides synchronized
 * 3. 0.6s total tick-up duration spread across all votes
 *
 * Total duration: 0.6s
 */
export const revealVotesAnimation: AnimationDefinition = {
  id: "reveal-votes",
  name: "Reveal Vote Counts",
  category: "battle",
  duration: TIMINGS.revealVotes,
  canRunInParallel: false,
  priority: 10,
  tags: ["battle", "reveal"],

  create: (context) => {
    const timeline = gsap.timeline({ onComplete: context.onComplete });

    context.setPhase?.("revealing");

    const leftVotes = context.leftBattler?.voteCount || 0;
    const rightVotes = context.rightBattler?.voteCount || 0;
    const maxVotes = Math.max(leftVotes, rightVotes, 1);
    const tickDuration = TIMINGS.revealVotes / maxVotes;

    console.log(`[revealVotesAnimation] Starting - Left: ${leftVotes}, Right: ${rightVotes}, MaxVotes: ${maxVotes}`);

    // Tick up votes
    for (let i = 1; i <= maxVotes; i++) {
      timeline.call(
        () => {
          const newVotes = {
            left: Math.min(i, leftVotes),
            right: Math.min(i, rightVotes),
          };
          console.log(`[revealVotesAnimation] Tick ${i}/${maxVotes}:`, newVotes);
          context.setDisplayedVotes?.(newVotes);
        },
        [],
        `+=${tickDuration}`
      );
    }

    return timeline;
  },
};

// Auto-register reveal animations
animationRegistry.register(slideAnswersAnimation);
animationRegistry.register(revealVotesAnimation);
