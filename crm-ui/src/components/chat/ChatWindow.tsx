import { useEffect, useRef, useState } from 'react'
import { Text, StackLayout, FlexLayout } from '@salt-ds/core'
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

  // Load current conversation messages from backend
  useEffect(() => {
    if (!currentConversation || isViewingHistory) return
    conversationApi
      .getMessages(currentConversation.conversationId)
      .then(({ content }) => setMessages(content))
      .catch(console.error)
  }, [currentConversation?.conversationId, isViewingHistory])

  // Load history conversation messages when user clicks a past conversation
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
    if (!currentConversation) return
    conversationApi
      .getMessages(currentConversation.conversationId)
      .then(({ content }) => setMessages(content))
      .catch(console.error)
  }, [agentStatus, currentConversation, setMessages])

  async function handleSend(text: string) {
    if (!currentSession || !currentConversation || isSending) return
    setIsSending(true)
    try {
      const userMsg = await conversationApi.appendMessage(
        currentConversation.conversationId,
        { role: 'user', content: text }
      )
      addMessage(userMsg)
      await agentApi.submitTask({
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        intent: text,
        payload: { conversationId: currentConversation.conversationId },
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
  const inputDisabled = !currentSession || isViewingHistory || isSending ||
    agentStatus === 'thinking' || agentStatus === 'working'

  return (
    <StackLayout direction="column" gap={0} style={{ height: '100%' }}>
      {/* History view banner */}
      {isViewingHistory && (
        <div
          style={{
            borderBottom: '1px solid var(--salt-separable-borderColor)',
            padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
            background: 'var(--salt-status-info-background)',
            textAlign: 'center',
          }}
        >
          <Text styleAs="label" style={{ color: 'var(--salt-status-info-foreground)' }}>
            Viewing past conversation (read-only) — click "Current" in the sidebar to return
          </Text>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--salt-spacing-200)' }}>
        {displayedMessages.length === 0 && !currentSession && !isViewingHistory && (
          <FlexLayout justify="center" style={{ marginTop: 'var(--salt-spacing-400)' }}>
            <Text style={{ color: 'var(--salt-content-secondary-foreground)' }}>
              Create a session to start chatting with IQ Smart Assistant.
            </Text>
          </FlexLayout>
        )}
        {displayedMessages.length === 0 && currentSession && (
          <FlexLayout justify="center" style={{ marginTop: 'var(--salt-spacing-400)' }}>
            <Text style={{ color: 'var(--salt-content-secondary-foreground)' }}>
              Start a conversation with your IQ Smart Assistant.
            </Text>
          </FlexLayout>
        )}
        <StackLayout gap={1}>
          {displayedMessages.map((msg) => (
            <MessageBubble key={msg.messageId} message={msg} />
          ))}
          {!isViewingHistory && streamingContent && currentSession && (
            <MessageBubble
              message={{
                messageId: 'streaming',
                conversationId: currentConversation?.conversationId ?? '',
                sessionId: currentSession.sessionId,
                turnId: messages.length + 1,
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
        </StackLayout>
        <div ref={messagesEndRef} />
      </div>

      {/* No-session banner */}
      {!currentSession && !isViewingHistory && (
        <div
          style={{
            borderTop: '1px solid var(--salt-separable-borderColor)',
            padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
            background: 'var(--salt-status-warning-background)',
            textAlign: 'center',
          }}
        >
          <Text styleAs="label" style={{ color: 'var(--salt-status-warning-foreground)' }}>
            Session ended — start a new session to continue chatting.
          </Text>
        </div>
      )}

      {/* Status bar */}
      {currentSession && !isViewingHistory && (
        <div
          style={{
            borderTop: '1px solid var(--salt-separable-borderColor)',
            padding: 'var(--salt-spacing-50) var(--salt-spacing-200)',
          }}
        >
          <AgentStatusIndicator status={agentStatus} />
        </div>
      )}

      {/* Input */}
      <div
        style={{
          borderTop: '1px solid var(--salt-separable-borderColor)',
          padding: 'var(--salt-spacing-150) var(--salt-spacing-200)',
        }}
      >
        <MessageInput onSend={handleSend} disabled={inputDisabled} />
      </div>
    </StackLayout>
  )
}
