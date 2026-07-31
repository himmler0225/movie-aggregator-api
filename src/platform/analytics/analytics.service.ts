import { Injectable } from '@nestjs/common';
import { PageViewsRepository } from '../../database/repositories/page-views.repository';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { SearchLogsRepository } from '../../database/repositories/search-logs.repository';
import { WatchEventsRepository } from '../../database/repositories/watch-events.repository';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly pageViews: PageViewsRepository,
    private readonly searchLogs: SearchLogsRepository,
    private readonly watchEvents: WatchEventsRepository,
    private readonly profiles: ProfilesRepository,
  ) {}
  async trackPageView(pageType: string) {
    await this.pageViews.create({ pageType: pageType.slice(0, 64) });
    return { ok: true };
  }
  async trackSearch(input: {
    keyword: string;
    resultsCount?: number;
    clickedSlug?: string;
  }) {
    const keyword = input.keyword.trim().slice(0, 200);
    if (!keyword) return { ok: false };
    await this.searchLogs.create({
      keyword,
      resultsCount: input.resultsCount ?? null,
      clickedSlug: input.clickedSlug?.slice(0, 200) ?? null,
    });
    return { ok: true };
  }
  async trackWatchEvent(input: {
    userId: string;
    movieSlug: string;
    movieName?: string;
    thumbUrl?: string;
    episodeName?: string;
    serverName?: string;
    watchDurationSec?: number;
    completed?: boolean;
    lang?: string;
    quality?: string;
  }) {
    const profile = await this.profiles.findById(input.userId);
    const username =
      profile?.fullName?.trim() || profile?.email?.split('@')[0] || null;
    const avatarUrl = profile?.avatarUrl ?? null;
    await this.watchEvents.create({
      userId: input.userId,
      movieSlug: input.movieSlug.slice(0, 200),
      movieName: input.movieName?.slice(0, 300) ?? null,
      thumbUrl: input.thumbUrl ?? null,
      episodeName: input.episodeName ?? null,
      serverName: input.serverName ?? null,
      username,
      avatarUrl,
      watchDurationSec: input.watchDurationSec ?? null,
      completed: input.completed ?? false,
      lang: input.lang ?? null,
      quality: input.quality ?? null,
    });
    return { ok: true };
  }
}
