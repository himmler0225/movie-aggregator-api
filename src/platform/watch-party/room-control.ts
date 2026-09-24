import type { WatchRoom } from '@prisma/client';
import type {
  RoomControlMode,
  RoomControlMsg,
  RoomControlState,
} from '../types';

export const ROOM_CONTROL_MODES: readonly RoomControlMode[] = [
  'host',
  'everyone',
];
export const MAX_CO_HOSTS = 5;

export function toControlState(
  room: Pick<
    WatchRoom,
    'hostId' | 'coHostIds' | 'controlMode' | 'waitForBuffering'
  >,
): RoomControlState {
  return {
    hostId: room.hostId,
    coHostIds: room.coHostIds ?? [],
    controlMode: room.controlMode === 'everyone' ? 'everyone' : 'host',
    waitForBuffering: room.waitForBuffering ?? true,
  };
}

export function toControlMsg(control: RoomControlState): RoomControlMsg {
  return {
    host_id: control.hostId,
    co_host_ids: control.coHostIds,
    control_mode: control.controlMode,
    wait_for_buffering: control.waitForBuffering,
  };
}

/** Host and co-hosts can always control playback; everyone can when the room allows it. */
export function canControlPlayback(
  control: RoomControlState,
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  return (
    control.controlMode === 'everyone' ||
    control.hostId === userId ||
    control.coHostIds.includes(userId)
  );
}
