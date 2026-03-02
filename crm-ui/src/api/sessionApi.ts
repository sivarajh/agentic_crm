import apiClient from './client'
import type { Session, CreateSessionRequest } from '@/types/session'

export const sessionApi = {
  create: (req: CreateSessionRequest): Promise<Session> =>
    apiClient.post('/sessions', req).then((r) => r.data),

  get: (sessionId: string): Promise<Session> =>
    apiClient.get(`/sessions/${sessionId}`).then((r) => r.data),

  heartbeat: (sessionId: string, activeTaskId?: string): Promise<Session> =>
    apiClient
      .put(`/sessions/${sessionId}/heartbeat`, { activeTaskId })
      .then((r) => r.data),

  terminate: (sessionId: string): Promise<void> =>
    apiClient.delete(`/sessions/${sessionId}`).then(() => undefined),
}
