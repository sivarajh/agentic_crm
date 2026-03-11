import { useState } from 'react'
import { useAgentStore } from '@/store'

// ─── Salt DS-style SVG icons (stroke, currentColor, 16×16) ───────────────────

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 15h14" />
      <path d="M8 1 1 5h14L8 1Z" />
      <path d="M3 5v10M13 5v10" />
      <path d="M3 10h10" />
      <rect x="6" y="10" width="4" height="5" />
    </svg>
  )
}

function IconExchange() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5h10" />
      <path d="M9 2l3 3-3 3" />
      <path d="M14 11H4" />
      <path d="M7 8l-3 3 3 3" />
    </svg>
  )
}

function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M2 4V3a1 1 0 0 1 1-1h8" />
      <path d="M9 10h4v-2H9a1 1 0 0 0 0 2Z" />
    </svg>
  )
}

function IconBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 14h14" />
      <rect x="2" y="8" width="3" height="6" rx="0.5" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.5" />
      <rect x="11" y="2" width="3" height="12" rx="0.5" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1 2 3.5v5C2 12.2 8 15 8 15s6-2.8 6-6.5v-5L8 1Z" />
      <path d="m5.5 8 2 2 3-3.5" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.76 2.24-4 5-4s5 1.24 5 4" />
      <path d="M11 3c1.38 0 2.5 1.12 2.5 2.5S12.38 8 11 8" />
      <path d="M13 11.5c1.2.6 2 1.5 2 2.5" />
    </svg>
  )
}

function IconLightning() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1 4 9h4l-1 6 6-8H9l1-6Z" />
    </svg>
  )
}

function IconChevronRight({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'block', flexShrink: 0 }}
    >
      <path d="m4 2 4 4-4 4" />
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Prompt { label: string; text: string }

interface Sector {
  id: string
  icon: React.ReactNode
  name: string
  prompts: Prompt[]
}

const SECTORS: Sector[] = [
  {
    id: 'corporate',
    icon: <IconBuilding />,
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
    icon: <IconExchange />,
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
    icon: <IconWallet />,
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
    icon: <IconBarChart />,
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
    icon: <IconShield />,
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
    icon: <IconUsers />,
    name: 'Relationship Mgmt',
    prompts: [
      { label: 'Call prep brief', text: 'Draft a call preparation brief for my next client meeting including recent activity and open actions.' },
      { label: 'Cross-sell opportunities', text: 'What are the top cross-sell product opportunities for our mid-market clients?' },
      { label: 'Dormant clients', text: 'Show clients with no RM contact logged in the past 60 days.' },
      { label: 'NPS at risk', text: 'Which clients have flagged dissatisfaction signals in recent interactions?' },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

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
        <span style={{ color: 'var(--cgpt-text-secondary)', display: 'flex' }}>
          <IconLightning />
        </span>
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
              {/* Sector row */}
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
                  color: isOpen ? 'var(--cgpt-text-primary)' : 'var(--cgpt-text-secondary)',
                  background: isOpen ? 'var(--cgpt-sidebar-hover)' : 'transparent',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isOpen) {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'var(--cgpt-sidebar-hover)'
                    el.style.color = 'var(--cgpt-text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'transparent'
                    el.style.color = 'var(--cgpt-text-secondary)'
                  }
                }}
              >
                <span style={{ display: 'flex', flexShrink: 0 }}>{sector.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{sector.name}</span>
                <span style={{ color: 'var(--cgpt-text-muted)', display: 'flex' }}>
                  <IconChevronRight open={isOpen} />
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
                        borderRadius: 6,
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
                        el.style.background = 'rgba(37,99,235,0.08)'
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
                      <span style={{ opacity: 0.7 }}>
                        {prompt.text.length > 72 ? prompt.text.slice(0, 72) + '…' : prompt.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
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
