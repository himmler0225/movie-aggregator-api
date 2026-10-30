import { predictRelease } from './schedule.util';

// Helper: a Vietnam-time wall clock moment as a UTC Date.
const vn = (iso: string) => new Date(`${iso}+07:00`);

describe('predictRelease', () => {
  it('returns null without observations', () => {
    expect(predictRelease([])).toBeNull();
  });

  it('learns a Mon/Tue 20:00 pattern and predicts the next slot', () => {
    const seen = [
      vn('2026-10-12T20:05'), // Mon
      vn('2026-10-13T20:00'), // Tue
      vn('2026-10-19T19:55'), // Mon
      vn('2026-10-20T20:10'), // Tue
    ];
    const p = predictRelease(seen, vn('2026-10-21T09:00')); // Wed morning
    expect(p).toMatchObject({ weekdays: [1, 2], confidence: 'learned' });
    expect(p!.minuteOfDay).toBe(20 * 60 + 3);
    expect(p!.nextAt).toBe(vn('2026-10-26T20:03').toISOString()); // next Monday
  });

  it('counts two episodes released the same day once and guesses from little data', () => {
    const p = predictRelease(
      [vn('2026-10-24T11:00'), vn('2026-10-24T11:20')], // Sat, double drop
      vn('2026-10-24T12:00'),
    );
    expect(p).toMatchObject({
      weekdays: [6],
      minuteOfDay: 660,
      confidence: 'guess',
    });
    expect(p!.nextAt).toBe(vn('2026-10-31T11:00').toISOString());
  });

  it('can predict later the same day', () => {
    const p = predictRelease([vn('2026-10-23T21:00')], vn('2026-10-30T08:00')); // Fri, Fri
    expect(p!.nextAt).toBe(vn('2026-10-30T21:00').toISOString());
  });
});
