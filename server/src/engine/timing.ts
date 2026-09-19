// ============================================================
// Pacing — how long the table pauses so people can follow along
// ============================================================

/**
 * How long the finished trick stays on the table before it is swept
 * away. Long enough to read all four cards and see who took it.
 */
export const TRICK_SETTLE_MS = 2400;

/** Beat between one card landing and the next, on top of bot thinking time. */
export const BETWEEN_CARDS_MS = 450;

/** Pause after the final trick before the score screen appears. */
export const ROUND_END_MS = 900;
