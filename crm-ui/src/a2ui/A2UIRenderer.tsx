import type { A2UIComponent, StatItem, KVRow } from '@/types/a2ui'
import {
  Text, Card, Button, Divider,
  FlexLayout, StackLayout,
} from '@salt-ds/core'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface RendererProps {
  components: A2UIComponent[]
}

/**
 * A2UI Renderer — interprets A2UI component descriptors returned by agents
 * and renders them as Salt Design System components.
 *
 * Security: Only renders from the approved component catalog.
 * No arbitrary code execution.
 */
export function A2UIRenderer({ components }: RendererProps) {
  return (
    <StackLayout gap={2} style={{ width: '100%' }}>
      {components.map((comp, idx) => (
        <A2UIComponentRenderer key={comp.id ?? idx} component={comp} />
      ))}
    </StackLayout>
  )
}

// ── Salt DS token-based color maps ───────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  green:  'var(--salt-status-positive-background)',
  red:    'var(--salt-status-negative-background)',
  blue:   'var(--salt-status-info-background)',
  yellow: 'var(--salt-status-warning-background)',
  orange: 'var(--salt-status-warning-background)',
  purple: '#f3f0ff',
  gray:   'var(--salt-container-secondary-background)',
}

const STATUS_FG: Record<string, string> = {
  green:  'var(--salt-status-positive-foreground)',
  red:    'var(--salt-status-negative-foreground)',
  blue:   'var(--salt-status-info-foreground)',
  yellow: 'var(--salt-status-warning-foreground)',
  orange: 'var(--salt-status-warning-foreground)',
  purple: '#7c3aed',
  gray:   'var(--salt-content-secondary-foreground)',
}

const STATUS_BORDER: Record<string, string> = {
  green:  'var(--salt-status-positive-borderColor)',
  red:    'var(--salt-status-negative-borderColor)',
  blue:   'var(--salt-status-info-borderColor)',
  yellow: 'var(--salt-status-warning-borderColor)',
  orange: 'var(--salt-status-warning-borderColor)',
  purple: '#7c3aed',
  gray:   'var(--salt-separable-borderColor)',
}

const SECTION_LEFT_BORDER: Record<string, string> = {
  green:  '3px solid var(--salt-status-positive-borderColor)',
  red:    '3px solid var(--salt-status-negative-borderColor)',
  blue:   '3px solid var(--salt-status-info-borderColor)',
  yellow: '3px solid var(--salt-status-warning-borderColor)',
  orange: '3px solid var(--salt-status-warning-borderColor)',
  purple: '3px solid #7c3aed',
  gray:   '3px solid var(--salt-separable-borderColor)',
}

// ── Helper: coloured status badge (Pill-like) ─────────────────────────────────

function StatusBadge({ text, color = 'gray' }: { text: string; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--salt-curve-1000)',
        padding: '2px var(--salt-spacing-100)',
        fontSize: 'var(--salt-text-label-fontSize)',
        fontWeight: 600,
        background: STATUS_BG[color] ?? STATUS_BG.gray,
        color: STATUS_FG[color] ?? STATUS_FG.gray,
        border: `1px solid ${STATUS_BORDER[color] ?? STATUS_BORDER.gray}`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {text}
    </span>
  )
}

// ── Helper: trend arrow ───────────────────────────────────────────────────────

function TrendArrow({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend || trend === 'flat') {
    return <Text style={{ color: 'var(--salt-content-secondary-foreground)', fontSize: 12 }}>→</Text>
  }
  return trend === 'up'
    ? <Text style={{ color: 'var(--salt-status-positive-foreground)', fontSize: 12, fontWeight: 700 }}>↑</Text>
    : <Text style={{ color: 'var(--salt-status-negative-foreground)', fontSize: 12, fontWeight: 700 }}>↓</Text>
}

// ── Main component renderer ───────────────────────────────────────────────────

function A2UIComponentRenderer({ component }: { component: A2UIComponent }) {
  const { type, props = {}, content, children = [] } = component

  switch (type) {

    // ── text ─────────────────────────────────────────────────────────────────

    case 'text':
      return (
        <div className="a2ui-markdown a2ui-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Render paragraph as inline span to avoid extra block spacing
              p: ({ children }) => <span style={{ lineHeight: 1.6, display: 'block' }}>{children}</span>,
              h1: ({ children }) => <Text styleAs="h1" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              h2: ({ children }) => <Text styleAs="h2" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              h3: ({ children }) => <Text styleAs="h3" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              h4: ({ children }) => <Text styleAs="h4" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--salt-status-info-foreground)', textDecoration: 'underline' }}>
                  {children}
                </a>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith('language-')
                return isBlock ? (
                  <pre style={{
                    background: 'var(--salt-container-secondary-background)',
                    border: '1px solid var(--salt-separable-borderColor)',
                    borderRadius: 'var(--salt-curve-100)',
                    padding: 'var(--salt-spacing-150)',
                    overflowX: 'auto',
                    margin: '0.5em 0',
                  }}>
                    <code style={{ fontFamily: 'var(--salt-text-code-fontFamily)', fontSize: 13 }}>{children}</code>
                  </pre>
                ) : (
                  <code style={{
                    fontFamily: 'var(--salt-text-code-fontFamily)',
                    fontSize: 13,
                    background: 'var(--salt-container-secondary-background)',
                    borderRadius: 3,
                    padding: '1px 5px',
                  }}>{children}</code>
                )
              },
              ul: ({ children }) => <ul style={{ paddingLeft: '1.5em', margin: '0.25em 0', lineHeight: 1.7 }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: '1.5em', margin: '0.25em 0', lineHeight: 1.7 }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
              strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
            }}
          >
            {String(content ?? '')}
          </ReactMarkdown>
        </div>
      )

    // ── markdown ─────────────────────────────────────────────────────────────

    case 'markdown':
      return (
        <div className="a2ui-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <Text styleAs="h1" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              h2: ({ children }) => <Text styleAs="h2" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              h3: ({ children }) => <Text styleAs="h3" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              h4: ({ children }) => <Text styleAs="h4" style={{ margin: '0.5em 0 0.25em' }}>{children}</Text>,
              p:  ({ children }) => <Text as="p" style={{ margin: '0.25em 0', lineHeight: 1.6 }}>{children}</Text>,
              a:  ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--salt-status-info-foreground)', textDecoration: 'underline' }}>
                  {children}
                </a>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith('language-')
                return isBlock ? (
                  <pre style={{
                    background: 'var(--salt-container-secondary-background)',
                    border: '1px solid var(--salt-separable-borderColor)',
                    borderRadius: 'var(--salt-curve-100)',
                    padding: 'var(--salt-spacing-150)',
                    overflowX: 'auto',
                    margin: '0.5em 0',
                  }}>
                    <code style={{ fontFamily: 'var(--salt-text-code-fontFamily)', fontSize: 13 }}>{children}</code>
                  </pre>
                ) : (
                  <code style={{
                    fontFamily: 'var(--salt-text-code-fontFamily)',
                    fontSize: 13,
                    background: 'var(--salt-container-secondary-background)',
                    borderRadius: 3,
                    padding: '1px 5px',
                  }}>{children}</code>
                )
              },
              ul: ({ children }) => (
                <ul style={{ paddingLeft: '1.5em', margin: '0.25em 0', lineHeight: 1.7 }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ paddingLeft: '1.5em', margin: '0.25em 0', lineHeight: 1.7 }}>{children}</ol>
              ),
              li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
              blockquote: ({ children }) => (
                <blockquote style={{
                  borderLeft: '3px solid var(--salt-status-info-borderColor)',
                  paddingLeft: 'var(--salt-spacing-150)',
                  margin: '0.5em 0',
                  color: 'var(--salt-content-secondary-foreground)',
                }}>
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div style={{ overflowX: 'auto', margin: '0.5em 0' }}>
                  <table style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    border: '1px solid var(--salt-separable-borderColor)',
                    borderRadius: 'var(--salt-curve-100)',
                  }}>
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th style={{
                  padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
                  background: 'var(--salt-container-secondary-background)',
                  borderBottom: '1px solid var(--salt-separable-borderColor)',
                  textAlign: 'left',
                  fontWeight: 600,
                }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td style={{
                  padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
                  borderBottom: '1px solid var(--salt-separable-borderColor)',
                }}>
                  {children}
                </td>
              ),
              hr: () => <Divider />,
              strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
            }}
          >
            {String(content ?? '')}
          </ReactMarkdown>
        </div>
      )

    // ── divider ──────────────────────────────────────────────────────────────

    case 'divider':
      return <Divider />

    // ── badge ─────────────────────────────────────────────────────────────────

    case 'badge':
      return (
        <StatusBadge text={String(content ?? '')} color={(props.color as string) ?? 'gray'} />
      )

    // ── card ──────────────────────────────────────────────────────────────────

    case 'card':
      return (
        <Card>
          <StackLayout gap={1}>
            {Boolean(props.title) && (
              <Text styleAs="h4" style={{ margin: 0 }}>{String(props.title)}</Text>
            )}
            {children.map((child, i) => (
              <A2UIComponentRenderer key={i} component={child} />
            ))}
          </StackLayout>
        </Card>
      )

    // ── list ──────────────────────────────────────────────────────────────────

    case 'list':
      return (
        <StackLayout gap={0}>
          {children.map((child, i) => (
            <FlexLayout key={i} gap={1} align="start">
              <span
                style={{
                  marginTop: 7,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--salt-status-info-foreground)',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <A2UIComponentRenderer component={child} />
            </FlexLayout>
          ))}
        </StackLayout>
      )

    // ── table ─────────────────────────────────────────────────────────────────

    case 'table': {
      const headers = (props.headers as string[]) ?? []
      const rows = (props.rows as string[][]) ?? []
      return (
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--salt-separable-borderColor)',
            borderRadius: 'var(--salt-curve-100)',
          }}
        >
          <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--salt-container-secondary-background)' }}>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--salt-separable-borderColor)',
                    }}
                  >
                    <Text styleAs="label" style={{ fontWeight: 600 }}>{h}</Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < rows.length - 1 ? '1px solid var(--salt-separable-borderColor)' : undefined,
                  }}
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{ padding: 'var(--salt-spacing-100) var(--salt-spacing-200)' }}
                    >
                      <span style={{ fontSize: 'var(--salt-text-fontSize)', color: 'var(--salt-content-primary-foreground)' }}>
                        {cell}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // ── button ────────────────────────────────────────────────────────────────

    case 'button': {
      const variant = (props.variant as string) ?? 'primary'
      return (
        <Button
          appearance={variant === 'secondary' ? 'bordered' : 'solid'}
          sentiment={variant === 'secondary' ? 'neutral' : 'accented'}
        >
          {content}
        </Button>
      )
    }

    // ── form ──────────────────────────────────────────────────────────────────

    case 'form':
      return (
        <Card>
          <StackLayout gap={2}>
            {Boolean(props.title) && (
              <Text styleAs="h4" style={{ margin: 0 }}>{String(props.title)}</Text>
            )}
            {children.map((child, i) => (
              <A2UIComponentRenderer key={i} component={child} />
            ))}
          </StackLayout>
        </Card>
      )

    // ── chart (placeholder) ───────────────────────────────────────────────────

    case 'chart':
      return (
        <div
          style={{
            border: '1px dashed var(--salt-separable-borderColor)',
            borderRadius: 'var(--salt-curve-100)',
            padding: 'var(--salt-spacing-200)',
            textAlign: 'center',
          }}
        >
          <Text style={{ color: 'var(--salt-content-secondary-foreground)' }}>
            📊 {(props.title as string) ?? 'Chart'}
          </Text>
        </div>
      )

    // ── CRM: section ─────────────────────────────────────────────────────────
    // props: { title, color?, icon? }

    case 'section': {
      const color = (props.color as string) ?? 'blue'
      const icon = props.icon as string | undefined

      return (
        <div
          style={{
            borderLeft: SECTION_LEFT_BORDER[color] ?? SECTION_LEFT_BORDER.blue,
            background: STATUS_BG[color] ?? STATUS_BG.blue,
            borderRadius: `0 var(--salt-curve-100) var(--salt-curve-100) 0`,
            padding: 'var(--salt-spacing-150) var(--salt-spacing-200)',
          }}
        >
          {Boolean(props.title) && (
            <FlexLayout gap={1} align="center" style={{ marginBottom: 'var(--salt-spacing-100)' }}>
              {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
              <Text styleAs="h4" style={{ margin: 0, color: STATUS_FG[color] ?? STATUS_FG.blue }}>
                {String(props.title)}
              </Text>
            </FlexLayout>
          )}
          <StackLayout gap={1}>
            {children.map((child, i) => (
              <A2UIComponentRenderer key={i} component={child} />
            ))}
          </StackLayout>
        </div>
      )
    }

    // ── CRM: stat_grid ────────────────────────────────────────────────────────
    // props: { stats: StatItem[] }

    case 'stat_grid': {
      const stats = (props.stats as StatItem[]) ?? []
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 'var(--salt-spacing-100)',
          }}
        >
          {stats.map((stat, i) => {
            const color = stat.color ?? 'blue'
            return (
              <div
                key={i}
                style={{
                  background: STATUS_BG[color] ?? STATUS_BG.blue,
                  border: `1px solid ${STATUS_BORDER[color] ?? STATUS_BORDER.blue}`,
                  borderRadius: 'var(--salt-curve-100)',
                  padding: 'var(--salt-spacing-150)',
                }}
              >
                <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)', display: 'block' }}>
                  {stat.label}
                </Text>
                <FlexLayout align="end" justify="space-between" style={{ marginTop: 4 }}>
                  <Text
                    styleAs="h3"
                    style={{ margin: 0, color: STATUS_FG[color] ?? STATUS_FG.blue, lineHeight: 1.2 }}
                  >
                    {stat.value}
                  </Text>
                  {stat.trend && <TrendArrow trend={stat.trend} />}
                </FlexLayout>
                {stat.sublabel && (
                  <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)', marginTop: 2 }}>
                    {stat.sublabel}
                  </Text>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    // ── CRM: kv_table ─────────────────────────────────────────────────────────
    // props: { rows: KVRow[] }

    case 'kv_table': {
      const rows = (props.rows as KVRow[]) ?? []
      return (
        <div
          style={{
            border: '1px solid var(--salt-separable-borderColor)',
            borderRadius: 'var(--salt-curve-100)',
            background: 'var(--salt-container-primary-background)',
            overflow: 'hidden',
          }}
        >
          {rows.map((row, i) => (
            <FlexLayout
              key={i}
              justify="space-between"
              align="center"
              gap={2}
              style={{
                padding: 'var(--salt-spacing-100) var(--salt-spacing-200)',
                borderBottom: i < rows.length - 1 ? '1px solid var(--salt-separable-borderColor)' : undefined,
              }}
            >
              <Text
                styleAs="label"
                style={{
                  color: 'var(--salt-content-secondary-foreground)',
                  flexShrink: 0,
                  width: 140,
                }}
              >
                {row.key}
              </Text>
              <FlexLayout align="center" gap={1} style={{ minWidth: 0, overflow: 'hidden' }}>
                <span
                  title={row.value}
                  style={{
                    fontFamily: row.monospace ? 'var(--salt-text-code-fontFamily)' : undefined,
                    fontSize: row.monospace ? 11 : 'var(--salt-text-fontSize)',
                    color: 'var(--salt-content-primary-foreground)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {row.value}
                </span>
                {row.badge && (
                  <StatusBadge text={row.badge.text} color={row.badge.color ?? 'gray'} />
                )}
              </FlexLayout>
            </FlexLayout>
          ))}
        </div>
      )
    }

    // ── CRM: progress ─────────────────────────────────────────────────────────
    // props: { label, value (0-100), color?, sublabel? }

    case 'progress': {
      const value = Math.min(100, Math.max(0, Number(props.value ?? 0)))
      const color = (props.color as string) ?? 'blue'
      const label = props.label as string | undefined
      const sublabel = props.sublabel as string | undefined

      return (
        <StackLayout gap={0}>
          <FlexLayout justify="space-between" align="center">
            {label && (
              <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>
                {label}
              </Text>
            )}
            <Text styleAs="label" style={{ color: STATUS_FG[color] ?? STATUS_FG.blue, fontWeight: 700 }}>
              {value}%
            </Text>
          </FlexLayout>
          {/* Custom progress bar using Salt tokens */}
          <div
            style={{
              height: 6,
              width: '100%',
              borderRadius: 'var(--salt-curve-1000)',
              background: 'var(--salt-container-secondary-background)',
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${value}%`,
                borderRadius: 'var(--salt-curve-1000)',
                background: STATUS_FG[color] ?? STATUS_FG.blue,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          {sublabel && (
            <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)', marginTop: 2 }}>
              {sublabel}
            </Text>
          )}
        </StackLayout>
      )
    }

    // ── CRM: contact_chip ─────────────────────────────────────────────────────
    // props: { name, title?, company?, email?, phone? }

    case 'contact_chip': {
      const name = (props.name as string) ?? 'Unknown'
      const title = props.title as string | undefined
      const company = props.company as string | undefined
      const email = props.email as string | undefined
      const phone = props.phone as string | undefined

      const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')

      // Deterministic background from Salt DS categorical palette tokens
      const catIdx = ((name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % 20) + 1

      return (
        <Card>
          <FlexLayout gap={2} align="center">
            {/* Custom avatar circle using Salt DS categorical tokens */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `var(--salt-palette-categorical-${catIdx})`,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              {initials}
            </div>
            <StackLayout gap={0} style={{ minWidth: 0, flex: 1 }}>
              <Text styleAs="h4" style={{ margin: 0 }}>{name}</Text>
              {(title || company) && (
                <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>
                  {[title, company].filter(Boolean).join(' · ')}
                </Text>
              )}
              {(email || phone) && (
                <FlexLayout gap={2} style={{ marginTop: 2 }}>
                  {email && (
                    <Text styleAs="label" style={{ color: 'var(--salt-status-info-foreground)' }}>
                      {email}
                    </Text>
                  )}
                  {phone && (
                    <Text styleAs="label" style={{ color: 'var(--salt-content-secondary-foreground)' }}>
                      {phone}
                    </Text>
                  )}
                </FlexLayout>
              )}
            </StackLayout>
          </FlexLayout>
        </Card>
      )
    }

    default:
      // Unknown component type — render nothing (security: no fallback eval)
      return null
  }
}
