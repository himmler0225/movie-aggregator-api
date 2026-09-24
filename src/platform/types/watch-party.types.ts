export interface CreateRoomInput {
  code: string;
  hostId: string;
  hostRole: string;
  movieSlug: string;
  movieName: string;
  thumbUrl?: string | null;
  episodeName: string;
  serverIndex: number;
  expiresHours?: number;
  isPrivate?: boolean;
  pin?: string | null;
  controlMode?: RoomControlMode;
  waitForBuffering?: boolean;
  scheduledAt?: Date | null;
  title?: string | null;
  episodeQueue?: EpisodeQueueItem[];
  autoNext?: boolean;
}

export interface UpdatePlaybackState {
  playbackTime: number;
  isPlaying: boolean;
  episodeName: string;
  serverIndex: number;
}

export interface InsertMessageInput {
  roomId: string;
  userId: string;
  username: string;
  content: string;
  type?: string;
  avatarUrl?: string | null;
  playbackTime?: number | null;
  asDanmaku?: boolean;
}

export interface AddRoomMemberInput {
  roomId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface PresencePayload {
  userId: string;
  username: string;
  avatar_url: string | null;
  isHost: boolean;
  joinedAt: number;
}

export interface WatchRoomView {
  id: string;
  code: string;
  host_id: string;
  movie_slug: string;
  movie_name: string | null;
  thumb_url: string | null;
  episode_name: string | null;
  server_index: number;
  playback_time: number;
  is_playing: boolean;
  is_private: boolean;
  has_pin: boolean;
  control_mode: RoomControlMode;
  co_host_ids: string[];
  wait_for_buffering: boolean;
  episode_queue: EpisodeQueueItem[];
  auto_next: boolean;
  scheduled_at: string | null;
  title: string | null;
  created_at: string;
  expires_at: string;
}

export interface RoomMessageView {
  id: string;
  room_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  type: string;
  playback_time: number | null;
  created_at: string;
}

export interface RoomMemberView {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  joined_at: string;
}

export interface JoinWsPayload {
  roomCode: string;
  presence: PresencePayload;
}

export interface BroadcastWsPayload {
  roomCode: string;
  event: string;
  payload: Record<string, unknown>;
}

export type PlaybackEventType = 'PLAY' | 'PAUSE' | 'SEEK';

export interface PlaybackEventWsPayload {
  roomCode: string;
  type: PlaybackEventType;
  time: number;
}

export interface PlaybackStateMsg {
  type: PlaybackEventType;
  time: number;
  isPlaying: boolean;
  seq: number;
  updatedAt: number;
  /** Set when the server paused/resumed on its own to wait for buffering viewers. */
  auto?: boolean;
}

export interface ViewerStatusWsPayload {
  roomCode: string;
  time: number;
  buffering: boolean;
}

export interface BufferingViewer {
  userId: string;
  username: string;
  since: number;
}

export type RoomControlMode = 'host' | 'everyone';

export interface RoomControlState {
  hostId: string;
  coHostIds: string[];
  controlMode: RoomControlMode;
  waitForBuffering: boolean;
}

export interface RoomControlMsg {
  host_id: string;
  co_host_ids: string[];
  control_mode: RoomControlMode;
  wait_for_buffering: boolean;
}

export interface UpdateRoomSettingsInput {
  controlMode?: RoomControlMode;
  waitForBuffering?: boolean;
}

export interface GatewaySocketData {
  userId?: string;
  roomCode?: string;
  roomId?: string;
  presence?: PresencePayload;
}

export interface DanmakuView {
  id: string;
  movie_slug: string;
  episode_name: string;
  playback_time: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

export interface CreateDanmakuInput {
  userId: string;
  movieSlug: string;
  episodeName: string;
  playbackTime: number;
  content: string;
  username?: string | null;
  avatarUrl?: string | null;
  roomId?: string | null;
}

export interface ListDanmakuInput {
  movieSlug: string;
  episodeName: string;
  from?: number;
  to?: number;
  limit?: number;
}

export interface EpisodeQueueItem {
  episode_name: string;
  server_index: number;
}

export interface RoomMediaState {
  movieSlug: string;
  episodeName: string | null;
  serverIndex: number;
  queue: EpisodeQueueItem[];
  autoNext: boolean;
}

export type EpisodeChangeReason = 'manual' | 'auto_next';

export interface RoomMediaMsg {
  episode_name: string | null;
  server_index: number;
  episode_queue: EpisodeQueueItem[];
  auto_next: boolean;
}

export interface EpisodeChangeWsPayload {
  roomCode: string;
  episodeName: string;
  serverIndex?: number;
}

export interface EpisodeEndedWsPayload {
  roomCode: string;
  episodeName: string;
}

export interface ReactionWsPayload {
  roomCode: string;
  emoji: string;
  time: number;
}

export interface UpdateQueueInput {
  items: EpisodeQueueItem[];
  autoNext?: boolean;
}

export type PublicRoomStatus = 'live' | 'upcoming';

export interface PublicRoomView extends WatchRoomView {
  viewer_count: number;
  reminder_count: number;
}

export interface HeatmapBucketView {
  start: number;
  reactions: number;
  danmaku: number;
  score: number;
  top_emoji: string | null;
}

export interface HeatmapView {
  movie_slug: string;
  episode_name: string;
  bucket_seconds: number;
  buckets: HeatmapBucketView[];
  hot_moments: HeatmapBucketView[];
}

export interface RecordReactionInput {
  movieSlug: string;
  episodeName: string;
  time: number;
  emoji: string;
}
