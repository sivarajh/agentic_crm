import { useState } from 'react'
import { useAgentStore } from '@/store'

interface Prompt {
  label: string
  text: string
}

interface Sector {
  id: string
  icon: string
  name: string
  prompts: Prompt[]
}

const SECTORS: Sector[] = [
  {
    id: 'corporate',
    icon: '🏦',
    name: 'Corporate Banking',
    prompts: [
      { label: 'Relationship health', text: 'Summarize the relationship health of our top 10 corporate clients this quarter.' },
      { label: 'Unused credit facilities', text: 'Which corporate clients have unused credit facilities over $50M?' },
      { label: 'Loan maturities', text: 'List upcoming loan maturities for the corporate segment in the next 90 days.' },
      { label: 'Revenue by client', text: 'Show total revenue generated per corporate client in the last 12 months.' },
    ],
  },
  {
    id: 'trade',
    icon: '🚢',
    name: 'Trade Finance',
    prompts: [
      { label: 'Expiring LCs', text: 'Show all open letters of credit expiring this month.' },
      { label: 'High utilisation clients', text: 'Identify clients with trade finance utilisation above 80%.' },
      { label: 'Documentary collections', text: 'Summarize the documentary collection pipeline by region.' },
      { label: 'Guarantee exposure', text: 'What is our total bank guarantee exposure by sector?' },
    ],
  },
  {
    id: 'treasury',
    icon: '💰',
    name: 'Treasury & Cash Mgmt',
    prompts: [
      { label: 'Sweep activity', text: 'Which clients have swept excess liquidity in the past 30 days?' },
      { label: 'Product adoption', text: 'Show cash management product adoption rates by client segment.' },
      { label: 'Notional pooling', text: 'Identify clients eligible for notional pooling based on their balance patterns.' },
      { label: 'FX exposure', text: 'Summarize FX hedging coverage for top 20 corporate clients.' },
    ],
  },
  {
    id: 'credit',
    icon: '📊',
    name: 'Credit & Lending',
    prompts: [
      { label: 'Annual review due', text: 'List all credits under annual review due this quarter.' },
      { label: 'Portfolio concentration', text: 'Show loan portfolio concentration by industry sector.' },
      { label: 'Covenant alerts', text: 'Which clients have active covenant monitoring alerts?' },
      { label: 'Past-due accounts', text: 'Identify accounts with payments overdue by more than 30 days.' },
    ],
  },
  {
    id: 'risk',
    icon: '🛡️',
    name: 'Risk & Compliance',
    prompts: [
      { label: 'KYC overdue', text: 'Flag any clients with overdue KYC refresh as of today.' },
      { label: 'Single obligor limits', text: 'Which clients are approaching their single obligor credit limits?' },
      { label: 'Compliance exceptions', text: 'Summarize recent compliance exceptions in the portfolio from the last 30 days.' },
      { label: 'AML alerts', text: 'List open AML transaction monitoring alerts by priority.' },
    ],
  },
  {
    id: 'rm',
    icon: '🤝',
    name: 'Relationship Mgmt',
    prompts: [
      { label: 'Call prep brief', text: 'Draft a call preparation brief for my next client meeting including recent activity and open actions.' },
      { label: 'Cross-sell opportunities', text: 'What are the top cross-sell product opportunities for our mid-market clients?' },
      { label: 'Dormant clients', text: 'Show clients with no RM contact logged in the past 60 days.' },
      { label: 'NPS at risk', text: 'Which clients have flagged dissatisfaction signals in recent interactions?' },
    ],
  },
]

export function PromptTemplatesPanel() {
  const [openSectorId, setOpenSectorId] = useState<string | null>('corporate')
  const { setPendingTemplate } = useAgentStore()

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--cgpt-sidebar-bg)',
        borderLeft: '1px solid var(--cgpt-sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          borderBottom: '1px solid var(--cgpt-sidebar-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15 }}>⚡</span>
        <span style={{ color: 'var(--cgpt-text-primary)', fontWeight: 600, fontSize: 14 }}>
          Prompt Templates
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--cgpt-text-muted)',
            background: 'var(--cgpt-sidebar-border)',
            padding: '2px 6px',
            borderRadius: 8,
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          BANKING
        </span>
      </div>

      {/* Sector list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {SECTORS.map((sector) => {
          const isOpen = openSectorId === sector.id
          return (
            <div key={sector.id}>
              {/* Sector header */}
              <button
                onClick={() => setOpenSectorId(isOpen ? null : sector.id)}
                style={{
                  all: 'unset',
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  color: 'var(--cgpt-text-primary)',
                  background: isOpen ? 'var(--cgpt-sidebar-hover)' : 'transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 14 }}>{sector.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{sector.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--cgpt-text-muted)',
                    transition: 'transform 0.15s',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                  }}
                >
                  ▶
                </span>
              </button>

              {/* Prompt chips */}
              {isOpen && (
                <div style={{ padding: '4px 12px 8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sector.prompts.map((prompt) => (
                    <button
                      key={prompt.label}
                      onClick={() => setPendingTemplate(prompt.text)}
                      title={prompt.text}
                      style={{
                        all: 'unset',
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--cgpt-sidebar-border)',
                        background: 'transparent',
                        color: 'var(--cgpt-text-secondary)',
                        fontSize: 12,
                        cursor: 'pointer',
                        lineHeight: 1.4,
                        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                        textAlign: 'left',
                        wordBreak: 'break-word',
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.background = 'rgba(37,99,235,0.1)'
                        el.style.borderColor = '#2563eb'
                        el.style.color = 'var(--cgpt-text-primary)'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.background = 'transparent'
                        el.style.borderColor = 'var(--cgpt-sidebar-border)'
                        el.style.color = 'var(--cgpt-text-secondary)'
                      }}
                    >
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--cgpt-text-primary)', fontSize: 11 }}>
                        {prompt.label}
                      </span>
                      <span style={{ opacity: 0.75 }}>{prompt.text.length > 72 ? prompt.text.slice(0, 72) + '…' : prompt.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--cgpt-sidebar-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--cgpt-text-muted)', lineHeight: 1.5 }}>
          Click any prompt to prefill the chat input.
        </span>
      </div>
    </aside>
  )
}
