/**
 * Animation Configuration
 *
 * DEBUG_FAST_ANIMATIONS: Set to true for 3-4x faster animations during development
 */
export const DEBUG_FAST_ANIMATIONS =
  process.env.NODE_ENV === "development" ? true : false;

// Individual timing presets (seconds)
export const TIMINGS = {
  // Battle Entry (total ~7.4s normal, ~2s fast)
  entrySequence: DEBUG_FAST_ANIMATIONS ? 2.0 : 7.4,
  questionPause: DEBUG_FAST_ANIMATIONS ? 0.2 : 3.0,
  answerReadPause: DEBUG_FAST_ANIMATIONS ? 0.2 : 2.5,

  // Slide & Reveal
  slideAnswers: DEBUG_FAST_ANIMATIONS ? 0.3 : 0.5,
  reactionPause: DEBUG_FAST_ANIMATIONS ? 0.2 : 0.8,
  revealVotes: DEBUG_FAST_ANIMATIONS ? 0.3 : 0.6,
  postVotePause: DEBUG_FAST_ANIMATIONS ? 0.2 : 1.0,

  // Attacks
  attackLunge: DEBUG_FAST_ANIMATIONS ? 0.05 : 0.15,
  attackReturn: DEBUG_FAST_ANIMATIONS ? 0.05 : 0.1,
  damageDelay: DEBUG_FAST_ANIMATIONS ? 0.02 : 0.05,
  koSpinOff: DEBUG_FAST_ANIMATIONS ? 0.2 : 0.8,
  koDelay: DEBUG_FAST_ANIMATIONS ? 0.05 : 0.1,
};
