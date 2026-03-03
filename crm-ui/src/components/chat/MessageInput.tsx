import React, { useState, useRef } from 'react'
import { clsx } from 'clsx'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  disabled,
  placeholder = 'Ask the IQ Smart Assistant...',
}: Props) {
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
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={clsx(
          'flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3',
          'text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'max-h-32 overflow-y-auto'
        )}
        style={{
          height: 'auto',
          minHeight: '44px',
        }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement
          target.style.height = 'auto'
          target.style.height = Math.min(target.scrollHeight, 128) + 'px'
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className={clsx(
          'flex-shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white',
          'transition-colors hover:bg-blue-700',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        Send
      </button>
    </div>
  )
}
