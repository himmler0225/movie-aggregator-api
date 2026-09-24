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
  profiles/ favorites/ comments/ danmaku/ ratings/
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
| `PATCH /api/watch-party/rooms/:roomId/settings` | Host đổi `control_mode` (`host`/`everyone`), `wait_for_buffering` |
| `PUT` / `DELETE /api/watch-party/rooms/:roomId/co-hosts/:userId` | Host thêm/bớt đồng chủ phòng (tối đa 5, phải là thành viên) |
| `POST /api/watch-party/rooms/:roomId/host` | Host chuyển quyền host: `{ user_id }` |
| `GET /api/danmaku/movie/:slug?episode=&from=&to=&limit=` | Bình luận bay của một tập, theo khoảng giây (tối đa 1000) |
| `POST /api/danmaku` | Bắn bình luận bay: `{ movie_slug, episode_name, playback_time, content }` (≤ 200 ký tự) |
| `DELETE /api/danmaku/:id` | Xoá bình luận bay của mình |
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
| `join` | `{ roomCode, presence }` — phòng riêng tư yêu cầu là thành viên; `userId`/`isHost` lấy từ token |
| `broadcast` | `{ roomCode, event, payload }` — chỉ vào phòng đã `join` |
| `playback:event` | `{ roomCode, type: PLAY\|PAUSE\|SEEK, time }` — host, đồng chủ phòng, hoặc mọi người nếu `control_mode = everyone` |
| `viewer:status` | `{ roomCode, time, buffering }` — gửi mỗi ~5 giây và ngay khi bắt đầu/hết buffer |

| Event (server → client) | Mô tả |
|-------------------------|-------|
| `presence:sync` | Danh sách online (`isHost` do server tính) |
| `presence:join` / `presence:leave` | Ai vào/ra |
| `broadcast` | Sự kiện tuỳ ý từ client khác |
| `playback:sync` | Trạng thái phát khi vừa join (`type` luôn là PLAY/PAUSE) |
| `playback:event` | `{ type, time, isPlaying, seq, updatedAt, auto? }` — `auto: true` khi server tự dừng/chạy vì chờ buffer |
| `playback:correct` | Gửi riêng cho người lệch quá 2 giây: tua về `time` |
| `playback:waiting` | `{ users: [{ userId, username, since }] }` — ai đang được chờ buffer |
| `room:control` | `{ host_id, co_host_ids, control_mode, wait_for_buffering }` |
| `host:changed` | `{ host_id, previous_host_id, username, reason: host_left\|transferred }` |
| `message:created` | Chat mới (có `playback_time` nếu client gửi kèm) |
| `room:closed` | Host đóng phòng |

Hành vi:

- **Chờ buffer:** khi phòng đang phát và một người báo `buffering: true`, server tự PAUSE cả phòng; khi không còn ai buffer, server tự PLAY lại. Mỗi người được chờ tối đa 15 giây, sau đó bị bỏ qua 60 giây. Người điều khiển bấm play/pause bằng tay sẽ huỷ việc tự chạy lại. Tắt bằng `wait_for_buffering = false`.
- **Tự chuyển host:** host mất kết nối quá 30 giây thì quyền host chuyển cho đồng chủ phòng đang online, nếu không có thì cho người vào phòng sớm nhất.
- **Bình luận bay trong phòng:** `POST /api/watch-party/rooms/:roomId/messages` nhận thêm `playback_time` và `as_danmaku: true` để lưu công khai vào tập phim (giữ lại cả khi phòng bị xoá).

Auth: JWT qua `handshake.auth.token`
