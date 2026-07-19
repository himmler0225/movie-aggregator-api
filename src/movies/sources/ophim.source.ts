import type { MovieSourceConfig } from './source.types';
import { MOVIE_SOURCE_URLS } from '../../shared/constants';

export const ophimSource: MovieSourceConfig = {
  key: 'ophim',
  name: 'OPhim',
  baseUrl: MOVIE_SOURCE_URLS.ophim.api,
  imgBase: MOVIE_SOURCE_URLS.ophim.images,
  routes: {
    newMovies: '/danh-sach/phim-moi-cap-nhat',
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
    listByTypeFilters: false,
    listByTypeMode: 'path',
    imageWebp: false,
  },
};
