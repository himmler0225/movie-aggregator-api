import type { RoomMessage } from '@prisma/client';
import type { RoomMessageView } from '../types';

export function mapRoomMessage(
  m: Pick<
    RoomMessage,
    | 'id'
    | 'roomId'
    | 'userId'
    | 'username'
    | 'avatarUrl'
    | 'content'
    | 'type'
    | 'createdAt'
  >,
): RoomMessageView {
  return {
    id: m.id,
    room_id: m.roomId,
    user_id: m.userId,
    username: m.username,
    avatar_url: m.avatarUrl,
    content: m.content,
    type: m.type,
    created_at: m.createdAt.toISOString(),
  };
}
