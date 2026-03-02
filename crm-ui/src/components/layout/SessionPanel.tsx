import { useState } from 'react'
import { useSessionStore, useConversationStore, useAgentStore } from '@/store'
import { sessionApi } from '@/api/sessionApi'
import { conversationApi } from '@/api/conversationApi'
import { clsx } from 'clsx'

// Hardcoded demo userId; replace with auth context in production
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

export function SessionPanel() {
  const [isCreating, setIsCreating] = useState(false)
  const { currentSession, setSession } = useSessionStore()
  const { setConversation, clearMessages } = useConversationStore()
  const { setAgentStatus, clearStreamingContent } = useAgentStore()

  async function startNewSession() {
    setIsCreating(true)
    try {
      const session = await sessionApi.create({
        userId: DEMO_USER_ID,
        agentId: 'crm-orchestrator',
      })
      setSession(session)

      const conversation = await conversationApi.create(session.sessionId)
      setConversation(conversation)
      clearMessages()
      clearStreamingContent()
      setAgentStatus('idle')
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsCreating(false)
    }
  }

  async function endSession() {
    if (!currentSession) return
    try {
      await sessionApi.terminate(currentSession.sessionId)
    } catch (_) {
      // ignore
    }
    setSession(null)
    setConversation(null)
    clearMessages()
  }

  return (
    <div className="p-4 space-y-4">
      {currentSession ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-green-50 p-3">
            <p className="text-xs font-medium text-green-700">Active Session</p>
            <p className="mt-1 font-mono text-xs text-green-600 truncate">
              {currentSession.sessionId.slice(0, 8)}...
            </p>
          </div>
          <button
            onClick={endSession}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100"
          >
            End Session
          </button>
        </div>
      ) : (
        <button
          onClick={startNewSession}
          disabled={isCreating}
          className={clsx(
            'w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white',
            'hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isCreating ? 'Starting...' : 'New Session'}
        </button>
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>User: {DEMO_USER_ID.slice(0, 8)}...</p>
        <p>Agent: crm-orchestrator</p>
      </div>
    </div>
  )
}
