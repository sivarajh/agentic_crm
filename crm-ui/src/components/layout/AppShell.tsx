import { Text, Pill, FlexLayout, StackLayout } from '@salt-ds/core'
import { ChatWindow } from '../chat/ChatWindow'
import { SessionPanel } from './SessionPanel'

export function AppShell() {
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
          style={{
            height: 56,
            padding: '0 var(--salt-spacing-300)',
            borderBottom: '1px solid var(--salt-separable-borderColor)',
            background: 'var(--salt-container-primary-background)',
            flexShrink: 0,
          }}
        >
          <Text styleAs="h4" style={{ margin: 0 }}>IQ Smart Assistant</Text>
        </FlexLayout>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatWindow />
        </div>
      </StackLayout>
    </FlexLayout>
  )
}
