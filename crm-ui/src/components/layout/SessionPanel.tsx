import { useState } from 'react'
import { Button, Text, StackLayout, FlexLayout } from '@salt-ds/core'
import { useSessionStore, useConversationStore, useAgentStore } from '@/store'
import { sessionApi } from '@/api/sessionApi'
import { conversationApi } from '@/api/conversationApi'

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
        agentId: 'IQ Smart Assistant',
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
    } catch (_) { /* ignore */ }
    setSession(null)
    setConversation(null)
    clearMessages()
  }

  return (
    <StackLayout gap={2} style={{ padding: 'var(--salt-spacing-200)', flex: 1 }}>
      {currentSession ? (
        <StackLayout gap={1}>
          <div
            style={{
              borderRadius: 'var(--salt-curve-100)',
              background: 'var(--salt-status-positive-background)',
              border: '1px solid var(--salt-status-positive-borderColor)',
              padding: 'var(--salt-spacing-100) var(--salt-spacing-150)',
            }}
          >
            <Text styleAs="label" style={{ color: 'var(--salt-status-positive-foreground)', fontWeight: 600 }}>
              Active Session
            </Text>
            <Text styleAs="code" style={{ display: 'block', fontSize: '11px', marginTop: 2, color: 'var(--salt-status-positive-foreground)' }}>
              {currentSession.sessionId.slice(0, 8)}…
            </Text>
          </div>
          <Button appearance="bordered" sentiment="negative" onClick={endSession} style={{ width: '100%' }}>
            End Session
          </Button>
        </StackLayout>
      ) : (
        <Button appearance="solid" sentiment="accented" onClick={startNewSession} disabled={isCreating} style={{ width: '100%' }}>
          {isCreating ? 'Starting…' : 'New Session'}
        </Button>
      )}

      <StackLayout gap={0}>
        <FlexLayout gap={1}>
          <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>User:</Text>
          <Text styleAs="code" style={{ fontSize: '11px' }}>{DEMO_USER_ID.slice(0, 8)}…</Text>
        </FlexLayout>
        <FlexLayout gap={1}>
          <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>Agent:</Text>
          <Text styleAs="label">IQ Smart Assistant</Text>
        </FlexLayout>
      </StackLayout>
    </StackLayout>
  )
}
