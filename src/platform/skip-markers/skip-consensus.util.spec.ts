import { skipConsensus } from './skip-consensus.util';

const mark = (startSec: number, endSec: number) => ({ startSec, endSec });

describe('skipConsensus', () => {
  it('needs at least two agreeing viewers', () => {
    expect(skipConsensus([mark(60, 150)])).toBeNull();
    expect(skipConsensus([mark(60, 150), mark(200, 290)])).toBeNull();
  });

  it('returns the median of the largest agreeing group', () => {
    expect(
      skipConsensus([
        mark(60, 150),
        mark(62, 151),
        mark(59, 149),
        mark(300, 390),
      ]),
    ).toEqual({ start: 60, end: 150, votes: 3 });
  });

  it('ignores an outlier that agrees on only one edge', () => {
    expect(
      skipConsensus([mark(60, 150), mark(61, 152), mark(60, 200)]),
    ).toEqual({ start: 60.5, end: 151, votes: 2 });
  });
});
