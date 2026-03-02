export type MessageRole = 'user' | 'agent' | 'system' | 'tool'

export interface ConversationMessage {
  messageId: string
  conversationId: string
  sessionId: string
  turnId: number
  role: MessageRole
  content: string
  agentId: string | null
  tokenCount: number | null
  traceId: string | null
  spanId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface Conversation {
  conversationId: string
  sessionId: string
  title: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AppendMessageRequest {
  role: MessageRole
  content: string
  agentId?: string
  tokenCount?: number
  metadata?: Record<string, unknown>
}
