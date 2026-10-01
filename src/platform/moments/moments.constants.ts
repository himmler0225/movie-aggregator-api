export const REACTION_EMOJIS = ['🔥', '😂', '😱', '😢', '❤️', '👏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
/** Width of one heatmap bucket, in seconds of the episode. */
export const HEATMAP_BUCKET_SECONDS = 10;
/** A danmaku comment weighs this many reactions in the heatmap score. */
export const DANMAKU_WEIGHT = 2;
export const HOT_MOMENT_COUNT = 5;
/** Hot moments closer than this collapse into the stronger one. */
export const HOT_MOMENT_MIN_GAP_SECONDS = 60;
/** Reactions past this point are treated as bogus. */
export const MAX_REACTION_TIME_SECONDS = 6 * 3600;

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return (
    typeof value === 'string' &&
    (REACTION_EMOJIS as readonly string[]).includes(value)
  );
}
