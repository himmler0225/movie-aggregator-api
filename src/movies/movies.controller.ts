import {
  applyDecorators,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../platform/auth/auth.decorators';
import { ErrorResponseDto } from '../shared/dto/error-response.dto';
import {
  MovieFilterDto,
  MOVIE_TYPE_API_ENUM,
  NewMoviesQueryDto,
} from './dto/movie-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { toMovieFilterParams, toSearchParams } from './filter.util';
import { MOVIES_API_PREFIX, SOURCE_KEYS } from './sources/sources.registry';
import { MoviesService } from './movies.service';

const ApiMovieErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiBadGatewayResponse({ type: ErrorResponseDto }),
    ApiGatewayTimeoutResponse({ type: ErrorResponseDto }),
  );

const UNIFIED_RESPONSE_DESC =
  'Envelope: `{ source: "kkphim"|"ophim"|"vsmov", data: T, pagination? }`';

@ApiTags('Movies')
@Controller(MOVIES_API_PREFIX)
@Public()
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get('new')
  @ApiOperation({
    summary: 'Recently updated movies',
    description:
      'Fallback kkphim → ophim → vsmov. `data` is an array of movies.',
  })
  @ApiOkResponse({ description: UNIFIED_RESPONSE_DESC })
  @ApiMovieErrors()
  getNewMovies(
    @Query()
    query: NewMoviesQueryDto,
  ) {
    return this.movies.getNewMovies(
      query.page ?? 1,
      this.movies.resolvePinnedSource(query.source),
    );
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'List movies by type' })
  @ApiParam({ name: 'type', enum: MOVIE_TYPE_API_ENUM, example: 'phim-bo' })
  @ApiOkResponse({ description: UNIFIED_RESPONSE_DESC })
  @ApiMovieErrors()
  getMoviesByType(
    @Param('type')
    type: string,
    @Query()
    query: MovieFilterDto,
  ) {
    return this.movies.getMoviesByType(
      type,
      toMovieFilterParams(query),
      this.movies.resolvePinnedSource(query.source),
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search movies' })
  @ApiOkResponse({ description: UNIFIED_RESPONSE_DESC })
  @ApiMovieErrors()
  searchMovies(
    @Query()
    query: SearchQueryDto,
  ) {
    return this.movies.searchMovies(
      toSearchParams(query),
      this.movies.resolvePinnedSource(query.source),
    );
  }

  @Get('genres/:slug')
  @ApiOperation({ summary: 'Movies by genre' })
  @ApiParam({ name: 'slug', example: 'hanh-dong' })
  @ApiOkResponse({ description: UNIFIED_RESPONSE_DESC })
  @ApiMovieErrors()
  getByGenre(
    @Param('slug')
    slug: string,
    @Query()
    query: MovieFilterDto,
  ) {
    return this.movies.getByGenre(
      slug,
      toMovieFilterParams(query),
      this.movies.resolvePinnedSource(query.source),
    );
  }

  @Get('countries/:slug')
  @ApiOperation({ summary: 'Movies by country' })
  @ApiParam({ name: 'slug', example: 'han-quoc' })
  @ApiOkResponse({ description: UNIFIED_RESPONSE_DESC })
  @ApiMovieErrors()
  getByCountry(
    @Param('slug')
    slug: string,
    @Query()
    query: MovieFilterDto,
  ) {
    return this.movies.getByCountry(
      slug,
      toMovieFilterParams(query),
      this.movies.resolvePinnedSource(query.source),
    );
  }

  @Get('years/:year')
  @ApiOperation({ summary: 'Movies by year' })
  @ApiParam({ name: 'year', example: '2024' })
  @ApiOkResponse({ description: UNIFIED_RESPONSE_DESC })
  @ApiMovieErrors()
  getByYear(
    @Param('year')
    year: string,
    @Query()
    query: MovieFilterDto,
  ) {
    return this.movies.getByYear(
      year,
      toMovieFilterParams(query),
      this.movies.resolvePinnedSource(query.source),
    );
  }

  @Get('meta/genres')
  @ApiOperation({ summary: 'Metadata — all genres' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: SOURCE_KEYS,
    description: 'Pin upstream source. Omit to use automatic fallback.',
  })
  @ApiOkResponse({ description: '`data`: `[{ _id, name, slug }]`' })
  @ApiMovieErrors()
  getAllGenres(
    @Query('source')
    source?: string,
  ) {
    return this.movies.getAllGenres(this.movies.resolvePinnedSource(source));
  }

  @Get('meta/countries')
  @ApiOperation({ summary: 'Metadata — all countries' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: SOURCE_KEYS,
    description: 'Pin upstream source. Omit to use automatic fallback.',
  })
  @ApiOkResponse({ description: '`data`: `[{ _id, name, slug }]`' })
  @ApiMovieErrors()
  getAllCountries(
    @Query('source')
    source?: string,
  ) {
    return this.movies.getAllCountries(this.movies.resolvePinnedSource(source));
  }

  @Get('meta/years')
  @ApiOperation({ summary: 'Metadata — all VSMOV years' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['vsmov'],
    description: 'VSMOV is currently the only source with year metadata.',
  })
  @ApiOkResponse({ description: '`data`: `[{ _id, name, slug }]`' })
  @ApiMovieErrors()
  getAllYears(
    @Query('source')
    source?: string,
  ) {
    return this.movies.getAllYears(this.movies.resolvePinnedSource(source));
  }

  @Get('image/webp')
  @ApiOperation({ summary: 'WebP image proxy (phimimg.com only)' })
  @ApiQuery({
    name: 'url',
    required: true,
    description: 'phimimg.com image URL',
  })
  @ApiProduces('image/webp')
  @ApiOkResponse({ description: 'Binary image/webp' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getImageWebp(
    @Query('url')
    url: string,
    @Res()
    res: Response,
  ) {
    const { data, contentType } = await this.movies.getImageWebp(url);
    res.set('Content-Type', contentType);
    res.send(data);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Movie detail' })
  @ApiParam({ name: 'slug', example: 'one-piece' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: SOURCE_KEYS,
    description: 'Pin upstream source. Omit to use automatic fallback.',
  })
  @ApiOkResponse({ description: '`data`: `{ movie, episodes }`' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiMovieErrors()
  getMovieDetail(
    @Param('slug')
    slug: string,
    @Query('source')
    source?: string,
  ) {
    return this.movies.getMovieDetail(
      slug,
      this.movies.resolvePinnedSource(source),
    );
  }
}
