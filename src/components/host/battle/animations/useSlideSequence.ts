import { gsap } from "../../animations/gsapConfig";
import { BattleRefs, BattleState } from "../types";

interface SlideSequenceOptions {
  refs: BattleRefs;
  answerOrder: BattleState["answerOrder"];
}

// Percentage-based positioning for responsive scaling
const EDGE_PERCENT = 0.02; // 2% from edge
const BOTTOM_PERCENT = 0.08; // 8% from bottom
const SCALE = 0.65;
const MOBILE_BREAKPOINT = 768;

/**
 * createSlideTimeline - Slides answers from center to bottom corners
 *
 * Uses percentage-based positioning relative to arena size for responsive scaling.
 * - Left answer slides to bottom-left corner (or bottom-bottom on mobile)
 * - Right answer slides to bottom-right corner (or top-bottom on mobile)
 * - VS badge fades out
 * - Both answers scale down
 */
export function createSlideTimeline({ refs, answerOrder }: SlideSequenceOptions): gsap.core.Timeline {
  const timeline = gsap.timeline();

  // Fade out VS badge
  timeline.to(refs.vsBadge.current, {
    opacity: 0,
    duration: 0.3,
  });

  const arenaRect = refs.arena.current?.getBoundingClientRect();
  const answer1Rect = refs.answer1.current?.getBoundingClientRect();
  const answer2Rect = refs.answer2.current?.getBoundingClientRect();

  if (arenaRect && answer1Rect && answer2Rect) {
    const isMobile = arenaRect.width < MOBILE_BREAKPOINT;

    // Determine which answer goes left vs right (or top vs bottom on mobile) based on battler assignment
    const leftAnswerRef = answerOrder.first === "left" ? refs.answer1 : refs.answer2;
    const rightAnswerRef = answerOrder.first === "right" ? refs.answer1 : refs.answer2;
    const leftAnswerRect = answerOrder.first === "left" ? answer1Rect : answer2Rect;
    const rightAnswerRect = answerOrder.first === "right" ? answer1Rect : answer2Rect;

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

    // Calculate padding based on arena size (percentage-based)
    const edgePadding = arenaRect.width * EDGE_PERCENT;
    const bottomPadding = arenaRect.height * BOTTOM_PERCENT;

    let leftTargetCenterX, leftTargetCenterY, rightTargetCenterX, rightTargetCenterY;

    if (isMobile) {
      // Mobile: Stack Vertically at bottom
      // Right (second) on top of Left (first)? Or vice versa.
      // Let's put Left (First) at very bottom, Right (Second) above it.
      const gap = 10;

      leftTargetCenterX = arenaRect.width / 2;
      leftTargetCenterY = arenaRect.height - bottomPadding - leftScaledHeight / 2;

      rightTargetCenterX = arenaRect.width / 2;
      rightTargetCenterY = leftTargetCenterY - leftScaledHeight / 2 - gap - rightScaledHeight / 2;

    } else {
      // Desktop: Split Corners
      leftTargetCenterX = edgePadding + leftScaledWidth / 2;
      leftTargetCenterY = arenaRect.height - bottomPadding - leftScaledHeight / 2;

      rightTargetCenterX = arenaRect.width - edgePadding - rightScaledWidth / 2;
      rightTargetCenterY = arenaRect.height - bottomPadding - rightScaledHeight / 2;
    }

    // Calculate offsets from current position to target
    const leftOffsetX = leftTargetCenterX - leftCurrentCenterX;
    const leftOffsetY = leftTargetCenterY - leftCurrentCenterY;
    const rightOffsetX = rightTargetCenterX - rightCurrentCenterX;
    const rightOffsetY = rightTargetCenterY - rightCurrentCenterY;

    // Animate left answer
    timeline.to(leftAnswerRef.current, {
      x: leftOffsetX,
      y: leftOffsetY,
      scale: SCALE,
      duration: 0.5,
      ease: "power2.out",
    }, "slide");

    // Animate right answer
    timeline.to(rightAnswerRef.current, {
      x: rightOffsetX,
      y: rightOffsetY,
      scale: SCALE,
      duration: 0.5,
      ease: "power2.out",
    }, "slide");
  }

  return timeline;
}
