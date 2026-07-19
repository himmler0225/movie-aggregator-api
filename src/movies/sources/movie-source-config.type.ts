import type { SourceCapabilities } from './source-capabilities.type';
import type { SourceRoutes } from './source-routes.type';
import type { MovieType } from '../../shared/constants/movie-types.constant';

export interface MovieSourceConfig {
  key: string;
  name: string;
  baseUrl: string;
  imgBase: string;
  routes: SourceRoutes;
  capabilities: SourceCapabilities;
  typeMap?: Partial<Record<MovieType, string>>;
}
