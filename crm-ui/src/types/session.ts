export type SessionState = 'ACTIVE' | 'IDLE' | 'TERMINATED' | 'EXPIRED'

export interface Session {
  sessionId: string
  userId: string
  agentId: string | null
  startTime: string
  lastActive: string
  state: SessionState
  activeTaskId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateSessionRequest {
  userId: string
  agentId?: string
}
