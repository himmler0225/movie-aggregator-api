import { buildUrl } from './url.util';

describe('buildUrl', () => {
  it('preserves a path prefix in the base URL', () => {
    expect(
      buildUrl('https://vsmov.com/api', '/danh-sach', {
        type: 'series',
        page: 1,
      }),
    ).toBe('https://vsmov.com/api/danh-sach?type=series&page=1');
  });
  it('keeps existing root-based source URLs unchanged', () => {
    expect(
      buildUrl('https://phimapi.com', '/v1/api/danh-sach/phim-bo', {
        page: 1,
      }),
    ).toBe('https://phimapi.com/v1/api/danh-sach/phim-bo?page=1');
  });
});
