import type { MovieSourceConfig } from './source.types';
import { MOVIE_SOURCE_URLS } from '../../shared/constants';

export const vsmovSource: MovieSourceConfig = {
  key: 'vsmov',
  name: 'VSMOV',
  baseUrl: MOVIE_SOURCE_URLS.vsmov.api,
  imgBase: MOVIE_SOURCE_URLS.vsmov.images,
  routes: {
    newMovies: '/danh-sach/phim-moi-cap-nhat',
    listByType: '/danh-sach',
    detail: '/phim',
    search: '/tim-kiem',
    genres: '/the-loai',
    countries: '/quoc-gia',
    years: '/nam',
    byGenre: '/the-loai',
    byCountry: '/quoc-gia',
    byYear: '/nam',
  },
  capabilities: {
    listByTypeFilters: false,
    listByTypeMode: 'query',
    imageWebp: false,
  },
  typeMap: {
    'phim-bo': 'series',
    'phim-le': 'single',
  },
};
