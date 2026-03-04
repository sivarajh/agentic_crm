import React, { useState, useRef } from 'react'
import { Button, FlexLayout } from '@salt-ds/core'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ onSend, disabled, placeholder = 'Ask the IQ Smart Assistant…' }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    textareaRef.current?.focus()
  }

  return (
    <FlexLayout align="end" gap={1} style={{ width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="salt-message-input"
        style={{
          flex: 1,
          resize: 'none',
          minHeight: 40,
          maxHeight: 128,
          overflowY: 'auto',
          padding: 'var(--salt-spacing-100) var(--salt-spacing-150)',
          border: '1px solid var(--salt-editable-borderColor)',
          borderRadius: 'var(--salt-curve-100)',
          fontFamily: 'var(--salt-text-fontFamily)',
          fontSize: 'var(--salt-text-fontSize)',
          color: 'var(--salt-content-primary-foreground)',
          background: 'var(--salt-editable-primary-background)',
          outline: 'none',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--salt-editable-focused-borderColor)' }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--salt-editable-borderColor)' }}
        onInput={(e) => {
          const t = e.target as HTMLTextAreaElement
          t.style.height = 'auto'
          t.style.height = Math.min(t.scrollHeight, 128) + 'px'
        }}
      />
      <Button
        appearance="solid"
        sentiment="accented"
        onClick={submit}
        disabled={disabled || !value.trim()}
      >
        Send
      </Button>
    </FlexLayout>
  )
}
