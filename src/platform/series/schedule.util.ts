/** Vietnam has no DST: a fixed +07:00 offset is exact. */
const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;

export interface ReleasePattern {
  /** 0 = Sunday … 6 = Saturday (Vietnam time). */
  weekdays: number[];
  /** Typical release time of day, minutes after midnight (Vietnam time). */
  minuteOfDay: number;
  /** Next expected release (UTC ISO). */
  nextAt: string;
  /** "learned": 3+ observed releases; "guess": 1–2. */
  confidence: 'learned' | 'guess';
}

function vnParts(d: Date) {
  const local = new Date(d.getTime() + VN_OFFSET_MS);
  return {
    weekday: local.getUTCDay(),
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
    dayStart:
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate(),
      ) - VN_OFFSET_MS,
  };
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Release days/time learned from when new episodes were first seen. Several
 * episodes seen the same day count once. Null without any observation.
 */
export function predictRelease(
  seenAt: Date[],
  now = new Date(),
): ReleasePattern | null {
  if (seenAt.length === 0) return null;
  const byDay = new Map<number, number>(); // dayStart -> earliest minute that day
  for (const d of seenAt) {
    const p = vnParts(d);
    const cur = byDay.get(p.dayStart);
    if (cur == null || p.minute < cur) byDay.set(p.dayStart, p.minute);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const weekdays = [
    ...new Set(days.map((d) => vnParts(new Date(d + 12 * 3600_000)).weekday)),
  ].sort((a, b) => a - b);
  const minuteOfDay = median([...byDay.values()]);

  const today = vnParts(now).dayStart;
  let nextAt = '';
  for (let i = 0; i <= 7; i++) {
    const dayStart = today + i * DAY_MS;
    const weekday = vnParts(new Date(dayStart + 12 * 3600_000)).weekday;
    const at = dayStart + minuteOfDay * 60_000;
    if (weekdays.includes(weekday) && at > now.getTime()) {
      nextAt = new Date(at).toISOString();
      break;
    }
  }
  return {
    weekdays,
    minuteOfDay,
    nextAt,
    confidence: days.length >= 3 ? 'learned' : 'guess',
  };
}
