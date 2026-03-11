import React, { useState } from 'react'
import type { ConversationMessage } from '@/types/conversation'
import { isA2UIResponse } from '@/types/a2ui'
import { A2UIRenderer } from '@/a2ui/A2UIRenderer'
import { SourcesDrawer } from './SourcesDrawer'
import type { A2UICitation } from '@/types/a2ui'
import { useAgentStore } from '@/store'

interface Props {
  message: ConversationMessage
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user'
  const [showSources, setShowSources] = useState(false)
  const setPendingTemplate = useAgentStore((s) => s.setPendingTemplate)

  let content: React.ReactNode
  let citations: A2UICitation[] = []
  let followUps: string[] = []

  // Only parse A2UI when NOT streaming — during streaming, content is plain
  // markdown text streamed token by token from Gemini.
  if (!isUser && message.content && !isStreaming) {
    try {
      const parsed = JSON.parse(message.content)
      if (isA2UIResponse(parsed)) {
        content = <A2UIRenderer components={parsed.components} />
        if (Array.isArray(parsed.citations)) {
          citations = parsed.citations as A2UICitation[]
        }
        if (Array.isArray(parsed.follow_ups)) {
          followUps = parsed.follow_ups as string[]
        }
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
          background: '#2563eb',
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
        iQ
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

        {/* Sources button — only shown when citations are available */}
        {citations.length > 0 && (
          <button
            onClick={() => setShowSources(true)}
            style={{
              all: 'unset',
              marginTop: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 20,
              border: '1px solid rgba(37,99,235,0.35)',
              background: 'rgba(37,99,235,0.06)',
              color: '#2563eb',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(37,99,235,0.12)'
              el.style.borderColor = 'rgba(37,99,235,0.6)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(37,99,235,0.06)'
              el.style.borderColor = 'rgba(37,99,235,0.35)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 7v4M8 5v.5" />
            </svg>
            Sources ({citations.length})
          </button>
        )}

        {/* Follow-up question chips */}
        {followUps.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
                stroke="var(--cgpt-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M6 6.5c0-1.1.9-2 2-2s2 .9 2 2c0 .8-.5 1.5-1.2 1.8L8 9v1" />
                <circle cx="8" cy="11.5" r=".5" fill="var(--cgpt-text-muted)" stroke="none" />
              </svg>
              <span style={{ fontSize: 11, color: 'var(--cgpt-text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Follow-up
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {followUps.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setPendingTemplate(q)}
                  style={{
                    all: 'unset',
                    display: 'inline-block',
                    boxSizing: 'border-box',
                    padding: '6px 13px',
                    borderRadius: 16,
                    border: '1px solid var(--cgpt-sidebar-border)',
                    background: 'var(--cgpt-sidebar-bg)',
                    color: 'var(--cgpt-text-secondary)',
                    fontSize: 12,
                    lineHeight: 1.4,
                    whiteSpace: 'normal',
                    cursor: 'pointer',
                    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'rgba(37,99,235,0.06)'
                    el.style.borderColor = 'rgba(37,99,235,0.35)'
                    el.style.color = '#2563eb'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'var(--cgpt-sidebar-bg)'
                    el.style.borderColor = 'var(--cgpt-sidebar-border)'
                    el.style.color = 'var(--cgpt-text-secondary)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSources && (
        <SourcesDrawer citations={citations} onClose={() => setShowSources(false)} />
      )}
    </div>
  )
}
