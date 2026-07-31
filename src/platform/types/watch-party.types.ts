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

export interface GatewaySocketData {
  userId?: string;
  roomCode?: string;
  presence?: PresencePayload;
}
