import { normalizeMovie } from './movie.normalizer';

describe('normalizeMovie images', () => {
  const base = { name: 'Phù Sa', slug: 'phu-sa' };

  it('prefixes source-relative paths with the source CDN', () => {
    const m = normalizeMovie(
      { ...base, thumb_url: 'uploads/movies/20260819/phu-sa-thumb.webp' },
      'kkphim',
    );
    expect(m.thumb_url).toBe(
      'https://phimimg.com/uploads/movies/20260819/phu-sa-thumb.webp',
    );
  });

  it('keeps absolute URLs', () => {
    const url = 'https://i.ex-cdn.com/danviet.vn/files/a.jpg';
    expect(
      normalizeMovie({ ...base, poster_url: url }, 'kkphim').poster_url,
    ).toBe(url);
  });

  it('drops foreign URLs whose host was cut off upstream', () => {
    const m = normalizeMovie(
      {
        ...base,
        poster_url:
          'danviet.vn/files/content/2026/08/13/final--poster-phu-sa-1012.jpg',
      },
      'kkphim',
    );
    expect(m.poster_url).toBe('');
  });
});
