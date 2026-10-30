export type SkipKind = 'intro' | 'outro';

export interface SkipMarkInput {
  startSec: number;
  endSec: number;
}

export interface SkipSegment {
  start: number;
  end: number;
  votes: number;
}

/** Marks agree when both edges are within this many seconds. */
export const SKIP_TOLERANCE_SEC = 4;
/** Viewers that must agree before a segment is shown to everyone. */
export const SKIP_MIN_VOTES = 2;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The segment most viewers agree on: the largest group of marks whose start and
 * end are each within SKIP_TOLERANCE_SEC of one mark, reduced to its median
 * edges. Null until SKIP_MIN_VOTES viewers agree.
 */
export function skipConsensus(
  marks: SkipMarkInput[],
  minVotes = SKIP_MIN_VOTES,
): SkipSegment | null {
  let best: SkipMarkInput[] = [];
  for (const anchor of marks) {
    const group = marks.filter(
      (m) =>
        Math.abs(m.startSec - anchor.startSec) <= SKIP_TOLERANCE_SEC &&
        Math.abs(m.endSec - anchor.endSec) <= SKIP_TOLERANCE_SEC,
    );
    if (group.length > best.length) best = group;
  }
  if (best.length < minVotes) return null;
  return {
    start: Math.round(median(best.map((m) => m.startSec)) * 10) / 10,
    end: Math.round(median(best.map((m) => m.endSec)) * 10) / 10,
    votes: best.length,
  };
}
