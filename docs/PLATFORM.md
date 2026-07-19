# Platform API (PostgreSQL + Prisma)

Backend xử lý toàn bộ logic user data (auth, favorites, comments, watch party, admin) qua PostgreSQL.

## Setup

```bash
# 1. PostgreSQL
createdb kkflix
# hoặc Docker:
# docker run -d --name kkflix-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kkflix -p 5432:5432 postgres:16

# 2. Env
cp .env.example .env
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kkflix

# 3. Migrate
yarn prisma:migrate

# 4. Run
yarn start:dev
```

## Kiến trúc

```
src/database/
  base/base.repository.ts    # Abstract CRUD + countSince/countBetween/paginate
  repositories/*.repository.ts  # Mỗi model extends BaseRepository
src/platform/
  auth/          # JWT auth
  profiles/ favorites/ comments/ ratings/
  watch-history/ watchlists/ watch-party/ admin/
```

## API

| Prefix | Mô tả |
|--------|-------|
| `POST /api/auth/register` | Đăng ký |
| `POST /api/auth/login` | Đăng nhập → JWT |
| `GET /api/auth/session` | Session hiện tại (Bearer token) |
| `GET /api/favorites` | Yêu thích |
| `GET /api/comments/movie/:slug` | Bình luận |
| `GET /api/watch-party/rooms/:code` | Watch party |
| `GET /api/admin/*` | Admin (role=admin) |

## Google OAuth

1. Tạo OAuth Client tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. **Authorized redirect URI:** `http://localhost:3001/api/auth/google/callback`
3. Điền `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   FRONTEND_URL=http://localhost:5173
   API_PUBLIC_URL=http://localhost:3001
   ```

Flow: FE → `GET /api/auth/google` → Google → `GET /api/auth/google/callback` → redirect FE `/auth/callback#access_token=...`

## WebSocket (Watch Party)

Namespace: `ws://localhost:3001/watch-party` (Socket.io)

| Event (client → server) | Mô tả |
|-------------------------|-------|
| `join` | `{ roomCode, presence }` |
| `broadcast` | `{ roomCode, event, payload }` |

| Event (server → client) | Mô tả |
|-------------------------|-------|
| `presence:sync` | Danh sách online |
| `presence:join` / `presence:leave` | Ai vào/ra |
| `broadcast` | PLAY/PAUSE/SEEK/STATE/... |
| `message:created` | Chat mới |
| `room:closed` | Host đóng phòng |

Auth: JWT qua `handshake.auth.token`
