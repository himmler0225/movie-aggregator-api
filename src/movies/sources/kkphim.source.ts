import type { MovieSourceConfig } from './source.types';
import { MOVIE_SOURCE_URLS } from '../../shared/constants';

export const kkphimSource: MovieSourceConfig = {
  key: 'kkphim',
  name: 'KKPhim',
  baseUrl: MOVIE_SOURCE_URLS.kkphim.api,
  imgBase: MOVIE_SOURCE_URLS.kkphim.images,
  routes: {
    newMovies: '/danh-sach/phim-moi-cap-nhat-v3',
    listByType: '/v1/api/danh-sach',
    detail: '/phim',
    search: '/v1/api/tim-kiem',
    genres: '/the-loai',
    countries: '/quoc-gia',
    byGenre: '/v1/api/the-loai',
    byCountry: '/v1/api/quoc-gia',
    byYear: '/v1/api/nam',
    imageWebp: '/image.php',
  },
  capabilities: {
    listByTypeFilters: true,
    listByTypeMode: 'path',
    imageWebp: true,
  },
};
