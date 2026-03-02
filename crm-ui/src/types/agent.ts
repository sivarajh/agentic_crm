export type TaskStatus =
  | 'QUEUED'
  | 'SUBMITTED'
  | 'WORKING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface AgentTask {
  taskId: string
  sessionId: string
  userId: string
  intent: string
  payload: Record<string, unknown>
  priority: string
  status: TaskStatus
  artifacts: AgentArtifact[]
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentArtifact {
  name: string
  mimeType: string
  content: unknown
}

export interface SubmitTaskRequest {
  sessionId: string
  userId: string
  intent: string
  payload?: Record<string, unknown>
  priority?: string
}

// SSE event types streamed from /api/v1/stream/session/{sessionId}
export type StreamEventType =
  | 'agent.thinking'
  | 'agent.tool_call'
  | 'agent.message'
  | 'task.submitted'
  | 'task.completed'
  | 'task.failed'
  | 'session.update'

export interface StreamEvent {
  type: StreamEventType
  data: Record<string, unknown>
}
