import apiClient from './client'
import type { AgentTask, SubmitTaskRequest } from '@/types/agent'

export const agentApi = {
  submitTask: (req: SubmitTaskRequest): Promise<AgentTask> =>
    apiClient.post('/agent/tasks', req).then((r) => r.data),

  getTask: (taskId: string): Promise<AgentTask> =>
    apiClient.get(`/agent/tasks/${taskId}`).then((r) => r.data),
}
