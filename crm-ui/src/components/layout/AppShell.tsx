import { useState } from 'react'
import { Text, Pill, FlexLayout, StackLayout, Button } from '@salt-ds/core'
import { ChatWindow } from '../chat/ChatWindow'
import { SessionPanel } from './SessionPanel'
import { useConversationStore, useAgentStore } from '@/store'

export function AppShell() {
  const [showConfirm, setShowConfirm] = useState(false)
  const { clearMessages } = useConversationStore()
  const { clearStreamingContent, setAgentStatus } = useAgentStore()

  function handleClearHistory() {
    clearMessages()
    clearStreamingContent()
    setAgentStatus('idle')
    setShowConfirm(false)
  }

  return (
    <FlexLayout direction="row" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid var(--salt-separable-borderColor)',
          background: 'var(--salt-container-primary-background)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <FlexLayout
          align="center"
          gap={1}
          style={{
            height: 56,
            padding: '0 var(--salt-spacing-200)',
            borderBottom: '1px solid var(--salt-separable-borderColor)',
            flexShrink: 0,
          }}
        >
          <Text styleAs="h4" style={{ margin: 0 }}>IQ Smart Assist</Text>
          <Pill>AI</Pill>
        </FlexLayout>
        <SessionPanel />
      </aside>

      {/* Main area */}
      <StackLayout
        direction="column"
        gap={0}
        style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}
      >
        <FlexLayout
          align="center"
          justify="space-between"
          style={{
            height: 56,
            padding: '0 var(--salt-spacing-300)',
            borderBottom: '1px solid var(--salt-separable-borderColor)',
            background: 'var(--salt-container-primary-background)',
            flexShrink: 0,
          }}
        >
          <Text styleAs="h4" style={{ margin: 0 }}>IQ Smart Assistant</Text>
          <Button
            appearance="transparent"
            sentiment="negative"
            onClick={() => setShowConfirm(true)}
            title="Clear chat history"
            style={{ padding: 'var(--salt-spacing-100)' }}
          >
            ✕ Clear History
          </Button>
        </FlexLayout>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatWindow />
        </div>
      </StackLayout>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{
              background: 'var(--salt-container-primary-background)',
              border: '1px solid var(--salt-separable-borderColor)',
              borderRadius: 'var(--salt-curve-100)',
              padding: 'var(--salt-spacing-300)',
              maxWidth: 380,
              width: '90%',
              boxShadow: 'var(--salt-shadow-5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <StackLayout gap={2}>
              <StackLayout gap={1}>
                <Text styleAs="h3" style={{ margin: 0 }}>Clear Chat History?</Text>
                <Text style={{ color: 'var(--salt-content-secondary-foreground)' }}>
                  This will permanently delete all messages in this conversation.
                  This action cannot be undone.
                </Text>
              </StackLayout>
              <FlexLayout gap={1} justify="end">
                <Button appearance="bordered" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button appearance="solid" sentiment="negative" onClick={handleClearHistory}>
                  Clear History
                </Button>
              </FlexLayout>
            </StackLayout>
          </div>
        </div>
      )}
    </FlexLayout>
  )
}
