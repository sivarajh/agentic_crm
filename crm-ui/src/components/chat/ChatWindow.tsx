import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { AgentStatusIndicator } from './AgentStatusIndicator'
import { useConversationStore, useAgentStore, useSessionStore } from '@/store'
import { conversationApi } from '@/api/conversationApi'
import { agentApi } from '@/api/agentApi'
import { useA2UIStream } from '@/a2ui/hooks/useA2UIStream'
import type { ConversationMessage } from '@/types/conversation'

export function ChatWindow() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSending, setIsSending] = useState(false)
  const [historyMessages, setHistoryMessages] = useState<ConversationMessage[]>([])

  const { currentSession } = useSessionStore()
  const {
    messages,
    currentConversation,
    viewingConversationId,
    addMessage,
    setMessages,
  } = useConversationStore()
  const { agentStatus, streamingContent, setAgentStatus, clearStreamingContent } = useAgentStore()

  useA2UIStream(currentSession?.sessionId ?? null)

  const isViewingHistory = viewingConversationId !== null &&
    viewingConversationId !== currentConversation?.conversationId

  const activeConversationId = viewingConversationId ?? currentConversation?.conversationId

  useEffect(() => {
    if (!currentConversation || isViewingHistory) return
    conversationApi
      .getMessages(currentConversation.conversationId)
      .then(({ content }) => setMessages(content))
      .catch(console.error)
  }, [currentConversation?.conversationId, isViewingHistory])

  useEffect(() => {
    if (!isViewingHistory || !viewingConversationId) {
      setHistoryMessages([])
      return
    }
    conversationApi
      .getMessages(viewingConversationId)
      .then(({ content }) => setHistoryMessages(content))
      .catch(console.error)
  }, [viewingConversationId, isViewingHistory])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, historyMessages, streamingContent])

  useEffect(() => {
    if (agentStatus !== 'done') return
    if (isViewingHistory && viewingConversationId) {
      conversationApi
        .getMessages(viewingConversationId)
        .then(({ content }) => {
          setHistoryMessages(content)
          clearStreamingContent()
        })
        .catch(console.error)
    } else if (currentConversation) {
      conversationApi
        .getMessages(currentConversation.conversationId)
        .then(({ content }) => {
          setMessages(content)
          clearStreamingContent()
        })
        .catch(console.error)
    }
  }, [agentStatus])

  async function handleSend(text: string) {
    if (!currentSession || !activeConversationId || isSending) return
    setIsSending(true)
    try {
      const userMsg = await conversationApi.appendMessage(
        activeConversationId,
        { role: 'user', content: text }
      )
      if (isViewingHistory) {
        setHistoryMessages((prev) => [...prev, userMsg])
      } else {
        addMessage(userMsg)
      }
      await agentApi.submitTask({
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        intent: text,
        payload: { conversationId: activeConversationId },
      })
      clearStreamingContent()
      setAgentStatus('thinking')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }

  const displayedMessages = isViewingHistory ? historyMessages : messages
  const inputDisabled = !currentSession || !activeConversationId || isSending ||
    agentStatus === 'thinking' || agentStatus === 'working'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--cgpt-main-bg)' }}>
      {/* History view banner */}
      {isViewingHistory && (
        <div
          style={{
            borderBottom: '1px solid var(--cgpt-sidebar-border)',
            padding: '8px 16px',
            background: 'rgba(25,195,125,0.1)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--cgpt-accent)' }}>
            Past conversation — you can continue chatting here
          </span>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        {/* Empty states */}
        {displayedMessages.length === 0 && !currentSession && !isViewingHistory && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
            <span style={{ color: 'var(--cgpt-text-secondary)', fontSize: 14 }}>
              Create a session to start chatting with IQ Smart Assistant.
            </span>
          </div>
        )}
        {displayedMessages.length === 0 && currentSession && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 80, gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--cgpt-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              IQ
            </div>
            <span style={{ color: 'var(--cgpt-text-primary)', fontSize: 22, fontWeight: 600 }}>
              How can I help you today?
            </span>
            <span style={{ color: 'var(--cgpt-text-secondary)', fontSize: 14 }}>
              Ask about customers, deals, contacts, or search the web.
            </span>
          </div>
        )}

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {displayedMessages.map((msg) => (
            <MessageBubble key={msg.messageId} message={msg} />
          ))}
          {streamingContent && currentSession && (
            <MessageBubble
              message={{
                messageId: 'streaming',
                conversationId: activeConversationId ?? '',
                sessionId: currentSession.sessionId,
                turnId: displayedMessages.length + 1,
                role: 'agent',
                content: streamingContent,
                agentId: null,
                tokenCount: null,
                traceId: null,
                spanId: null,
                metadata: {},
                createdAt: new Date().toISOString(),
              }}
              isStreaming
            />
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* No-session banner */}
      {!currentSession && !isViewingHistory && (
        <div
          style={{
            borderTop: '1px solid var(--cgpt-sidebar-border)',
            padding: '8px 16px',
            background: 'rgba(255,180,0,0.08)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f5a623' }}>
            Session ended — start a new session to continue chatting.
          </span>
        </div>
      )}

      {/* Status bar */}
      {currentSession && (
        <div style={{ padding: '4px 24px', borderTop: '1px solid var(--cgpt-sidebar-border)' }}>
          <AgentStatusIndicator status={agentStatus} />
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          padding: '12px 24px 20px',
          background: 'var(--cgpt-main-bg)',
        }}
      >
        <div style={{ maxWidth: 768, margin: '0 auto' }}>
          <MessageInput onSend={handleSend} disabled={inputDisabled} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--cgpt-text-muted)' }}>
            IQ Smart Assistant can make mistakes. Verify important information.
          </span>
        </div>
      </div>
    </div>
  )
}
