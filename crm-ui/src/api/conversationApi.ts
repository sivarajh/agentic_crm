import apiClient from './client'
import type {
  Conversation,
  ConversationMessage,
  AppendMessageRequest,
} from '@/types/conversation'

export const conversationApi = {
  create: (sessionId: string): Promise<Conversation> =>
    apiClient.post('/conversations', { sessionId }).then((r) => r.data),

  get: (conversationId: string): Promise<Conversation> =>
    apiClient.get(`/conversations/${conversationId}`).then((r) => r.data),

  listBySession: (sessionId: string): Promise<Conversation[]> =>
    apiClient.get(`/conversations/session/${sessionId}`).then((r) => r.data),

  appendMessage: (
    conversationId: string,
    req: AppendMessageRequest
  ): Promise<ConversationMessage> =>
    apiClient
      .post(`/conversations/${conversationId}/messages`, req)
      .then((r) => r.data),

  getMessages: (
    conversationId: string,
    page = 0,
    size = 50
  ): Promise<{ content: ConversationMessage[]; totalElements: number }> =>
    apiClient
      .get(`/conversations/${conversationId}/messages`, { params: { page, size } })
      .then((r) => r.data),

  delete: (conversationId: string): Promise<void> =>
    apiClient.delete(`/conversations/${conversationId}`).then(() => undefined),
}
