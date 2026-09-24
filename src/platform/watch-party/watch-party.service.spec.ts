import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { RoomMembersRepository } from '../../database/repositories/room-members.repository';
import type { RoomMessagesRepository } from '../../database/repositories/room-messages.repository';
import type { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import type { PermissionsService } from '../auth/permissions.service';
import type { DanmakuService } from '../danmaku/danmaku.service';
import type { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyService } from './watch-party.service';

const HOST_ID = 'host-1';

function setup(roomOverrides: Record<string, unknown> = {}) {
  const room = {
    id: 'room-1',
    code: 'AAAA',
    hostId: HOST_ID,
    coHostIds: [] as string[],
    controlMode: 'host',
    waitForBuffering: true,
    isPrivate: false,
    movieSlug: 'movie',
    episodeName: 'Tập 1',
    ...roomOverrides,
  };
  const memberIds = new Set<string>(['viewer-1']);
  const rooms = {
    findById: jest.fn(() => Promise.resolve({ ...room })),
    update: jest.fn((_where: unknown, data: Record<string, unknown>) => {
      Object.assign(room, data);
      return Promise.resolve({ ...room });
    }),
    updateMany: jest.fn(
      (where: { hostId?: string }, data: Record<string, unknown>) => {
        if (where.hostId && where.hostId !== room.hostId) {
          return Promise.resolve(0);
        }
        Object.assign(room, data);
        return Promise.resolve(1);
      },
    ),
  };
  const members = {
    isMember: jest.fn((_roomId: string, userId: string) =>
      Promise.resolve(
        memberIds.has(userId) ? { userId, username: userId } : null,
      ),
    ),
  };
  const messages = {
    create: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 'msg-1', createdAt: new Date(0), ...data }),
    ),
  };
  const gateway = {
    publishControl: jest.fn(() => Promise.resolve()),
    emitHostChanged: jest.fn(),
    emitMessageCreated: jest.fn(),
    applyPlaybackUpdate: jest.fn(() => Promise.resolve()),
  };
  const danmaku = { create: jest.fn(() => Promise.resolve({})) };
  const service = new WatchPartyService(
    rooms as unknown as WatchRoomsRepository,
    members as unknown as RoomMembersRepository,
    messages as unknown as RoomMessagesRepository,
    gateway as unknown as WatchPartyGateway,
    {} as PermissionsService,
    danmaku as unknown as DanmakuService,
  );
  return { service, room, rooms, gateway, danmaku, messages };
}

describe('WatchPartyService', () => {
  describe('insertMessage', () => {
    const base = {
      roomId: 'room-1',
      userId: 'viewer-1',
      username: 'viewer',
      content: 'wow',
    };

    it('stores playback time and publishes danmaku only when asked', async () => {
      const { service, danmaku, messages } = setup();
      await service.insertMessage({ ...base, playbackTime: 42 });
      expect(messages.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ playbackTime: 42 }),
      );
      expect(danmaku.create).not.toHaveBeenCalled();
      await service.insertMessage({
        ...base,
        playbackTime: 42,
        asDanmaku: true,
      });
      expect(danmaku.create).toHaveBeenCalledWith(
        expect.objectContaining({
          movieSlug: 'movie',
          episodeName: 'Tập 1',
          playbackTime: 42,
          roomId: 'room-1',
        }),
      );
    });

    it('rejects danmaku that is too long before saving anything', async () => {
      const { service, messages } = setup();
      await expect(
        service.insertMessage({
          ...base,
          content: 'x'.repeat(201),
          playbackTime: 1,
          asDanmaku: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(messages.create).not.toHaveBeenCalled();
    });

    it('ignores playback time on system messages', async () => {
      const { service, messages, danmaku } = setup();
      await service.insertMessage({
        ...base,
        type: 'system',
        playbackTime: 5,
        asDanmaku: true,
      });
      expect(messages.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ playbackTime: null }),
      );
      expect(danmaku.create).not.toHaveBeenCalled();
    });
  });

  it('lets co-hosts update playback over REST', async () => {
    const { service, gateway } = setup({ coHostIds: ['viewer-1'] });
    const state = {
      playbackTime: 10,
      isPlaying: true,
      episodeName: 'Tập 1',
      serverIndex: 0,
    };
    await service.updatePlayback('room-1', 'viewer-1', state);
    expect(gateway.applyPlaybackUpdate).toHaveBeenCalled();
    await expect(
      service.updatePlayback('room-1', 'stranger', state),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('control', () => {
    it('only lets the host change settings', async () => {
      const { service, gateway } = setup();
      await expect(
        service.updateSettings('room-1', 'viewer-1', {
          controlMode: 'everyone',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const result = await service.updateSettings('room-1', HOST_ID, {
        controlMode: 'everyone',
        waitForBuffering: false,
      });
      expect(result.data).toMatchObject({
        control_mode: 'everyone',
        wait_for_buffering: false,
      });
      expect(gateway.publishControl).toHaveBeenCalled();
    });

    it('adds co-hosts who are members, once', async () => {
      const { service, room } = setup();
      await expect(
        service.addCoHost('room-1', HOST_ID, 'stranger'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await service.addCoHost('room-1', HOST_ID, 'viewer-1');
      await service.addCoHost('room-1', HOST_ID, 'viewer-1');
      expect(room.coHostIds).toEqual(['viewer-1']);
      await service.removeCoHost('room-1', HOST_ID, 'viewer-1');
      expect(room.coHostIds).toEqual([]);
    });

    it('caps the number of co-hosts', async () => {
      const { service } = setup({
        coHostIds: ['a', 'b', 'c', 'd', 'e'],
      });
      await expect(
        service.addCoHost('room-1', HOST_ID, 'viewer-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('transfers host to a member and announces it', async () => {
      const { service, room, gateway } = setup({ coHostIds: ['viewer-1'] });
      await service.transferHost('room-1', HOST_ID, 'viewer-1');
      expect(room).toMatchObject({ hostId: 'viewer-1', coHostIds: [] });
      expect(gateway.emitHostChanged).toHaveBeenCalledWith('AAAA', {
        hostId: 'viewer-1',
        previousHostId: HOST_ID,
        username: 'viewer-1',
        reason: 'transferred',
      });
    });
  });
});
