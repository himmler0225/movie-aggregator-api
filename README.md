# Movie Aggregator API

NestJS gateway that aggregates movie data from multiple upstream sources behind a **single unified API**.

| Upstream | Base URL |
|----------|----------|
| **KKPhim** | `https://phimapi.com` |
| **OPhim** | `https://ophim1.com` |
| **VSMOV** | `https://vsmov.com/api` |

Default port: **3001**

---

## Quick start

```bash
yarn install
yarn start:dev
```

| URL | Description |
|-----|-------------|
| `http://localhost:3001/api/health` | Health check |
| `http://localhost:3001/api/movies/*` | Movie endpoints |
| `http://localhost:3001/api/docs` | Swagger UI |
| `http://localhost:3001/api/docs-json` | OpenAPI JSON |

Set a custom port with the `PORT` environment variable.

---

## Architecture

```
Client  →  /api/movies/*  →  MoviesService  →  upstream (kkphim / ophim / vsmov)
                                ↓
                         fallback on error
```

- **Single prefix:** all movie routes live under `/api/movies`.
- **Automatic fallback:** when no `source` query param is provided, the API tries sources in order: `kkphim` → `ophim` → `vsmov`.
- **Pin a source:** pass `?source=kkphim`, `?source=ophim`, or `?source=vsmov` to skip fallback.
- **Retry:** upstream HTTP calls retry up to 3 times with exponential backoff.

Fallback triggers on upstream errors, timeouts, and **404 (movie not found)**.

---

## Response format

Every JSON movie endpoint returns the same envelope:

```json
{
  "source": "kkphim",
  "data": {},
  "pagination": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Upstream that served the response (`kkphim` \| `ophim` \| `vsmov`) |
| `data` | `T` | Payload (shape depends on endpoint) |
| `pagination` | `object?` | Present on list endpoints only |

### Pagination object

```json
{
  "totalItems": 1000,
  "totalItemsPerPage": 24,
  "currentPage": 1,
  "totalPages": 42
}
```

---

## Common query parameters

### Pagination

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number (min: 1) |
| `limit` | `number` | `24` | Items per page (max: 64) |

### Source pinning

| Param | Type | Description |
|-------|------|-------------|
| `source` | `kkphim` \| `ophim` \| `vsmov` | Pin upstream source. Omit for automatic fallback. |

### List filters

Available on list endpoints (`type`, `genres`, `countries`, `years`):

| Param | Type | Description |
|-------|------|-------------|
| `category` | `string` | Secondary genre slug (e.g. `hanh-dong`) |
| `country` | `string` | Secondary country slug (e.g. `han-quoc`) |
| `year` | `string` | Release year, 4 digits (e.g. `2024`) |
| `sort_lang` | `vietsub` \| `thuyet-minh` \| `long-tieng` | Subtitle / dubbing filter |
| `sort_field` | `modified.time` \| `_id` \| `year` | Sort field |
| `sort_type` | `desc` \| `asc` | Sort direction |

> **Note:** Content filters (`category`, `country`, `year`, `sort_*`) are only forwarded to KKPhim. OPhim and VSMOV receive `page` and `limit` only. VSMOV supports `phim-bo` (`series`) and `phim-le` (`single`) on the type endpoint.

---

## Endpoints

### Health

#### `GET /api/health`

```json
{ "ok": true, "service": "movie-aggregator-api" }
```

---

### Movies

#### `GET /api/movies/new`

Recently updated movies.

**Query:** `page`, `source`

**Response `data`:** `MovieListItem[]`

```bash
curl "http://localhost:3001/api/movies/new?page=1"
```

---

#### `GET /api/movies/type/:type`

List movies by type.

**Path param `type`:**

| Value | Label |
|-------|-------|
| `phim-bo` | TV Series |
| `phim-le` | Feature Film |
| `tv-shows` | TV Shows |
| `hoat-hinh` | Animation |
| `phim-vietsub` | Vietsub |
| `phim-thuyet-minh` | Dubbed (VN) |
| `phim-long-tieng` | Voice-over (VN) |

**Query:** pagination, filters, `source`

**Response `data`:** `MovieListItem[]`

```bash
curl "http://localhost:3001/api/movies/type/phim-bo?page=1&sort_field=modified.time&sort_type=desc"
```

---

#### `GET /api/movies/search`

Search movies by keyword.

**Query:** `keyword` *(required)*, pagination, `source`

**Response `data`:** `MovieListItem[]`

```bash
curl "http://localhost:3001/api/movies/search?keyword=one%20piece&page=1"
```

---

#### `GET /api/movies/genres/:slug`

Movies filtered by genre slug.

**Query:** pagination, filters, `source`

**Response `data`:** `MovieListItem[]`

```bash
curl "http://localhost:3001/api/movies/genres/hanh-dong?page=1"
```

---

#### `GET /api/movies/countries/:slug`

Movies filtered by country slug.

**Query:** pagination, filters, `source`

**Response `data`:** `MovieListItem[]`

```bash
curl "http://localhost:3001/api/movies/countries/han-quoc?page=1"
```

---

#### `GET /api/movies/years/:year`

Movies filtered by release year.

**Query:** pagination, filters, `source`

**Response `data`:** `MovieListItem[]`

```bash
curl "http://localhost:3001/api/movies/years/2024?page=1"
```

---

#### `GET /api/movies/meta/genres`

All genres metadata.

**Query:** `source`

**Response `data`:** `MetadataItem[]`

```bash
curl "http://localhost:3001/api/movies/meta/genres"
```

---

#### `GET /api/movies/meta/countries`

All countries metadata.

**Query:** `source`

**Response `data`:** `MetadataItem[]`

```bash
curl "http://localhost:3001/api/movies/meta/countries"
```

---

#### `GET /api/movies/meta/years`

All year metadata. VSMOV is currently the only source exposing this metadata
endpoint, so it is selected by default.

**Query:** `source=vsmov` *(optional)*

**Response `data`:** `MetadataItem[]`

```bash
curl "http://localhost:3001/api/movies/meta/years"
```

---

#### `GET /api/movies/:slug`

Movie detail with episodes.

**Query:** `source`

**Response `data`:**

```json
{
  "movie": { /* MovieDetail */ },
  "episodes": [
    {
      "server_name": "Server #1",
      "server_data": [
        {
          "name": "Tập 1",
          "slug": "tap-1",
          "link_embed": "https://...",
          "link_m3u8": "https://..."
        }
      ]
    }
  ]
}
```

```bash
curl "http://localhost:3001/api/movies/one-piece"
```

> **Route order:** `:slug` is registered last so static paths (`new`, `search`, `meta/*`, etc.) are not captured as slugs.

---

#### `GET /api/movies/image/webp`

Proxy WebP images from **phimimg.com** only. Returns binary `image/webp` (not JSON envelope).

**Query:** `url` *(required)* — full phimimg.com image URL

```bash
curl "http://localhost:3001/api/movies/image/webp?url=https%3A%2F%2Fphimimg.com%2Fupload%2F..." --output poster.webp
```

---

## Data models

### MovieListItem

```typescript
{
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  poster_url: string;      // absolute URL
  thumb_url: string;       // absolute URL
  year?: number;
  type?: string;
  quality?: string;
  lang?: string;
  episode_current?: string;
  episode_total?: string;
  time?: string;
  category?: { id?: string; name: string; slug: string }[];
  country?: { id?: string; name: string; slug: string }[];
}
```

### MovieDetail

Extends `MovieListItem` with:

```typescript
{
  content?: string;
  status?: string;
  director?: string[];
  actor?: string[];
  trailer_url?: string;
  is_copyright?: boolean;
  sub_docquyen?: boolean;
  chieurap?: boolean;
  showtimes?: string;
  view?: number;
  notify?: string;
  modified?: { time: string };
}
```

### MetadataItem

```typescript
{ _id: string; name: string; slug: string }
```

---

## Error responses

All errors return JSON:

```json
{ "error": "Human-readable message" }
```

| HTTP Status | Typical cause |
|-------------|---------------|
| `400` | Invalid params, missing keyword, invalid movie type/year/image URL, invalid source |
| `404` | Movie not found |
| `502` | Upstream error (all sources failed) |
| `504` | Upstream timeout |
| `500` | Internal server error |

Example:

```bash
curl "http://localhost:3001/api/movies/search"
# → 400 { "error": "Missing required query parameter: keyword" }
```

---

## Frontend integration

```typescript
// List
const res = await fetch('/api/movies/new?page=1');
const { source, data, pagination } = await res.json();
// data: MovieListItem[]

// Detail
const detail = await fetch('/api/movies/one-piece');
const { data: { movie, episodes } } = await detail.json();

// Pin source (skip fallback)
const pinned = await fetch('/api/movies/one-piece?source=ophim');
```

Image URLs in `poster_url` / `thumb_url` are already normalized to absolute URLs.

---

## Adding a new upstream source

1. Create `src/movies/sources/<name>.source.ts` (see `kkphim.source.ts` for reference).
2. Register in `src/movies/sources/sources.registry.ts`:
   - Add to `MOVIE_SOURCES`
   - Add key to `SOURCE_KEYS` and `SOURCE_FALLBACK_ORDER`
3. Add a source-specific adapter when its response envelope or route style
   differs from KKPhim/OPhim.
4. Restart the server.

---

## Project structure

```
src/
├── movies/
│   ├── movies.controller.ts    # /api/movies routes
│   ├── movies.service.ts       # upstream calls + fallback
│   ├── movie.normalizer.ts     # response normalization
│   └── sources/                # per-source config + registry
├── upstream/                   # HTTP client with retry
├── shared/                     # dto, errors, types, utils, logger
├── health/                     # /api/health
└── config/swagger.config.ts
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `yarn start:dev` | Dev server with hot reload |
| `yarn build` | Compile to `dist/` |
| `yarn start:prod` | Run compiled build |
| `yarn lint` | ESLint |
| `yarn test` | Unit tests |
