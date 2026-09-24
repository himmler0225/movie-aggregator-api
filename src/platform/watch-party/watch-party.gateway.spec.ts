import type { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { AppConfigService } from '../../config';
import type { RoomMembersRepository } from '../../database/repositories/room-members.repository';
import type { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import type { RedisService } from '../../infra/redis';
import type {
  GatewaySocketData,
  PlaybackStateMsg,
  PresencePayload,
} from '../types';
import { currentPlaybackTime, WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyStore } from './watch-party.store';

const HOST_ID = 'host-1';

interface FakeRoom {
  id: string;
  code: string;
  hostId: string;
  coHostIds: string[];
  controlMode: string;
  waitForBuffering: boolean;
  isPrivate: boolean;
  playbackTime: number;
  isPlaying: boolean;
}

function makeRoom(code: string, overrides: Partial<FakeRoom> = {}): FakeRoom {
  return {
    id: `id-${code}`,
    code,
    hostId: HOST_ID,
    coHostIds: [],
    controlMode: 'host',
    waitForBuffering: true,
    isPrivate: false,
    playbackTime: 0,
    isPlaying: false,
    ...overrides,
  };
}

function setup(roomOverrides: Partial<FakeRoom> = {}) {
  const roomRows = new Map<string, FakeRoom>([
    ['AAAA', makeRoom('AAAA', roomOverrides)],
    ['BBBB', makeRoom('BBBB')],
  ]);
  const memberIds = new Set<string>();
  const rooms = {
    findByCode: jest.fn((code: string) =>
      Promise.resolve(roomRows.get(code.toUpperCase()) ?? null),
    ),
    findById: jest.fn((id: string) =>
      Promise.resolve([...roomRows.values()].find((r) => r.id === id) ?? null),
    ),
    updateMany: jest.fn(
      (where: Partial<FakeRoom>, data: Partial<FakeRoom>): Promise<number> => {
        const row = [...roomRows.values()].find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof FakeRoom] === v),
        );
        if (row) Object.assign(row, data);
        return Promise.resolve(row ? 1 : 0);
      },
    ),
  };
  const members = {
    isMember: jest.fn((_roomId: string, userId: string) =>
      Promise.resolve(memberIds.has(userId) ? { userId } : null),
    ),
  };
  const redis = { getClient: () => null } as unknown as RedisService;
  const store = new WatchPartyStore(redis);
  const gateway = new WatchPartyGateway(
    {} as JwtService,
    {} as AppConfigService,
    redis,
    rooms as unknown as WatchRoomsRepository,
    members as unknown as RoomMembersRepository,
    store,
  );
  const emitted: { room: string; event: string; payload: unknown }[] = [];
  gateway.server = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) =>
        emitted.push({ room, event, payload }),
    }),
  } as unknown as Server;
  const eventsOf = <T>(event: string) =>
    emitted.filter((e) => e.event === event).map((e) => e.payload as T);
  return { gateway, rooms, members, memberIds, roomRows, store, eventsOf };
}

interface FakeSocket {
  socket: Socket;
  sent: { event: string; payload: unknown }[];
}

function makeSocket(userId: string, id = `sock-${userId}`): FakeSocket {
  const sent: { event: string; payload: unknown }[] = [];
  const data: GatewaySocketData = { userId };
  const socket = {
    id,
    data,
    join: jest.fn(),
    leave: jest.fn(),
    emit: (event: string, payload: unknown) => sent.push({ event, payload }),
    to: () => ({ emit: jest.fn() }),
  } as unknown as Socket;
  return { socket, sent };
}

const presence = (userId: string, joinedAt: number): PresencePayload => ({
  userId,
  username: userId,
  avatar_url: null,
  isHost: false,
  joinedAt,
});

async function join(
  gateway: WatchPartyGateway,
  userId: string,
  joinedAt = Date.now(),
  roomCode = 'AAAA',
) {
  const s = makeSocket(userId);
  const result = await gateway.handleJoin(s.socket, {
    roomCode,
    presence: presence(userId, joinedAt),
  });
  return { ...s, result };
}

describe('WatchPartyGateway', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('playback control', () => {
    it('rejects events for a room other than the one the host joined', async () => {
      const { gateway, rooms } = setup();
      const host = await join(gateway, HOST_ID);
      const result = await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'BBBB',
        type: 'PAUSE',
        time: 0,
      });
      expect(result).toEqual({ ok: false });
      expect(rooms.updateMany).not.toHaveBeenCalled();
    });

    it('rejects unknown types and non-finite or negative times', async () => {
      const { gateway, rooms } = setup();
      const host = await join(gateway, HOST_ID);
      const bad = [
        { type: 'STOP', time: 1 },
        { type: 'PLAY', time: Infinity },
        { type: 'PLAY', time: -5 },
        { type: 'PLAY', time: 'abc' },
      ];
      for (const b of bad) {
        const result = await gateway.handlePlaybackEvent(host.socket, {
          roomCode: 'AAAA',
          ...b,
        } as never);
        expect(result).toEqual({ ok: false });
      }
      expect(rooms.updateMany).not.toHaveBeenCalled();
    });

    it('lets co-hosts control but not regular viewers', async () => {
      const { gateway } = setup({ coHostIds: ['co-1'] });
      const co = await join(gateway, 'co-1');
      const viewer = await join(gateway, 'viewer-1');
      const play = { roomCode: 'AAAA', type: 'PLAY', time: 1 } as const;
      await expect(
        gateway.handlePlaybackEvent(co.socket, play),
      ).resolves.toEqual({ ok: true });
      await expect(
        gateway.handlePlaybackEvent(viewer.socket, play),
      ).resolves.toEqual({ ok: false });
    });

    it('lets everyone control when the room allows it', async () => {
      const { gateway } = setup({ controlMode: 'everyone' });
      const viewer = await join(gateway, 'viewer-1');
      await expect(
        gateway.handlePlaybackEvent(viewer.socket, {
          roomCode: 'AAAA',
          type: 'PLAY',
          time: 1,
        }),
      ).resolves.toEqual({ ok: true });
    });

    it('keeps the paused state across a seek', async () => {
      const { gateway, rooms, eventsOf } = setup();
      const host = await join(gateway, HOST_ID);
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'PAUSE',
        time: 100,
      });
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'SEEK',
        time: 600,
      });
      await jest.advanceTimersByTimeAsync(100);
      const last = eventsOf<PlaybackStateMsg>('playback:event').at(-1);
      expect(last).toMatchObject({
        type: 'SEEK',
        time: 600,
        isPlaying: false,
      });
      expect(rooms.updateMany).toHaveBeenLastCalledWith(
        { id: 'id-AAAA' },
        { playbackTime: 600, isPlaying: false },
      );
    });

    it('commits a pending seek before a following pause, in order', async () => {
      const { gateway, eventsOf } = setup();
      const host = await join(gateway, HOST_ID);
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'SEEK',
        time: 1200,
      });
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'PAUSE',
        time: 1200,
      });
      await jest.advanceTimersByTimeAsync(100);
      expect(
        eventsOf<PlaybackStateMsg>('playback:event').map((e) => [
          e.type,
          e.time,
          e.seq,
        ]),
      ).toEqual([
        ['SEEK', 1200, 1],
        ['PAUSE', 1200, 2],
      ]);
    });

    it('does not reject when persisting a debounced seek fails', async () => {
      const { gateway, rooms } = setup();
      const host = await join(gateway, HOST_ID);
      rooms.updateMany.mockRejectedValueOnce(new Error('db down'));
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'SEEK',
        time: 10,
      });
      await jest.advanceTimersByTimeAsync(100);
      await expect(
        gateway.handlePlaybackEvent(host.socket, {
          roomCode: 'AAAA',
          type: 'PLAY',
          time: 10,
        }),
      ).resolves.toEqual({ ok: true });
    });

    it('forgets cached playback when the room is cleared', async () => {
      const { gateway, store } = setup();
      const host = await join(gateway, HOST_ID);
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'PLAY',
        time: 50,
      });
      await gateway.clearRoomState('aaaa');
      await gateway.applyPlaybackUpdate('AAAA', 'id-AAAA', 5, false);
      await expect(store.getPlayback('AAAA')).resolves.toMatchObject({
        seq: 1,
        time: 5,
      });
    });
  });

  describe('join', () => {
    it('keeps non-members out of private rooms', async () => {
      const { gateway, memberIds } = setup({ isPrivate: true });
      const outsider = await join(gateway, 'viewer-1');
      expect(outsider.result).toMatchObject({ ok: false });
      memberIds.add('viewer-2');
      const member = await join(gateway, 'viewer-2');
      expect(member.result).toEqual({ ok: true });
    });

    it('takes identity from the token, not the client payload', async () => {
      const { gateway, store } = setup();
      const s = makeSocket('viewer-1');
      await gateway.handleJoin(s.socket, {
        roomCode: 'AAAA',
        presence: { ...presence(HOST_ID, 1), isHost: true },
      });
      const [p] = await store.listPresence('AAAA');
      expect(p).toMatchObject({ userId: 'viewer-1', isHost: false });
    });
  });

  describe('broadcast', () => {
    it('only broadcasts into the room the socket joined', async () => {
      const { gateway } = setup();
      const viewer = await join(gateway, 'viewer-1');
      const sentTo: string[] = [];
      (viewer.socket as unknown as { to: unknown }).to = (room: string) => ({
        emit: () => sentTo.push(room),
      });
      expect(
        gateway.handleBroadcast(viewer.socket, {
          roomCode: 'BBBB',
          event: 'reaction',
          payload: {},
        }),
      ).toEqual({ ok: false });
      expect(
        gateway.handleBroadcast(viewer.socket, {
          roomCode: 'aaaa',
          event: 'reaction',
          payload: {},
        }),
      ).toEqual({ ok: true });
      expect(sentTo).toEqual(['AAAA']);
    });
  });

  describe('buffering', () => {
    async function playingRoom(roomOverrides: Partial<FakeRoom> = {}) {
      const ctx = setup(roomOverrides);
      const host = await join(ctx.gateway, HOST_ID);
      const viewer = await join(ctx.gateway, 'viewer-1');
      await ctx.gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'PLAY',
        time: 100,
      });
      return { ...ctx, host, viewer };
    }
    const status = (buffering: boolean, time = 100) => ({
      roomCode: 'AAAA',
      time,
      buffering,
    });

    it('pauses the room while a viewer buffers and resumes after', async () => {
      const { gateway, viewer, eventsOf } = await playingRoom();
      await gateway.handleViewerStatus(viewer.socket, status(true));
      expect(eventsOf<PlaybackStateMsg>('playback:event').at(-1)).toMatchObject(
        { type: 'PAUSE', isPlaying: false, auto: true },
      );
      expect(
        eventsOf<{ users: unknown[] }>('playback:waiting').at(-1)?.users,
      ).toHaveLength(1);
      await gateway.handleViewerStatus(viewer.socket, status(false));
      expect(eventsOf<PlaybackStateMsg>('playback:event').at(-1)).toMatchObject(
        { type: 'PLAY', isPlaying: true, auto: true },
      );
      expect(
        eventsOf<{ users: unknown[] }>('playback:waiting').at(-1)?.users,
      ).toHaveLength(0);
    });

    it('does not auto-resume after someone paused by hand', async () => {
      const { gateway, host, viewer, eventsOf } = await playingRoom();
      await gateway.handleViewerStatus(viewer.socket, status(true));
      await gateway.handlePlaybackEvent(host.socket, {
        roomCode: 'AAAA',
        type: 'PAUSE',
        time: 100,
      });
      await gateway.handleViewerStatus(viewer.socket, status(false));
      const last = eventsOf<PlaybackStateMsg>('playback:event').at(-1);
      expect(last).toMatchObject({ type: 'PAUSE' });
      expect(last?.auto).toBeUndefined();
    });

    it('does nothing when the room turned waiting off', async () => {
      const { gateway, viewer, eventsOf } = await playingRoom({
        waitForBuffering: false,
      });
      await gateway.handleViewerStatus(viewer.socket, status(true));
      expect(eventsOf<PlaybackStateMsg>('playback:event').at(-1)).toMatchObject(
        { type: 'PLAY' },
      );
    });

    it('stops waiting for a slow viewer and ignores them for a while', async () => {
      const { gateway, viewer, eventsOf } = await playingRoom();
      await gateway.handleViewerStatus(viewer.socket, status(true));
      await jest.advanceTimersByTimeAsync(15_000);
      expect(eventsOf<PlaybackStateMsg>('playback:event').at(-1)).toMatchObject(
        { type: 'PLAY', auto: true },
      );
      const count = eventsOf('playback:event').length;
      await gateway.handleViewerStatus(viewer.socket, status(true));
      expect(eventsOf('playback:event')).toHaveLength(count);
    });

    it('resumes when the buffering viewer disconnects', async () => {
      const { gateway, viewer, eventsOf } = await playingRoom();
      await gateway.handleViewerStatus(viewer.socket, status(true));
      await gateway.handleDisconnect(viewer.socket);
      expect(eventsOf<PlaybackStateMsg>('playback:event').at(-1)).toMatchObject(
        { type: 'PLAY', auto: true },
      );
    });

    it('corrects a viewer that drifted from the room position', async () => {
      const { gateway, viewer } = await playingRoom();
      await jest.advanceTimersByTimeAsync(10_000);
      await gateway.handleViewerStatus(viewer.socket, status(false, 95));
      const correction = viewer.sent.find((e) => e.event === 'playback:correct')
        ?.payload as PlaybackStateMsg | undefined;
      expect(correction?.time).toBeCloseTo(110, 0);
      viewer.sent.length = 0;
      await gateway.handleViewerStatus(viewer.socket, status(false, 110));
      expect(viewer.sent.some((e) => e.event === 'playback:correct')).toBe(
        false,
      );
    });
  });

  describe('host transfer', () => {
    it('hands host to the longest-present viewer after the grace period', async () => {
      const { gateway, roomRows, eventsOf } = setup();
      const host = await join(gateway, HOST_ID, 1);
      await join(gateway, 'viewer-late', 3);
      await join(gateway, 'viewer-early', 2);
      await gateway.handleDisconnect(host.socket);
      await jest.advanceTimersByTimeAsync(29_000);
      expect(roomRows.get('AAAA')?.hostId).toBe(HOST_ID);
      await jest.advanceTimersByTimeAsync(1_000);
      expect(roomRows.get('AAAA')?.hostId).toBe('viewer-early');
      expect(eventsOf('host:changed').at(-1)).toMatchObject({
        host_id: 'viewer-early',
        previous_host_id: HOST_ID,
        reason: 'host_left',
      });
      const presenceSync = eventsOf<PresencePayload[]>('presence:sync').at(-1);
      expect(presenceSync?.find((p) => p.isHost)?.userId).toBe('viewer-early');
    });

    it('prefers a co-host over earlier viewers', async () => {
      const { gateway, roomRows } = setup({ coHostIds: ['co-1'] });
      const host = await join(gateway, HOST_ID, 1);
      await join(gateway, 'viewer-early', 2);
      await join(gateway, 'co-1', 3);
      await gateway.handleDisconnect(host.socket);
      await jest.advanceTimersByTimeAsync(30_000);
      expect(roomRows.get('AAAA')).toMatchObject({
        hostId: 'co-1',
        coHostIds: [],
      });
    });

    it('keeps the host when they come back in time', async () => {
      const { gateway, roomRows } = setup();
      const host = await join(gateway, HOST_ID, 1);
      await join(gateway, 'viewer-1', 2);
      await gateway.handleDisconnect(host.socket);
      await jest.advanceTimersByTimeAsync(10_000);
      await join(gateway, HOST_ID, 4);
      await jest.advanceTimersByTimeAsync(30_000);
      expect(roomRows.get('AAAA')?.hostId).toBe(HOST_ID);
    });
  });

  it('extrapolates the playing position from the last state', () => {
    const state = { time: 100, isPlaying: true, updatedAt: 1_000 };
    expect(currentPlaybackTime(state, 6_000)).toBe(105);
    expect(currentPlaybackTime({ ...state, isPlaying: false }, 6_000)).toBe(
      100,
    );
  });
});
