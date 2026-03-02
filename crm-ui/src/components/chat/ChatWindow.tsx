import { useEffect, useRef, useState } from 'react'
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

  // Open SSE stream when session is active
  useA2UIStream(currentSession?.sessionId ?? null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Refresh messages from backend when agent finishes (task.completed → 'done')
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
      // 1. Append user message to conversation history
      const userMsg = await conversationApi.appendMessage(
        currentConversation.conversationId,
        { role: 'user', content: text }
      )
      addMessage(userMsg)

      // 2. Submit task to orchestrator via backend gateway
      await agentApi.submitTask({
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        intent: text,
        payload: { conversationId: currentConversation.conversationId },
      })
      // 3. Optimistically show thinking state — SSE will update to working/done
      clearStreamingContent()
      setAgentStatus('thinking')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }

  if (!currentSession) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>No active session. Create a session to start chatting.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">
            Start a conversation with your AI CRM assistant.
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.messageId} message={msg} />
        ))}
        {/* Streaming indicator */}
        {streamingContent && (
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
        <div ref={messagesEndRef} />
      </div>

      {/* Agent status */}
      <div className="border-t border-gray-100 px-4 py-1">
        <AgentStatusIndicator status={agentStatus} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <MessageInput
          onSend={handleSend}
          disabled={isSending || agentStatus === 'thinking' || agentStatus === 'working'}
        />
      </div>
    </div>
  )
}
