# VSMOV API observation

Observed from live `GET` requests against `https://vsmov.com/api` on
2026-07-18, before defining the VSMOV TypeScript contracts and mapper.

All documented endpoints returned HTTP 200 with
`Content-Type: application/json`, except a missing movie slug, which returned
HTTP 404 with an HTML nginx response.

## List and search responses

Applies to:

- `/danh-sach/phim-moi-cap-nhat?page=1`
- `/danh-sach?type=series&page=1&limit=24`
- `/danh-sach?type=single&page=1&limit=24`
- `/tim-kiem?keyword=avengers&page=1&limit=24`
- `/the-loai/hanh-dong?page=1&limit=24`
- `/quoc-gia/han-quoc?page=1&limit=24`
- `/nam/2025?page=1&limit=24`

```json
{
  "status": true,
  "items": [
    {
      "tmdb": {
        "type": "tv",
        "id": "66732",
        "season": 4,
        "vote_average": "8.5",
        "vote_count": 21461
      },
      "imdb": { "id": "tt4574334" },
      "modified": { "time": "2026-07-18T13:48:36+07:00" },
      "_id": 50530,
      "name": "Cậu bé mất tích - Phần 4",
      "origin_name": "Stranger Things - Season 4",
      "slug": "cau-be-mat-tich-p4",
      "poster_url": "https://vsmov.com/storage/images/...",
      "thumb_url": "https://vsmov.com/storage/images/...",
      "year": 2022
    }
  ],
  "pagination": {
    "totalItems": 17616,
    "totalItemsPerPage": 24,
    "currentPage": 1,
    "totalPages": 734
  }
}
```

Observed variations:

- `totalItemsPerPage` is a number on the latest endpoint and a numeric string
  on filtered/search endpoints.
- `tmdb.id`, `tmdb.season`, and `imdb.id` can be `null`.
- An empty search returns `items: []` with the same pagination envelope.
- The latest endpoint additionally returned `pathImage`.

## Movie detail response

`/phim/cau-be-mat-tich-p4` returned:

```json
{
  "status": true,
  "msg": "",
  "movie": {
    "_id": 50530,
    "name": "Cậu bé mất tích - Phần 4",
    "origin_name": "Stranger Things - Season 4",
    "slug": "cau-be-mat-tich-p4",
    "content": "...",
    "type": "series",
    "status": "completed",
    "poster_url": "https://vsmov.com/storage/images/...",
    "thumb_url": "https://vsmov.com/storage/images/...",
    "trailer_url": "https://www.youtube.com/watch?v=...",
    "time": "86 phút",
    "episode_current": "Hoàn Tất (9/9)",
    "episode_total": "9",
    "quality": "HD",
    "lang": "Vietsub + Thuyết Minh",
    "year": 2022,
    "actor": ["Winona Ryder"],
    "director": ["Matt Duffer"],
    "category": [{ "id": 17, "name": "Bí Ẩn", "slug": "bi-an" }],
    "country": [{ "id": 7, "name": "Âu Mỹ", "slug": "au-my" }]
  },
  "episodes": [
    {
      "server_name": "Thuyết minh #1",
      "server_data": [
        {
          "name": "1",
          "slug": "tap-1",
          "filename": "1",
          "link_embed": "https://v3.streamvsmov.com/video/..."
        }
      ]
    }
  ]
}
```

VSMOV episode rows do not include `link_m3u8`; playback is exposed through
`link_embed`. The requested trailer sample
`/phim/mau-xanh-cuoi-cung` returned the same detail shape with `episodes: []`.

## Metadata responses

`/the-loai`, `/quoc-gia`, and `/nam` returned:

```json
{
  "status": "success",
  "message": "",
  "data": {
    "items": [{ "_id": 85, "name": "Action & Adventure", "slug": "action-adventure" }]
  }
}
```

Genre and country IDs were numbers. Year metadata used numeric strings for
`_id`, `name`, and `slug`.
