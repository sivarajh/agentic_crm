import React from 'react'
import { Text, Card, FlexLayout, StackLayout, Pill } from '@salt-ds/core'
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
      <Text style={{ whiteSpace: 'pre-wrap' }}>
        {message.content}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: 'currentColor',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'pulse 1s infinite',
            }}
          />
        )}
      </Text>
    )
  }

  if (isUser) {
    return (
      <FlexLayout justify="end" style={{ padding: '2px 0' }}>
        <div
          style={{
            maxWidth: '75%',
            background: 'var(--salt-palette-interact-primary-background)',
            color: 'var(--salt-palette-interact-primary-foreground)',
            borderRadius: 'var(--salt-curve-150)',
            borderBottomRightRadius: 4,
            padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
          }}
        >
          {content}
        </div>
      </FlexLayout>
    )
  }

  return (
    <FlexLayout justify="start" style={{ padding: '2px 0' }}>
      <div style={{ maxWidth: '85%' }}>
        <Card style={{ borderRadius: 'var(--salt-curve-150)', borderBottomLeftRadius: 4 }}>
          <StackLayout gap={1}>
            {message.agentId && (
              <Pill style={{ alignSelf: 'flex-start' }}>{message.agentId}</Pill>
            )}
            {content}
          </StackLayout>
        </Card>
      </div>
    </FlexLayout>
  )
}
