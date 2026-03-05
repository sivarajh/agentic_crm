import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChatWindow } from '../chat/ChatWindow'
import { SessionPanel } from './SessionPanel'
import { PromptTemplatesPanel } from './PromptTemplatesPanel'
import { useConversationStore, useThemeStore } from '@/store'

export function AppShell() {
  const location = useLocation()
  const { setViewingConversation } = useConversationStore()
  const { theme, toggleTheme } = useThemeStore()

  // Sync URL → store
  useEffect(() => {
    const match = location.pathname.match(/^\/conversation\/(.+)$/)
    setViewingConversation(match ? match[1] : null)
  }, [location.pathname])

  // Apply data-theme attribute to <html> so CSS vars switch
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const isDark = theme === 'dark'
  const [showTemplates, setShowTemplates] = useState(true)

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden', background: 'var(--cgpt-main-bg)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: 'var(--cgpt-sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--cgpt-sidebar-border)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            borderBottom: '1px solid var(--cgpt-sidebar-border)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            iQ
          </div>
          <span style={{ color: 'var(--cgpt-text-primary)', fontWeight: 600, fontSize: 15 }}>
            iQ Smart Assist
          </span>
        </div>

        <SessionPanel />
      </aside>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top header */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--cgpt-sidebar-border)',
            background: 'var(--cgpt-header-bg)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'var(--cgpt-text-primary)', fontWeight: 600, fontSize: 15 }}>
            iQ Smart Assistant
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Prompt templates toggle */}
            <button
              onClick={() => setShowTemplates((v) => !v)}
              title={showTemplates ? 'Hide prompt templates' : 'Show prompt templates'}
              style={{
                all: 'unset',
                cursor: 'pointer',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${showTemplates ? '#2563eb' : 'var(--cgpt-sidebar-border)'}`,
                background: showTemplates ? 'rgba(37,99,235,0.12)' : 'transparent',
                color: showTemplates ? '#2563eb' : 'var(--cgpt-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              }}
            >
              ⚡
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                all: 'unset',
                cursor: 'pointer',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid var(--cgpt-sidebar-border)',
                background: 'transparent',
                color: 'var(--cgpt-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'var(--cgpt-sidebar-hover)'
                el.style.color = 'var(--cgpt-text-primary)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'transparent'
                el.style.color = 'var(--cgpt-text-secondary)'
              }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatWindow />
        </div>
      </div>

      {showTemplates && <PromptTemplatesPanel />}
    </div>
  )
}
