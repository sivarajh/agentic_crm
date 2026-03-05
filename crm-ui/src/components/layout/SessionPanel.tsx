import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore, useConversationStore, useAgentStore } from '@/store'
import { sessionApi } from '@/api/sessionApi'
import { conversationApi } from '@/api/conversationApi'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

export function SessionPanel() {
  const [isCreating, setIsCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const navigate = useNavigate()
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

  useEffect(() => {
    if (currentSession) {
      sessionApi.get(currentSession.sessionId).then((s) => {
        if (s.state !== 'ACTIVE') setSession(null)
      }).catch(() => setSession(null))
    }

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
      if (currentSession) {
        try { await sessionApi.terminate(currentSession.sessionId) } catch (_) { /* ignore */ }
      }
      if (currentConversation) {
        addToHistory(currentConversation)
      }
      const session = await sessionApi.create({
        userId: DEMO_USER_ID,
        agentId: 'iQ Smart Assistant',
      })
      setSession(session)
      const conversation = await conversationApi.create(session.sessionId)
      setConversation(conversation)
      clearMessages()
      clearStreamingContent()
      setAgentStatus('idle')
      navigate('/')
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsCreating(false)
    }
  }

  function copyLink(conversationId: string) {
    const url = `${window.location.origin}/conversation/${conversationId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(conversationId)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  async function confirmDelete(conversationId: string) {
    setIsDeletingId(conversationId)
    try {
      await conversationApi.delete(conversationId)
      if (viewingConversationId === conversationId) navigate('/')
      removeFromHistory(conversationId)
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    } finally {
      setIsDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const activeConvId = viewingConversationId ?? currentConversation?.conversationId

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* New chat button + session info */}
      <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
        <button
          onClick={startNewSession}
          disabled={isCreating}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--cgpt-sidebar-border)',
            background: 'transparent',
            color: 'var(--cgpt-text-primary)',
            cursor: isCreating ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 0.15s',
            opacity: isCreating ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          {isCreating ? 'Starting…' : 'New chat'}
        </button>

        {/* Session indicator */}
        {currentSession && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cgpt-accent)', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--cgpt-text-secondary)' }}>Session active</span>
          </div>
        )}
      </div>

      {/* Conversation history */}
      {(conversationHistory.length > 0 || currentConversation) && (
        <>
          <div style={{ height: 1, background: 'var(--cgpt-sidebar-border)', margin: '4px 12px' }} />
          <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--cgpt-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Conversations
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
            {/* Current conversation */}
            {currentConversation && (
              <button
                onClick={() => { setViewingConversation(null); navigate('/') }}
                style={{
                  all: 'unset',
                  display: 'block',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeConvId === currentConversation.conversationId && viewingConversationId === null
                    ? 'var(--cgpt-sidebar-active)'
                    : 'transparent',
                  color: 'var(--cgpt-text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (activeConvId !== currentConversation.conversationId || viewingConversationId !== null)
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)'
                }}
                onMouseLeave={(e) => {
                  if (activeConvId !== currentConversation.conversationId || viewingConversationId !== null)
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                💬 Current chat
              </button>
            )}

            {/* Past conversations */}
            {conversationHistory.map((entry) => {
              if (entry.conversationId === currentConversation?.conversationId) return null
              const isViewing = viewingConversationId === entry.conversationId
              const isConfirming = confirmDeleteId === entry.conversationId
              const isDeleting = isDeletingId === entry.conversationId

              if (isConfirming) {
                return (
                  <div
                    key={entry.conversationId}
                    style={{
                      borderRadius: 6,
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      padding: '8px 10px',
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--cgpt-danger)', marginBottom: 6 }}>
                      Delete this conversation?
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => confirmDelete(entry.conversationId)}
                        disabled={isDeleting}
                        style={{
                          all: 'unset',
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 4,
                          background: 'var(--cgpt-danger)',
                          color: '#fff',
                        }}
                      >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isDeleting}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          fontSize: 11,
                          color: 'var(--cgpt-text-secondary)',
                          padding: '3px 6px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={entry.conversationId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 6,
                    background: isViewing ? 'var(--cgpt-sidebar-active)' : 'transparent',
                    marginBottom: 1,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isViewing) (e.currentTarget as HTMLDivElement).style.background = 'var(--cgpt-sidebar-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isViewing) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <button
                    onClick={() => navigate(`/conversation/${entry.conversationId}`)}
                    style={{
                      all: 'unset',
                      flex: 1,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      color: 'var(--cgpt-text-primary)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.label}
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyLink(entry.conversationId) }}
                    title="Copy shareable link"
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      padding: '4px 4px',
                      color: copiedId === entry.conversationId ? 'var(--cgpt-accent)' : 'var(--cgpt-text-muted)',
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {copiedId === entry.conversationId ? '✓' : '🔗'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(entry.conversationId) }}
                    title="Delete conversation"
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      color: 'var(--cgpt-text-muted)',
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
