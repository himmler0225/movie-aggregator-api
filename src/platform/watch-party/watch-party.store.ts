import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis';
import type {
  BufferingViewer,
  PlaybackStateMsg,
  PresencePayload,
  RoomControlState,
} from '../types';

const presenceKey = (roomCode: string) => `watchparty:presence:${roomCode}`;
const playbackKey = (roomCode: string) => `watchparty:playback:${roomCode}`;
const playbackSeqKey = (roomCode: string) =>
  `watchparty:playback:seq:${roomCode}`;
const controlKey = (roomCode: string) => `watchparty:control:${roomCode}`;
const bufferingKey = (roomCode: string) => `watchparty:buffering:${roomCode}`;
const autoPausedKey = (roomCode: string) => `watchparty:autopause:${roomCode}`;
const STATE_TTL_SECONDS = 24 * 3600;
// Assigns the seq and stores the state in one atomic step, so the stored
// state always carries the highest seq even when commits race across
// instances.
const COMMIT_PLAYBACK_SCRIPT = `
local seq = redis.call('INCR', KEYS[2])
local state = cjson.decode(ARGV[1])
state['seq'] = seq
redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return seq
`;

/**
 * Shared per-room watch-party state. Lives in Redis when configured so every
 * instance sees the same rooms; falls back to process memory otherwise.
 */
@Injectable()
export class WatchPartyStore {
  private readonly presenceByRoom = new Map<
    string,
    Map<string, PresencePayload>
  >();
  private readonly playbackByRoom = new Map<string, PlaybackStateMsg>();
  private readonly seqByRoom = new Map<string, number>();
  private readonly controlByRoom = new Map<string, RoomControlState>();
  private readonly bufferingByRoom = new Map<
    string,
    Map<string, BufferingViewer>
  >();
  private readonly autoPausedRooms = new Set<string>();
  constructor(private readonly redis: RedisService) {}

  async setPresence(
    roomCode: string,
    socketId: string,
    presence: PresencePayload,
  ) {
    const client = this.redis.getClient();
    if (client) {
      await client.hset(
        presenceKey(roomCode),
        socketId,
        JSON.stringify(presence),
      );
      return;
    }
    let room = this.presenceByRoom.get(roomCode);
    if (!room) {
      room = new Map();
      this.presenceByRoom.set(roomCode, room);
    }
    room.set(socketId, presence);
  }
  async removePresence(roomCode: string, socketId: string) {
    const client = this.redis.getClient();
    if (client) {
      await client.hdel(presenceKey(roomCode), socketId);
      return;
    }
    const room = this.presenceByRoom.get(roomCode);
    room?.delete(socketId);
    if (room?.size === 0) {
      // Last viewer left: the DB row already holds the latest state.
      this.presenceByRoom.delete(roomCode);
      this.playbackByRoom.delete(roomCode);
      this.seqByRoom.delete(roomCode);
      this.controlByRoom.delete(roomCode);
      this.bufferingByRoom.delete(roomCode);
      this.autoPausedRooms.delete(roomCode);
    }
  }
  async listPresence(roomCode: string): Promise<PresencePayload[]> {
    const client = this.redis.getClient();
    if (client) {
      const entries = await client.hgetall(presenceKey(roomCode));
      return Object.values(entries)
        .map((raw) => JSON.parse(raw) as PresencePayload)
        .sort((a, b) => a.joinedAt - b.joinedAt);
    }
    const room = this.presenceByRoom.get(roomCode);
    return room
      ? [...room.values()].sort((a, b) => a.joinedAt - b.joinedAt)
      : [];
  }

  async getPlayback(roomCode: string): Promise<PlaybackStateMsg | null> {
    const client = this.redis.getClient();
    if (client) {
      const raw = await client.get(playbackKey(roomCode));
      if (!raw) return null;
      const state = JSON.parse(raw) as Partial<PlaybackStateMsg>;
      // States written before isPlaying existed can't be trusted; use the DB.
      return typeof state.isPlaying === 'boolean'
        ? (state as PlaybackStateMsg)
        : null;
    }
    return this.playbackByRoom.get(roomCode) ?? null;
  }
  async commitPlayback(
    roomCode: string,
    state: Omit<PlaybackStateMsg, 'seq'>,
  ): Promise<PlaybackStateMsg> {
    const client = this.redis.getClient();
    if (client) {
      const seq = (await client.eval(
        COMMIT_PLAYBACK_SCRIPT,
        2,
        playbackKey(roomCode),
        playbackSeqKey(roomCode),
        JSON.stringify(state),
        STATE_TTL_SECONDS,
      )) as number;
      return { ...state, seq };
    }
    const seq = (this.seqByRoom.get(roomCode) ?? 0) + 1;
    this.seqByRoom.set(roomCode, seq);
    const stored = { ...state, seq };
    this.playbackByRoom.set(roomCode, stored);
    return stored;
  }

  async getControl(roomCode: string): Promise<RoomControlState | null> {
    const client = this.redis.getClient();
    if (client) {
      const raw = await client.get(controlKey(roomCode));
      return raw ? (JSON.parse(raw) as RoomControlState) : null;
    }
    return this.controlByRoom.get(roomCode) ?? null;
  }
  async setControl(roomCode: string, control: RoomControlState) {
    const client = this.redis.getClient();
    if (client) {
      await client.set(
        controlKey(roomCode),
        JSON.stringify(control),
        'EX',
        STATE_TTL_SECONDS,
      );
      return;
    }
    this.controlByRoom.set(roomCode, control);
  }

  /** Returns every viewer still buffering after the add. */
  async addBuffering(
    roomCode: string,
    socketId: string,
    viewer: BufferingViewer,
  ): Promise<BufferingViewer[]> {
    const client = this.redis.getClient();
    if (client) {
      await client
        .multi()
        .hset(bufferingKey(roomCode), socketId, JSON.stringify(viewer))
        .expire(bufferingKey(roomCode), STATE_TTL_SECONDS)
        .exec();
      return this.listBuffering(roomCode);
    }
    let room = this.bufferingByRoom.get(roomCode);
    if (!room) {
      room = new Map();
      this.bufferingByRoom.set(roomCode, room);
    }
    room.set(socketId, viewer);
    return [...room.values()];
  }
  /** Returns every viewer still buffering after the removal. */
  async removeBuffering(
    roomCode: string,
    socketId: string,
  ): Promise<BufferingViewer[]> {
    const client = this.redis.getClient();
    if (client) {
      await client.hdel(bufferingKey(roomCode), socketId);
      return this.listBuffering(roomCode);
    }
    const room = this.bufferingByRoom.get(roomCode);
    room?.delete(socketId);
    if (room?.size === 0) this.bufferingByRoom.delete(roomCode);
    return room ? [...room.values()] : [];
  }
  async listBuffering(roomCode: string): Promise<BufferingViewer[]> {
    const client = this.redis.getClient();
    if (client) {
      const entries = await client.hgetall(bufferingKey(roomCode));
      return Object.values(entries).map(
        (raw) => JSON.parse(raw) as BufferingViewer,
      );
    }
    const room = this.bufferingByRoom.get(roomCode);
    return room ? [...room.values()] : [];
  }

  /** Marks the room as paused by the server; true only for the caller that set it. */
  async markAutoPaused(roomCode: string): Promise<boolean> {
    const client = this.redis.getClient();
    if (client) {
      const res = await client.set(
        autoPausedKey(roomCode),
        '1',
        'EX',
        STATE_TTL_SECONDS,
        'NX',
      );
      return res === 'OK';
    }
    if (this.autoPausedRooms.has(roomCode)) return false;
    this.autoPausedRooms.add(roomCode);
    return true;
  }
  /** Clears the auto-pause mark; true only for the caller that cleared it. */
  async takeAutoPaused(roomCode: string): Promise<boolean> {
    const client = this.redis.getClient();
    if (client) {
      return (await client.del(autoPausedKey(roomCode))) === 1;
    }
    return this.autoPausedRooms.delete(roomCode);
  }

  async clearRoom(roomCode: string) {
    this.presenceByRoom.delete(roomCode);
    this.playbackByRoom.delete(roomCode);
    this.seqByRoom.delete(roomCode);
    this.controlByRoom.delete(roomCode);
    this.bufferingByRoom.delete(roomCode);
    this.autoPausedRooms.delete(roomCode);
    const client = this.redis.getClient();
    if (!client) return;
    await client.del(
      presenceKey(roomCode),
      playbackKey(roomCode),
      playbackSeqKey(roomCode),
      controlKey(roomCode),
      bufferingKey(roomCode),
      autoPausedKey(roomCode),
    );
  }
}
