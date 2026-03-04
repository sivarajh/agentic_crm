import { useEffect, useRef, useState } from 'react'
import { Text, StackLayout, FlexLayout } from '@salt-ds/core'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { AgentStatusIndicator } from './AgentStatusIndicator'
import { useConversationStore, useAgentStore, useSessionStore } from '@/store'
import { conversationApi } from '@/api/conversationApi'
import { agentApi } from '@/api/agentApi'
import { useA2UIStream } from '@/a2ui/hooks/useA2UIStream'

export function ChatWindow() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSending, setIsSending] = useState(false)

  const { currentSession } = useSessionStore()
  const { messages, currentConversation, addMessage, setMessages } = useConversationStore()
  const { agentStatus, streamingContent, setAgentStatus, clearStreamingContent } = useAgentStore()

  useA2UIStream(currentSession?.sessionId ?? null)

  // Load messages from backend on mount (or when conversation changes)
  useEffect(() => {
    if (!currentConversation) return
    conversationApi
      .getMessages(currentConversation.conversationId)
      .then(({ content }) => setMessages(content))
      .catch(console.error)
  }, [currentConversation?.conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

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

  const inputDisabled = !currentSession || isSending || agentStatus === 'thinking' || agentStatus === 'working'

  return (
    <StackLayout direction="column" gap={0} style={{ height: '100%' }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--salt-spacing-200)' }}>
        {messages.length === 0 && !currentSession && (
          <FlexLayout justify="center" style={{ marginTop: 'var(--salt-spacing-400)' }}>
            <Text style={{ color: 'var(--salt-content-secondary-foreground)' }}>
              Create a session to start chatting with IQ Smart Assistant.
            </Text>
          </FlexLayout>
        )}
        {messages.length === 0 && currentSession && (
          <FlexLayout justify="center" style={{ marginTop: 'var(--salt-spacing-400)' }}>
            <Text style={{ color: 'var(--salt-content-secondary-foreground)' }}>
              Start a conversation with your IQ Smart Assistant.
            </Text>
          </FlexLayout>
        )}
        <StackLayout gap={1}>
          {messages.map((msg) => (
            <MessageBubble key={msg.messageId} message={msg} />
          ))}
          {streamingContent && currentSession && (
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

      {/* No-session banner — shown above input when session ended */}
      {!currentSession && (
        <div
          style={{
            borderTop: '1px solid var(--salt-separable-borderColor)',
            padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
            background: 'var(--salt-status-warning-background)',
            textAlign: 'center',
          }}
        >
          <Text styleAs="label" style={{ color: 'var(--salt-status-warning-foreground)' }}>
            Session ended — history is preserved. Start a new session to continue.
          </Text>
        </div>
      )}

      {/* Status bar */}
      {currentSession && (
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
