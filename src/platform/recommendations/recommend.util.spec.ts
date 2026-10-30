import type { MovieListItem } from '../../shared/types/movie.types';
import {
  buildTasteProfile,
  rankCandidates,
  topEntries,
} from './recommend.util';

const g = (slug: string) => ({ slug, name: slug });
const movie = (
  slug: string,
  genres: string[],
  countries: string[],
  year = 2025,
): MovieListItem => ({
  slug,
  name: slug,
  poster_url: '',
  thumb_url: '',
  year,
  category: genres.map(g),
  country: countries.map(g),
});

describe('recommendations', () => {
  const profile = buildTasteProfile([
    { movie: movie('a', ['hanh-dong', 'vien-tuong'], ['han-quoc']), weight: 1 },
    { movie: movie('b', ['hanh-dong'], ['han-quoc']), weight: 2 },
    { movie: movie('c', ['tinh-cam'], ['trung-quoc']), weight: 1 },
  ]);

  it('weights genres and countries by how much they were watched', () => {
    expect(topEntries(profile.genres, 2).map((e) => e.slug)).toEqual([
      'hanh-dong',
      'vien-tuong',
    ]);
    expect(topEntries(profile.countries, 1)[0]).toMatchObject({
      slug: 'han-quoc',
      weight: 3,
    });
  });

  it('ranks matches first and drops seen, duplicate and unrelated titles', () => {
    const ranked = rankCandidates(
      [
        movie('x', ['tinh-cam'], ['trung-quoc']),
        movie('y', ['hanh-dong', 'vien-tuong'], ['han-quoc']),
        movie('a', ['hanh-dong'], ['han-quoc']),
        movie('y', ['hanh-dong'], ['han-quoc']),
        movie('z', ['kinh-di'], ['thai-lan'], 2010),
      ],
      profile,
      new Set(['a']),
      10,
      2026,
    );
    expect(ranked.map((m) => m.slug)).toEqual(['y', 'x']);
  });
});
