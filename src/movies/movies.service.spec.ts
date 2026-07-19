import { AppError, AppErrorCode } from '../shared/errors';
import type { UpstreamClientService } from '../upstream/upstream-client.service';
import { MoviesService } from './movies.service';
import type {
  VsmovDetailResponse,
  VsmovListResponse,
  VsmovMetadataResponse,
} from './sources/vsmov.types';

const listResponse: VsmovListResponse = {
  status: true,
  items: [
    {
      tmdb: {
        type: 'tv',
        id: '66732',
        season: 4,
        vote_average: '8.5',
        vote_count: 21461,
      },
      imdb: { id: 'tt4574334' },
      modified: { time: '2026-07-18T13:48:36+07:00' },
      _id: 50530,
      name: 'Cậu bé mất tích - Phần 4',
      origin_name: 'Stranger Things - Season 4',
      slug: 'cau-be-mat-tich-p4',
      poster_url: 'https://vsmov.com/storage/images/poster.jpg',
      thumb_url: 'https://vsmov.com/storage/images/thumb.jpg',
      year: 2022,
    },
  ],
  pagination: {
    totalItems: 413,
    totalItemsPerPage: '24',
    currentPage: 1,
    totalPages: 18,
  },
};

const detailResponse: VsmovDetailResponse = {
  status: true,
  msg: '',
  movie: {
    ...listResponse.items[0],
    created: { time: '2026-07-18T13:47:55+07:00' },
    content: 'Bóng tối trở lại Hawkins.',
    type: 'series',
    status: 'completed',
    is_copyright: false,
    trailer_url: 'https://www.youtube.com/watch?v=test',
    time: '86 phút',
    episode_current: 'Hoàn Tất (9/9)',
    episode_total: '9',
    quality: 'HD',
    lang: 'Vietsub + Thuyết Minh',
    notify: null,
    showtimes: null,
    keywords: null,
    view: 0,
    chieurap: false,
    sub_docquyen: false,
    actor: ['Winona Ryder'],
    director: ['Matt Duffer'],
    category: [{ _id: 17, name: 'Bí Ẩn', slug: 'bi-an' }],
    country: [{ _id: 7, name: 'Âu Mỹ', slug: 'au-my' }],
  },
  episodes: [
    {
      server_name: 'Thuyết minh #1',
      server_data: [
        {
          name: '1',
          slug: 'tap-1',
          filename: '1',
          link_embed: 'https://v3.streamvsmov.com/video/test',
        },
      ],
    },
  ],
};

const metadataResponse: VsmovMetadataResponse = {
  status: 'success',
  message: '',
  data: {
    items: [{ _id: 85, name: 'Action & Adventure', slug: 'action-adventure' }],
  },
};

describe('MoviesService VSMOV source', () => {
  const getJson = jest.fn();
  const upstream = {
    getJson,
    getBinary: jest.fn(),
  } as unknown as UpstreamClientService;
  const service = new MoviesService(upstream);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps phim-bo to the documented VSMOV series query', async () => {
    getJson.mockResolvedValue(listResponse);

    const result = await service.getMoviesByType(
      'phim-bo',
      { page: 1, limit: 24 },
      'vsmov',
    );

    expect(getJson).toHaveBeenCalledWith(
      'https://vsmov.com/api/danh-sach?page=1&limit=24&type=series',
      'list',
    );
    expect(result).toEqual({
      source: 'vsmov',
      data: [
        expect.objectContaining({
          _id: '50530',
          slug: 'cau-be-mat-tich-p4',
        }),
      ],
      pagination: {
        totalItems: 413,
        totalItemsPerPage: 24,
        currentPage: 1,
        totalPages: 18,
      },
    });
  });

  it('keeps existing sources first and reaches VSMOV as the final fallback', async () => {
    getJson
      .mockRejectedValueOnce(new AppError(AppErrorCode.UPSTREAM_ERROR))
      .mockRejectedValueOnce(new AppError(AppErrorCode.UPSTREAM_ERROR))
      .mockResolvedValueOnce(listResponse);

    const result = await service.getNewMovies(1);

    expect(getJson.mock.calls.map(([url]) => url)).toEqual([
      'https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=1',
      'https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1',
      'https://vsmov.com/api/danh-sach/phim-moi-cap-nhat?page=1',
    ]);
    expect(result.source).toBe('vsmov');
  });

  it('does not invent unsupported VSMOV type mappings', async () => {
    await expect(
      service.getMoviesByType('hoat-hinh', {}, 'vsmov'),
    ).rejects.toMatchObject<AppError>({
      code: AppErrorCode.BAD_REQUEST,
    });
    expect(getJson).not.toHaveBeenCalled();
  });

  it('normalizes VSMOV embed-only episodes for the unified contract', async () => {
    getJson.mockResolvedValue(detailResponse);

    const result = await service.getMovieDetail('cau-be-mat-tich-p4', 'vsmov');

    expect(result.source).toBe('vsmov');
    expect(result.data.movie.category?.[0]).toEqual({
      id: '17',
      name: 'Bí Ẩn',
      slug: 'bi-an',
    });
    expect(result.data.episodes[0].server_data[0]).toEqual(
      expect.objectContaining({
        link_embed: 'https://v3.streamvsmov.com/video/test',
        link_m3u8: '',
      }),
    );
  });

  it('unwraps VSMOV metadata and converts numeric IDs', async () => {
    getJson.mockResolvedValue(metadataResponse);

    const result = await service.getAllGenres('vsmov');

    expect(result).toEqual({
      source: 'vsmov',
      data: [
        {
          _id: '85',
          name: 'Action & Adventure',
          slug: 'action-adventure',
        },
      ],
    });
  });

  it('uses VSMOV for year metadata by default', async () => {
    getJson.mockResolvedValue(metadataResponse);

    await service.getAllYears();

    expect(getJson).toHaveBeenCalledWith('https://vsmov.com/api/nam', 'meta');
  });
});
