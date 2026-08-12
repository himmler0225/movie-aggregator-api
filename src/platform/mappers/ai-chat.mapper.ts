import type { AiChatMessage, AiConversation } from '@prisma/client';
import type { AiChatMessageView, AiConversationView } from '../types';

export function mapAiConversation(c: AiConversation): AiConversationView {
  return {
    id: c.id,
    title: c.title,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function mapAiChatMessage(m: AiChatMessage): AiChatMessageView {
  return {
    id: m.id,
    conversation_id: m.conversationId,
    role: m.role,
    content: m.content,
    actions: m.actions,
    videos: m.videos,
    created_at: m.createdAt.toISOString(),
  };
}
