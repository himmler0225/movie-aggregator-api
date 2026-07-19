import { UPPERCASE_LETTER_PATTERN } from '../../shared/constants';

export function toSnake<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(
      UPPERCASE_LETTER_PATTERN,
      (c) => `_${c.toLowerCase()}`,
    );
    out[snake] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}
