import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type { Session } from '@/types/session'
import type { Conversation, ConversationMessage } from '@/types/conversation'
import type { AgentTask, StreamEvent } from '@/types/agent'

// ─── Session Store ────────────────────────────────────────────────────────────

interface SessionStore {
  currentSession: Session | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    immer((set) => ({
      currentSession: null,
      isLoading: false,
      setSession: (session) =>
        set((state) => {
          state.currentSession = session
        }),
      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading
        }),
    })),
    { name: 'iq-session' }
  )
)

// ─── Conversation Store ───────────────────────────────────────────────────────

interface ConversationStore {
  currentConversation: Conversation | null
  messages: ConversationMessage[]
  setConversation: (conv: Conversation | null) => void
  addMessage: (msg: ConversationMessage) => void
  setMessages: (msgs: ConversationMessage[]) => void
  clearMessages: () => void
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    immer((set) => ({
      currentConversation: null,
      messages: [],
      setConversation: (conv) =>
        set((state) => {
          state.currentConversation = conv
        }),
      addMessage: (msg) =>
        set((state) => {
          state.messages.push(msg)
        }),
      setMessages: (msgs) =>
        set((state) => {
          state.messages = msgs
        }),
      clearMessages: () =>
        set((state) => {
          state.messages = []
        }),
    })),
    {
      name: 'iq-conversation',
      // Only persist IDs — messages are fetched from the backend on load
      partialize: (state) => ({ currentConversation: state.currentConversation }),
    }
  )
)

// ─── Agent Store ──────────────────────────────────────────────────────────────

interface AgentStore {
  currentTask: AgentTask | null
  agentStatus: 'idle' | 'thinking' | 'working' | 'done' | 'error'
  lastStreamEvent: StreamEvent | null
  streamingContent: string
  setTask: (task: AgentTask | null) => void
  setAgentStatus: (status: AgentStore['agentStatus']) => void
  setLastStreamEvent: (event: StreamEvent | null) => void
  appendStreamingContent: (chunk: string) => void
  clearStreamingContent: () => void
}

export const useAgentStore = create<AgentStore>()(
  immer((set) => ({
    currentTask: null,
    agentStatus: 'idle',
    lastStreamEvent: null,
    streamingContent: '',
    setTask: (task) =>
      set((state) => {
        state.currentTask = task
      }),
    setAgentStatus: (status) =>
      set((state) => {
        state.agentStatus = status
      }),
    setLastStreamEvent: (event) =>
      set((state) => {
        state.lastStreamEvent = event
      }),
    appendStreamingContent: (chunk) =>
      set((state) => {
        state.streamingContent += chunk
      }),
    clearStreamingContent: () =>
      set((state) => {
        state.streamingContent = ''
      }),
  }))
)
