import React from 'react'
import type { ConversationMessage } from '@/types/conversation'
import { isA2UIResponse } from '@/types/a2ui'
import { A2UIRenderer } from '@/a2ui/A2UIRenderer'

interface Props {
  message: ConversationMessage
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user'

  let content: React.ReactNode

  // Only parse A2UI when NOT streaming — during streaming, content is plain
  // markdown text streamed token by token from Gemini.
  if (!isUser && message.content && !isStreaming) {
    try {
      const parsed = JSON.parse(message.content)
      if (isA2UIResponse(parsed)) {
        content = <A2UIRenderer components={parsed.components} />
      }
    } catch {
      // Not JSON — render as plain text below
    }
  }

  if (!content) {
    content = (
      <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 15, color: 'var(--cgpt-text-primary)' }}>
        {message.content}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: 'var(--cgpt-accent)',
              marginLeft: 3,
              verticalAlign: 'text-bottom',
              animation: 'pulse 1s infinite',
            }}
          />
        )}
      </span>
    )
  }

  if (isUser) {
    return (
      <div
        style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            maxWidth: 600,
            background: 'var(--cgpt-msg-user-bg)',
            borderRadius: 18,
            borderBottomRightRadius: 4,
            padding: '12px 18px',
            color: 'var(--cgpt-text-primary)',
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  // Agent message — full-width ChatGPT style with avatar
  return (
    <div
      style={{
        padding: '16px 24px',
        background: 'var(--cgpt-msg-agent-bg)',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      {/* Agent avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--cgpt-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        IQ
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 768 }}>
        {message.agentId && (
          <div style={{ marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                color: 'var(--cgpt-text-muted)',
                background: 'var(--cgpt-sidebar-border)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {message.agentId}
            </span>
          </div>
        )}
        {content}
      </div>
    </div>
  )
}
