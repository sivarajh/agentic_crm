import { useEffect, useState } from 'react'
import { Button, Text, StackLayout, FlexLayout, Divider } from '@salt-ds/core'
import { useSessionStore, useConversationStore, useAgentStore } from '@/store'
import { sessionApi } from '@/api/sessionApi'
import { conversationApi } from '@/api/conversationApi'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

export function SessionPanel() {
  const [isCreating, setIsCreating] = useState(false)
  const { currentSession, setSession } = useSessionStore()
  const {
    currentConversation,
    conversationHistory,
    viewingConversationId,
    setConversation,
    addToHistory,
    removeFromHistory,
    setViewingConversation,
    clearMessages,
  } = useConversationStore()
  const { setAgentStatus, clearStreamingContent } = useAgentStore()

  // Validate persisted session + load full conversation history from backend on mount
  useEffect(() => {
    // Validate current session
    if (currentSession) {
      sessionApi.get(currentSession.sessionId).then((s) => {
        if (s.state !== 'ACTIVE') setSession(null)
      }).catch(() => setSession(null))
    }

    // Load all past conversations from backend (source of truth)
    async function loadHistory() {
      try {
        const { content: sessions } = await sessionApi.list(DEMO_USER_ID)
        for (const session of sessions) {
          const conversations = await conversationApi.listBySession(session.sessionId)
          for (const conv of conversations) {
            addToHistory(conv)
          }
        }
      } catch (e) {
        console.error('Failed to load conversation history from backend:', e)
      }
    }
    loadHistory()
  }, [])

  async function startNewSession() {
    setIsCreating(true)
    try {
      // Terminate existing session if any
      if (currentSession) {
        try { await sessionApi.terminate(currentSession.sessionId) } catch (_) { /* ignore */ }
      }
      // Save current conversation to history before replacing it
      if (currentConversation) {
        addToHistory(currentConversation)
      }
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

  const activeConvId = viewingConversationId ?? currentConversation?.conversationId

  return (
    <StackLayout gap={0} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Session controls */}
      <StackLayout gap={2} style={{ padding: 'var(--salt-spacing-200)', flexShrink: 0 }}>
        {currentSession && (
          <div
            style={{
              borderRadius: 'var(--salt-curve-100)',
              background: 'var(--salt-status-positive-background)',
              border: '1px solid var(--salt-status-positive-borderColor)',
              padding: 'var(--salt-spacing-100) var(--salt-spacing-150)',
            }}
          >
            <Text styleAs="label" style={{ color: 'var(--salt-status-positive-foreground)', fontWeight: 600 }}>
              ● Active Session
            </Text>
          </div>
        )}
        <Button appearance="solid" sentiment="accented" onClick={startNewSession} disabled={isCreating} style={{ width: '100%' }}>
          {isCreating ? 'Starting…' : 'New'}
        </Button>

        <StackLayout gap={0}>
          <FlexLayout gap={1}>
            <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>User:</Text>
            <Text styleAs="code" style={{ fontSize: '11px' }}>{DEMO_USER_ID}</Text>
          </FlexLayout>
          <FlexLayout gap={1}>
            <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>Agent:</Text>
            <Text styleAs="label">IQ Smart Assistant</Text>
          </FlexLayout>
        </StackLayout>
      </StackLayout>

      {/* Conversation history */}
      {(conversationHistory.length > 0 || currentConversation) && (
        <>
          <Divider />
          <StackLayout gap={1} style={{ padding: 'var(--salt-spacing-100) var(--salt-spacing-200) var(--salt-spacing-100)', flexShrink: 0 }}>
            <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              History
            </Text>
          </StackLayout>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--salt-spacing-100) var(--salt-spacing-200)' }}>
            <StackLayout gap={0}>
              {/* Current conversation */}
              {currentConversation && (
                <button
                  onClick={() => setViewingConversation(null)}
                  style={{
                    all: 'unset',
                    display: 'block',
                    width: '100%',
                    padding: 'var(--salt-spacing-75) var(--salt-spacing-100)',
                    borderRadius: 'var(--salt-curve-100)',
                    cursor: 'pointer',
                    background: activeConvId === currentConversation.conversationId && viewingConversationId === null
                      ? 'var(--salt-status-info-background)'
                      : 'transparent',
                    border: activeConvId === currentConversation.conversationId && viewingConversationId === null
                      ? '1px solid var(--salt-status-info-borderColor)'
                      : '1px solid transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  <Text styleAs="label" style={{ fontSize: '12px', fontWeight: 600 }}>Current</Text>
                </button>
              )}

              {/* Past conversations */}
              {conversationHistory.map((entry) => {
                // Skip if it's the current conversation (already shown above)
                if (entry.conversationId === currentConversation?.conversationId) return null
                const isViewing = viewingConversationId === entry.conversationId
                return (
                  <div
                    key={entry.conversationId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--salt-spacing-50)',
                      borderRadius: 'var(--salt-curve-100)',
                      background: isViewing ? 'var(--salt-status-info-background)' : 'transparent',
                      border: isViewing ? '1px solid var(--salt-status-info-borderColor)' : '1px solid transparent',
                      boxSizing: 'border-box',
                    }}
                  >
                    <button
                      onClick={() => setViewingConversation(entry.conversationId)}
                      style={{
                        all: 'unset',
                        flex: 1,
                        padding: 'var(--salt-spacing-75) var(--salt-spacing-100)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                    >
                      <Text styleAs="label" style={{ fontSize: '12px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.label}
                      </Text>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromHistory(entry.conversationId) }}
                      title="Remove from history"
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        padding: '2px var(--salt-spacing-75)',
                        color: 'var(--salt-content-secondary-foreground)',
                        fontSize: '12px',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </StackLayout>
          </div>
        </>
      )}
    </StackLayout>
  )
}
