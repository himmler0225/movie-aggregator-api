import { BadRequestException, Injectable } from '@nestjs/common';
import { SkipMarksRepository } from '../../database/repositories/skip-marks.repository';
import { SKIP_MAX_LENGTH_SEC } from './dto/skip-markers.dto';
import {
  skipConsensus,
  type SkipKind,
  type SkipSegment,
} from './skip-consensus.util';

export interface EpisodeSkipMarkers {
  intro: SkipSegment | null;
  outro: SkipSegment | null;
  /** The viewer's own marks: used for them even before others agree. */
  mine: Partial<Record<SkipKind, { start: number; end: number }>>;
}

@Injectable()
export class SkipMarkersService {
  constructor(private readonly marks: SkipMarksRepository) {}
  async forEpisode(
    userId: string,
    movieSlug: string,
    episodeName: string,
  ): Promise<EpisodeSkipMarkers> {
    const rows = await this.marks.findByEpisode(movieSlug, episodeName);
    const result: EpisodeSkipMarkers = { intro: null, outro: null, mine: {} };
    for (const kind of ['intro', 'outro'] as const) {
      const ofKind = rows.filter((r) => r.kind === kind);
      result[kind] = skipConsensus(ofKind);
      const own = ofKind.find((r) => r.userId === userId);
      if (own) result.mine[kind] = { start: own.startSec, end: own.endSec };
    }
    return result;
  }
  async mark(
    userId: string,
    input: {
      movieSlug: string;
      episodeName: string;
      kind: SkipKind;
      startSec: number;
      endSec: number;
    },
  ) {
    const length = input.endSec - input.startSec;
    if (length < 3 || length > SKIP_MAX_LENGTH_SEC) {
      throw new BadRequestException('platform.skipMarkInvalidRange');
    }
    await this.marks.upsertMine(
      userId,
      {
        movieSlug: input.movieSlug,
        episodeName: input.episodeName,
        kind: input.kind,
      },
      { startSec: input.startSec, endSec: input.endSec },
    );
    return this.forEpisode(userId, input.movieSlug, input.episodeName);
  }
  async unmark(
    userId: string,
    movieSlug: string,
    episodeName: string,
    kind: SkipKind,
  ) {
    await this.marks.deleteMany({ userId, movieSlug, episodeName, kind });
    return this.forEpisode(userId, movieSlug, episodeName);
  }
}
