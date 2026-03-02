import React from 'react'
import type { ConversationMessage } from '@/types/conversation'
import { isA2UIResponse } from '@/types/a2ui'
import { A2UIRenderer } from '@/a2ui/A2UIRenderer'
import { clsx } from 'clsx'

interface Props {
  message: ConversationMessage
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user'

  let content: React.ReactNode

  // Try to parse A2UI response from agent messages
  if (!isUser && message.content) {
    try {
      const parsed = JSON.parse(message.content)
      if (isA2UIResponse(parsed)) {
        content = <A2UIRenderer components={parsed.components} />
      }
    } catch {
      // Not JSON — render as plain text
    }
  }

  if (!content) {
    content = (
      <p className="whitespace-pre-wrap text-sm">
        {message.content}
        {isStreaming && (
          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current" />
        )}
      </p>
    )
  }

  return (
    <div
      className={clsx(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        )}
      >
        {!isUser && message.agentId && (
          <p className="mb-1 text-xs font-medium text-gray-500">
            {message.agentId}
          </p>
        )}
        {content}
      </div>
    </div>
  )
}
