import React, { useState, useRef } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ onSend, disabled, placeholder = 'Message IQ Smart Assistant…' }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        background: 'var(--cgpt-input-bg)',
        border: `1px solid ${focused ? 'var(--cgpt-input-focused)' : 'var(--cgpt-input-border)'}`,
        borderRadius: 12,
        padding: '10px 12px 10px 16px',
        transition: 'border-color 0.15s',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={(e) => {
          const t = e.target as HTMLTextAreaElement
          t.style.height = 'auto'
          t.style.height = Math.min(t.scrollHeight, 200) + 'px'
        }}
        style={{
          flex: 1,
          resize: 'none',
          minHeight: 24,
          maxHeight: 200,
          overflowY: 'auto',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--cgpt-text-primary)',
          fontSize: 15,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          padding: 0,
          caretColor: 'var(--cgpt-accent)',
        }}
      />
      {/* Send button — arrow circle like ChatGPT */}
      <button
        onClick={submit}
        disabled={!canSend}
        title="Send message"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          background: canSend ? 'var(--cgpt-send-btn-bg)' : 'var(--cgpt-sidebar-border)',
          color: canSend ? 'var(--cgpt-send-btn-fg)' : 'var(--cgpt-text-muted)',
          cursor: canSend ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
          fontSize: 16,
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          if (canSend) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-accent-hover)'
        }}
        onMouseLeave={(e) => {
          if (canSend) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-send-btn-bg)'
        }}
      >
        ↑
      </button>
    </div>
  )
}
