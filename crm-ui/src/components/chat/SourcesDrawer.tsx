import { useEffect } from 'react'
import type { A2UICitation } from '@/types/a2ui'

interface Props {
  citations: A2UICitation[]
  onClose: () => void
}

export function SourcesDrawer({ citations, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.25)',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 380,
          zIndex: 201,
          background: 'var(--cgpt-sidebar-bg)',
          borderLeft: '1px solid var(--cgpt-sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--cgpt-sidebar-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: '#2563eb' }}>
              <circle cx="8" cy="8" r="6" />
              <path d="M8 7v4M8 5v.5" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--cgpt-text-primary)' }}>
              Sources
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--cgpt-text-muted)',
                background: 'var(--cgpt-sidebar-border)',
                padding: '1px 7px',
                borderRadius: 10,
              }}
            >
              {citations.length}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              all: 'unset',
              cursor: 'pointer',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              color: 'var(--cgpt-text-secondary)',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2l12 12M14 2 2 14" />
            </svg>
          </button>
        </div>

        {/* Source list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {citations.map((c, i) => (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 20px',
                textDecoration: 'none',
                borderBottom: '1px solid var(--cgpt-sidebar-border)',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--cgpt-sidebar-hover)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              }}
            >
              {/* Number badge */}
              <span
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(37,99,235,0.1)',
                  border: '1px solid rgba(37,99,235,0.25)',
                  color: '#2563eb',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--cgpt-text-primary)',
                    lineHeight: 1.4,
                    marginBottom: 3,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {c.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#2563eb',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: 0.8,
                  }}
                >
                  {c.url}
                </div>
              </div>

              {/* External link icon */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--cgpt-text-muted)', flexShrink: 0, marginTop: 4 }}>
                <path d="M6 2H2v12h12v-4M10 2h4v4M14 2 8 8" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
