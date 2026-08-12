export interface AiConversationView {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessageView {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  actions: unknown;
  videos: unknown;
  created_at: string;
}

export interface AppendAiChatMessageInput {
  role: string;
  content: string;
  actions?: unknown;
  videos?: unknown;
}
