# Watch Party — hướng dẫn tích hợp cho Frontend

Tài liệu này mô tả mọi thứ FE cần để làm phần xem chung: kết nối socket, đồng bộ phát, chờ buffer, quyền điều khiển, bình luận bay (danmaku), reaction + heatmap, hàng chờ tập, hẹn giờ và danh sách phòng công khai.

- REST: `http://<api>/api/...`, auth bằng header `Authorization: Bearer <access_token>` (trừ route ghi **Public**).
- Socket.IO: namespace `/watch-party`, token qua `auth.token`.
- Tên field REST dùng `snake_case`; payload socket client → server dùng `camelCase` (giữ như hiện tại).
- Lỗi REST trả key i18n (xem [Mã lỗi](#12-mã-lỗi)).

---

## 1. Kết nối socket

```ts
import { io } from 'socket.io-client';

export const wp = io(`${API_URL}/watch-party`, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

- Token sai hoặc thiếu → server ngắt kết nối ngay. Khi refresh token, tạo lại socket với token mới.
- **Nên giữ socket kết nối trong toàn app** (không chỉ trang phòng): server gửi `reminder:due` qua kênh cá nhân của user, kể cả khi họ chưa vào phòng nào.
- Mọi sự kiện client → server đều có ack. Luôn đọc ack để biết thành công hay không:

```ts
function emitAck<T = { ok: boolean }>(event: string, body: unknown) {
  return new Promise<T>((resolve) => wp.emit(event, body, resolve));
}
```

## 2. Vào phòng

1. Gọi REST `POST /api/watch-party/rooms/:roomId/join` với `{ username, avatar_url?, pin?, joined_message }` (bắt buộc với phòng riêng tư; nên gọi cho mọi phòng để được tính là thành viên).
2. Gọi socket `join`:

```ts
const res = await emitAck('join', {
  roomCode,
  presence: { userId, username, avatar_url, isHost: false, joinedAt: Date.now() },
});
// res: { ok: true } | { ok: false, error?: 'platform.notRoomMember' }
```

- `ok: false` khi phòng không tồn tại, hoặc phòng riêng tư mà user chưa là thành viên (chưa gọi bước 1).
- `userId` và `isHost` trong presence **do server quyết định** từ token, giá trị client gửi bị bỏ qua.

Ngay sau khi join, server gửi riêng cho socket vừa vào:

| Sự kiện | Dùng để |
|---|---|
| `playback:sync` | Vị trí và trạng thái phát hiện tại (`type` luôn là `PLAY` hoặc `PAUSE`) |
| `room:control` | Ai là host, co-host, chế độ điều khiển |
| `room:media` | Tập đang chiếu, hàng chờ, auto-next |
| `playback:waiting` | Chỉ gửi nếu phòng đang chờ ai đó buffer |

Và gửi cả phòng: `presence:join`, `presence:sync`.

Rời phòng: ngắt socket hoặc `join` phòng khác. Gọi `DELETE /api/watch-party/rooms/:roomId/members/me` nếu muốn bỏ tư cách thành viên.

## 3. Đồng bộ phát

### Kiểu dữ liệu

```ts
type PlaybackType = 'PLAY' | 'PAUSE' | 'SEEK';

interface PlaybackState {
  type: PlaybackType;
  time: number;        // giây, tại thời điểm updatedAt
  isPlaying: boolean;  // luôn dùng field này để biết phát hay dừng
  seq: number;         // tăng dần theo phòng
  updatedAt: number;   // epoch ms, giờ server
  auto?: true;         // server tự dừng/chạy vì chờ buffer
}
```

### Nhận

- `playback:sync` (lúc join), `playback:event` (mọi thay đổi), `playback:correct` (chỉ gửi riêng cho người bị lệch).
- **Bỏ qua** `playback:event` có `seq` ≤ `seq` lớn nhất đã áp dụng. Riêng `playback:sync` và `playback:correct` luôn áp dụng (sau khi join lại, `seq` có thể bắt đầu lại từ 0).
- Tính vị trí hiện tại:

```ts
function positionOf(s: PlaybackState, serverOffsetMs = 0) {
  if (!s.isPlaying) return s.time;
  const now = Date.now() + serverOffsetMs;
  return s.time + Math.max(0, now - s.updatedAt) / 1000;
}

function apply(s: PlaybackState) {
  video.currentTime = positionOf(s);
  s.isPlaying ? video.play() : video.pause();
}
```

- `SEEK` chỉ đổi vị trí, **không** đổi play/pause: dùng `isPlaying`.

### Gửi (chỉ người có quyền điều khiển, xem mục 5)

```ts
await emitAck('playback:event', { roomCode, type: 'PAUSE', time: video.currentTime });
```

- `time` phải là số hữu hạn ≥ 0; `type` ∈ `PLAY | PAUSE | SEEK`. Sai → `{ ok: false }`.
- Người không có quyền nhận `{ ok: false }`. Nên ẩn/khoá nút điều khiển dựa vào `room:control`.
- SEEK được server gộp trong 80 ms, nên có thể gửi liên tục khi kéo thanh tua.
- Đừng gửi lại sự kiện khi đang *áp dụng* một `playback:event` từ server (tránh vòng lặp): dùng cờ `applyingRemote`.

## 4. Chờ buffer và sửa lệch

Mỗi client **gửi `viewer:status` khoảng 5 giây/lần** và **ngay khi** video bắt đầu/hết buffer:

```ts
const report = (buffering: boolean) =>
  wp.emit('viewer:status', { roomCode, time: video.currentTime, buffering });

video.addEventListener('waiting', () => report(true));
video.addEventListener('playing', () => report(false));
setInterval(() => report(isBuffering(video)), 5000);
```

Server xử lý:

- Phòng đang phát và có người **bắt đầu** buffer → server tự `PAUSE` cả phòng (`playback:event` có `auto: true`) và gửi `playback:waiting`.
- Khi không còn ai buffer → server tự `PLAY` lại (`auto: true`).
- Mỗi người được chờ tối đa **15 giây**; sau đó phòng chạy tiếp và bỏ qua buffer của người đó trong **60 giây**.
- Người điều khiển bấm play/pause bằng tay trong lúc chờ → server **không** tự chạy lại nữa.
- Host tắt tính năng này bằng `wait_for_buffering: false` (mục 5).
- Khi báo `buffering: false`, nếu vị trí lệch quá **2 giây** so với phòng, server gửi riêng `playback:correct` (một `PlaybackState`) → tua về `positionOf(state)`.

```ts
wp.on('playback:waiting', ({ users }: { users: { userId: string; username: string; since: number }[] }) => {
  // users rỗng = hết chờ. Hiện: "Đang chờ Minh, Lan…"
});
```

Gợi ý UI: khi nhận `playback:event` có `auto: true` và `PAUSE`, hiện overlay "Đang chờ mọi người tải…" thay vì "Host đã tạm dừng".

## 5. Quyền điều khiển, co-host, chuyển host

```ts
interface RoomControl {
  host_id: string;
  co_host_ids: string[];
  control_mode: 'host' | 'everyone';
  wait_for_buffering: boolean;
}

const canControl = (c: RoomControl, me: string) =>
  c.control_mode === 'everyone' || c.host_id === me || c.co_host_ids.includes(me);
```

- Cập nhật từ sự kiện `room:control` (gửi lúc join và mỗi khi thay đổi). `presence:sync` cũng được server sửa `isHost` cho đúng.
- `host:changed`: `{ host_id, previous_host_id, username, reason: 'host_left' | 'transferred' }` → hiện thông báo "Minh giờ là chủ phòng".
- **Tự chuyển host:** host mất kết nối quá **30 giây** → quyền host chuyển cho co-host đang online, không có thì cho người vào phòng sớm nhất. Host quay lại trong 30 giây thì giữ quyền.

REST (chỉ host, trừ khi ghi khác):

| Method | Route | Body | Ghi chú |
|---|---|---|---|
| `PATCH` | `/api/watch-party/rooms/:roomId/settings` | `{ control_mode?, wait_for_buffering? }` | Trả `{ data: RoomControl }` |
| `PUT` | `/api/watch-party/rooms/:roomId/co-hosts/:userId` | — | Người đó phải là thành viên; tối đa 5 |
| `DELETE` | `/api/watch-party/rooms/:roomId/co-hosts/:userId` | — | |
| `POST` | `/api/watch-party/rooms/:roomId/host` | `{ user_id }` | Chuyển host; người đó phải là thành viên |

`PATCH /rooms/:roomId/playback` (REST cũ) giờ cho phép host, co-host, hoặc mọi người khi `control_mode = everyone`.

## 6. Chat và bình luận bay (danmaku)

### Chat trong phòng

`POST /api/watch-party/rooms/:roomId/messages`:

```json
{ "username": "Minh", "content": "Cảnh này đỉnh!", "playback_time": 1325.4, "as_danmaku": true }
```

- `playback_time` (tuỳ chọn): giây trong tập lúc gửi → trả về trong `message:created.playback_time` để hiện bay trên video của cả phòng.
- `as_danmaku: true` (tuỳ chọn, cần `playback_time`): lưu **công khai** thành bình luận bay của tập, người xem sau cũng thấy. Tối đa 200 ký tự (quá → `platform.danmakuTooLong`). Nên có toggle "Bắn lên phim" và mặc định tắt trong phòng riêng tư.

### Bình luận bay theo tập (dùng cả khi xem một mình)

| Method | Route | Ghi chú |
|---|---|---|
| `GET` **Public** | `/api/danmaku/movie/:slug?episode=<episode_name>&from=<s>&to=<s>&limit=<n>` | Sắp theo `playback_time`; `limit` mặc định 500, tối đa 1000; `to` không bao gồm |
| `POST` | `/api/danmaku` | `{ movie_slug, episode_name, playback_time, content }`, rate limit 20/phút |
| `DELETE` | `/api/danmaku/:id` | Chỉ xoá được bình luận của mình |

```ts
interface Danmaku {
  id: string; movie_slug: string; episode_name: string; playback_time: number;
  user_id: string; username: string | null; avatar_url: string | null;
  content: string; created_at: string;
}
```

Gợi ý tải: lấy theo cửa sổ 5 phút (`from = floor(t/300)*300`, `to = from + 300`), tải trước cửa sổ kế khi còn ~30 giây, tải lại khi tua. Hiển thị mỗi bình luận khi `currentTime` vượt `playback_time`, chạy ngang ~8 giây, chia làn để không chồng nhau. Có nút bật/tắt và thanh chỉnh độ mờ.

## 7. Reaction và heatmap khoảnh khắc hot

Danh sách emoji hợp lệ: `GET /api/moments/emojis` **Public** → `["🔥","😂","😱","😢","❤️","👏"]`. Emoji khác bị từ chối.

### Gửi reaction

- **Trong phòng** (socket): hiện ngay cho cả phòng và được tính vào heatmap.

```ts
await emitAck('reaction', { roomCode, emoji: '🔥', time: video.currentTime });
// Tối đa 1 reaction / 250 ms / socket; vượt → { ok: false }
wp.on('reaction', (r: { user_id: string; username: string | null; emoji: string; time: number }) => {
  // bay emoji lên màn hình
});
```

- **Xem một mình** (REST): `POST /api/moments/reactions` `{ movie_slug, episode_name, time, emoji }`, rate limit 60/phút.

Thay thế cho reaction gửi qua `broadcast` cũ: `broadcast` vẫn chạy nhưng **không** được tính vào heatmap.

### Heatmap

`GET /api/moments/movie/:slug/heatmap?episode=<episode_name>` **Public**:

```ts
interface HeatmapBucket {
  start: number;            // giây bắt đầu của đoạn
  reactions: number;
  danmaku: number;
  score: number;            // 0..1, đoạn hot nhất = 1
  top_emoji: string | null;
}
interface Heatmap {
  movie_slug: string;
  episode_name: string;
  bucket_seconds: number;   // hiện là 10
  buckets: HeatmapBucket[]; // chỉ các đoạn có hoạt động, sắp theo start
  hot_moments: HeatmapBucket[]; // tối đa 5 đoạn hot nhất, cách nhau ≥ 60 s, sắp theo start
}
```

- Điểm = reaction + 2 × số danmaku, chuẩn hoá theo đoạn cao nhất.
- Vẽ: chia thanh tua theo `duration / bucket_seconds` cột, cột không có trong `buckets` = 0; chiều cao ∝ `score`. Đánh dấu `hot_moments` bằng `top_emoji`, click để tua tới `start`.
- Dữ liệu trễ tối đa ~75 giây (gom 15 s + cache 60 s). Tải một lần khi mở tập là đủ.

## 8. Hàng chờ tập và tự sang tập kế

```ts
interface EpisodeQueueItem { episode_name: string; server_index: number }
interface RoomMedia {
  episode_name: string | null;
  server_index: number;
  episode_queue: EpisodeQueueItem[];
  auto_next: boolean;
}
```

- `episode_name` phải **cùng kiểu giá trị** phòng đang dùng: `name` (vd. `"Tập 3"`) hoặc `slug` (vd. `"tap-3"`) trong `episodes[server_index].server_data[]` của API chi tiết phim. Chọn một kiểu và dùng thống nhất.
- `room:media` gửi lúc join và mỗi khi tập/hàng chờ đổi.

### Đổi tập (người điều khiển)

```ts
await emitAck('episode:change', { roomCode, episodeName: 'Tập 5', serverIndex: 0 });
```

Server lưu tập mới, bỏ tập đó khỏi hàng chờ (nếu có), rồi gửi cả phòng:

1. `room:media` và `episode:changed` (`RoomMedia & { reason: 'manual' | 'auto_next' }`) → **tải nguồn tập mới**.
2. `playback:event` với `time: 0` (giữ play/pause hiện tại; với auto-next là `PLAY`).

Khi mọi người đang tải tập mới, cơ chế chờ buffer (mục 4) tự giữ phòng lại cho tới khi ai cũng sẵn sàng.

### Hết tập

Mọi client gửi khi video kết thúc (server tự bỏ trùng):

```ts
video.addEventListener('ended', () =>
  emitAck<{ ok: boolean; advanced?: boolean }>('episode:ended', { roomCode, episodeName: currentEpisode }),
);
```

Nếu `auto_next` bật: chuyển sang phần tử đầu hàng chờ; hàng chờ trống thì tự tìm tập kế tiếp trên cùng server trong danh sách tập của phim. Hết phim thì không làm gì (`advanced: false`) → FE có thể hiện "Đã hết phim".

### Sửa hàng chờ

`PUT /api/watch-party/rooms/:roomId/queue` (người điều khiển), tối đa 50 tập:

```json
{ "items": [{ "episode_name": "Tập 6", "server_index": 0 }], "auto_next": true }
```

Trả `{ data: { episode_queue, auto_next } }` và phát `room:media` cho cả phòng. Tạo phòng cũng nhận `episode_queue` và `auto_next`.

`PATCH /rooms/:roomId/playback` đổi `episode_name`/`server_index` cũng phát `episode:changed` (`reason: 'manual'`).

## 9. Hẹn giờ xem chung

### Tạo phòng hẹn giờ

`POST /api/watch-party/rooms` nhận thêm:

| Field | Ghi chú |
|---|---|
| `scheduled_at` | ISO 8601, ở tương lai và trong vòng 7 ngày (sai → `platform.invalidSchedule`) |
| `title` | Tên buổi xem, ≤ 100 ký tự |
| `episode_queue`, `auto_next` | Xem mục 8 |
| `control_mode`, `wait_for_buffering` | Xem mục 4–5 |

Phòng hẹn giờ hết hạn sau `expires_hours` **tính từ giờ bắt đầu**. Người dùng vẫn vào phòng và chat trước giờ bắt đầu được.

### Đếm ngược

Các response có `server_time` (ISO). Tính độ lệch đồng hồ một lần rồi đếm ngược:

```ts
const serverOffsetMs = Date.parse(res.server_time) - Date.now();
const msLeft = Date.parse(room.scheduled_at!) - (Date.now() + serverOffsetMs);
```

Tới giờ, server gửi `room:starting` `{ scheduled_at, server_time }` cho mọi người trong phòng → tắt đếm ngược, gợi ý host bấm phát.

### Nhắc giờ

| Method | Route | Ghi chú |
|---|---|---|
| `PUT` | `/api/watch-party/rooms/:roomId/reminder` | Bật nhắc; phòng phải có `scheduled_at` ở tương lai (sai → `platform.roomNotScheduled`) |
| `DELETE` | `/api/watch-party/rooms/:roomId/reminder` | Tắt nhắc |
| `GET` | `/api/watch-party/reminders/me` | `{ data: [{ room: WatchRoom, notified_at }], server_time }` — các buổi sắp tới user đã bật nhắc |

- Trước giờ bắt đầu **5 phút**, server gửi `reminder:due` qua kênh cá nhân (cần socket đang kết nối, mục 1):

```ts
wp.on('reminder:due', (r: { room: WatchRoom; starts_in_seconds: number; server_time: string }) => {
  // toast "Buổi xem 'Cày One Piece' bắt đầu sau 5 phút" + nút Vào phòng
});
```

- Nhắc được gửi **một lần** cho mỗi người. Nếu user không mở app lúc đó thì không nhận được qua socket; để chắc chắn, FE nên gọi `GET /reminders/me` khi mở app và tự đặt thông báo cục bộ (Notification API / service worker) cho các buổi còn lại.

## 10. Danh sách phòng công khai

`GET /api/watch-party/rooms/public?status=live|upcoming&limit=20` **Public** (`limit` ≤ 50):

- `live`: phòng công khai đang có người xem (không tính phòng hẹn giờ chưa tới giờ), sắp theo `viewer_count` giảm dần.
- `upcoming`: phòng công khai có `scheduled_at` sắp tới (và tới 10 phút sau giờ bắt đầu), sắp theo giờ bắt đầu.

```ts
interface PublicRoom extends WatchRoom {
  viewer_count: number;   // số kết nối đang trong phòng
  reminder_count: number; // số người đã bật nhắc
}
// response: { data: PublicRoom[]; server_time: string }
```

Gợi ý: tab "Đang xem" và "Sắp chiếu" trên trang chủ; tải lại mỗi 30–60 giây; nút "Nhắc tôi" gọi `PUT .../reminder`.

## 11. Kiểu `WatchRoom` (REST)

```ts
interface WatchRoom {
  id: string; code: string; host_id: string;
  movie_slug: string; movie_name: string | null; thumb_url: string | null;
  episode_name: string | null; server_index: number;
  playback_time: number; is_playing: boolean;
  is_private: boolean; has_pin: boolean;
  control_mode: 'host' | 'everyone'; co_host_ids: string[]; wait_for_buffering: boolean;
  episode_queue: EpisodeQueueItem[]; auto_next: boolean;
  scheduled_at: string | null; title: string | null;
  created_at: string; expires_at: string;
}
```

## 12. Mã lỗi

| Key | Khi nào |
|---|---|
| `platform.roomNotFound` | Phòng không tồn tại |
| `platform.notRoomMember` | Chưa là thành viên phòng riêng tư |
| `platform.onlyHostPlayback` | Không có quyền điều khiển phát / hàng chờ |
| `platform.onlyHostSettings` | Chỉ host được đổi cài đặt, co-host, chuyển host |
| `platform.targetNotMember` | Người được chọn chưa là thành viên phòng |
| `platform.tooManyCoHosts` | Đã đủ 5 co-host |
| `platform.cannotTargetSelf` | Tự chọn chính mình |
| `platform.danmakuTooLong` | Bình luận bay > 200 ký tự |
| `platform.danmakuNotFound` | Không tìm thấy bình luận (hoặc không phải của mình) |
| `platform.invalidSchedule` | `scheduled_at` ở quá khứ hoặc quá 7 ngày |
| `platform.roomNotScheduled` | Bật nhắc cho phòng không có lịch sắp tới |

Rate limit vượt ngưỡng trả HTTP 429.

## 13. Bảng tổng hợp sự kiện socket

| Client → server | Payload | Ack |
|---|---|---|
| `join` | `{ roomCode, presence }` | `{ ok, error? }` |
| `broadcast` | `{ roomCode, event, payload }` | `{ ok }` |
| `playback:event` | `{ roomCode, type, time }` | `{ ok }` |
| `viewer:status` | `{ roomCode, time, buffering }` | `{ ok }` |
| `episode:change` | `{ roomCode, episodeName, serverIndex? }` | `{ ok }` |
| `episode:ended` | `{ roomCode, episodeName }` | `{ ok, advanced }` |
| `reaction` | `{ roomCode, emoji, time }` | `{ ok }` |

| Server → client | Payload |
|---|---|
| `presence:sync` / `presence:join` / `presence:leave` | Danh sách / người vào / người ra |
| `playback:sync` / `playback:event` / `playback:correct` | `PlaybackState` |
| `playback:waiting` | `{ users }` |
| `room:control` | `RoomControl` |
| `host:changed` | `{ host_id, previous_host_id, username, reason }` |
| `room:media` | `RoomMedia` |
| `episode:changed` | `RoomMedia & { reason }` |
| `reaction` | `{ user_id, username, emoji, time }` |
| `message:created` | Tin nhắn (có `playback_time`) |
| `broadcast` | `{ event, payload }` |
| `room:starting` | `{ scheduled_at, server_time }` |
| `reminder:due` | `{ room, starts_in_seconds, server_time }` (kênh cá nhân) |
| `room:closed` | `{}` |

## 14. Checklist cho FE

- [ ] Socket kết nối toàn app, tạo lại khi đổi token
- [ ] Gọi REST join trước socket `join`; xử lý `ok: false`
- [ ] Áp dụng `playback:*` theo `seq` và `isPlaying`; không phát lại sự kiện đang áp dụng
- [ ] Gửi `viewer:status` định kỳ và khi `waiting`/`playing`; overlay chờ buffer
- [ ] Ẩn/khoá điều khiển theo `room:control`; UI co-host, chuyển host, cài đặt phòng
- [ ] Toggle "Bắn lên phim" trong chat; lớp danmaku có bật/tắt
- [ ] Nút reaction qua socket `reaction` (hoặc REST khi xem một mình)
- [ ] Heatmap trên thanh tua + đánh dấu hot moments
- [ ] Gửi `episode:ended`; tải nguồn khi `episode:changed`; UI hàng chờ + công tắc auto-next
- [ ] Form tạo phòng có giờ hẹn, tên buổi, hàng chờ; đếm ngược theo `server_time`
- [ ] Nút "Nhắc tôi", toast `reminder:due`, thông báo cục bộ từ `GET /reminders/me`
- [ ] Trang danh sách phòng "Đang xem" / "Sắp chiếu"
