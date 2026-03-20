import apiClient from './client'
import type { Project } from '@/store'

export const projectApi = {
  create: (userId: string, name: string): Promise<Project> =>
    apiClient.post('/projects', { userId, name }).then((r) => r.data),

  list: (userId: string): Promise<Project[]> =>
    apiClient.get('/projects', { params: { userId } }).then((r) => r.data),

  rename: (projectId: string, name: string): Promise<Project> =>
    apiClient.put(`/projects/${projectId}`, { name }).then((r) => r.data),

  delete: (projectId: string): Promise<void> =>
    apiClient.delete(`/projects/${projectId}`).then(() => undefined),

  assignConversation: (projectId: string, conversationId: string): Promise<void> =>
    apiClient.patch(`/projects/${projectId}/conversations/${conversationId}`).then(() => undefined),

  unassignConversation: (projectId: string, conversationId: string): Promise<void> =>
    apiClient.delete(`/projects/${projectId}/conversations/${conversationId}`).then(() => undefined),
}
