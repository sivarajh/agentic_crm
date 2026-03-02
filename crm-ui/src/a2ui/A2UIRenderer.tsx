import type { A2UIComponent, StatItem, KVRow } from '@/types/a2ui'

interface RendererProps {
  components: A2UIComponent[]
}

/**
 * A2UI Renderer — interprets A2UI component descriptors returned by agents
 * and renders them as React elements using approved component catalog.
 *
 * Security: Only renders from the approved component catalog.
 * No arbitrary code execution.
 */
export function A2UIRenderer({ components }: RendererProps) {
  return (
    <div className="a2ui-root space-y-3">
      {components.map((comp, idx) => (
        <A2UIComponentRenderer key={comp.id ?? idx} component={comp} />
      ))}
    </div>
  )
}

// ── Color maps ────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  green:  'bg-green-100 text-green-800 ring-green-200',
  red:    'bg-red-100 text-red-800 ring-red-200',
  blue:   'bg-blue-100 text-blue-800 ring-blue-200',
  yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  purple: 'bg-purple-100 text-purple-800 ring-purple-200',
  gray:   'bg-gray-100 text-gray-700 ring-gray-200',
  orange: 'bg-orange-100 text-orange-800 ring-orange-200',
}

const SECTION_ACCENT: Record<string, string> = {
  blue:   'border-l-blue-500 bg-blue-50/60',
  green:  'border-l-green-500 bg-green-50/60',
  red:    'border-l-red-500 bg-red-50/60',
  yellow: 'border-l-yellow-500 bg-yellow-50/60',
  purple: 'border-l-purple-500 bg-purple-50/60',
  gray:   'border-l-gray-400 bg-gray-50/60',
  orange: 'border-l-orange-500 bg-orange-50/60',
}

const STAT_BG: Record<string, string> = {
  green:  'bg-green-50 border-green-200',
  red:    'bg-red-50 border-red-200',
  blue:   'bg-blue-50 border-blue-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  purple: 'bg-purple-50 border-purple-200',
  gray:   'bg-gray-50 border-gray-200',
}

const STAT_VALUE: Record<string, string> = {
  green:  'text-green-700',
  red:    'text-red-700',
  blue:   'text-blue-700',
  yellow: 'text-yellow-700',
  purple: 'text-purple-700',
  gray:   'text-gray-700',
}

const PROGRESS_BAR: Record<string, string> = {
  green:  'bg-green-500',
  red:    'bg-red-500',
  blue:   'bg-blue-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  gray:   'bg-gray-400',
  orange: 'bg-orange-500',
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-11 w-11 text-base' }
  // Deterministic colour from name
  const hues = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
  ]
  const hue = hues[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % hues.length]

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizes[size]} ${hue}`}
    >
      {initials}
    </span>
  )
}

function TrendArrow({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend || trend === 'flat') return <span className="text-gray-400 text-xs">→</span>
  return trend === 'up'
    ? <span className="text-green-600 text-xs font-bold">↑</span>
    : <span className="text-red-600 text-xs font-bold">↓</span>
}

// ── Main component renderer ───────────────────────────────────────────────────

function A2UIComponentRenderer({ component }: { component: A2UIComponent }) {
  const { type, props = {}, content, children = [] } = component

  switch (type) {

    // ── Primitives ────────────────────────────────────────────────────────────

    case 'text':
      return <p className="text-sm text-gray-800 leading-relaxed">{content}</p>

    case 'markdown':
      return (
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm font-sans text-gray-800 leading-relaxed">{content}</pre>
        </div>
      )

    case 'divider':
      return <hr className="border-gray-200 my-1" />

    // ── Badge ─────────────────────────────────────────────────────────────────

    case 'badge': {
      const color = (props.color as string) ?? 'gray'
      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            BADGE_COLORS[color] ?? BADGE_COLORS.gray
          }`}
        >
          {content}
        </span>
      )
    }

    // ── Card ──────────────────────────────────────────────────────────────────

    case 'card':
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {Boolean(props.title) && (
            <h3 className="mb-3 font-semibold text-gray-900 text-sm">
              {String(props.title)}
            </h3>
          )}
          <div className="space-y-2">
            {children.map((child, i) => (
              <A2UIComponentRenderer key={i} component={child} />
            ))}
          </div>
        </div>
      )

    // ── List ──────────────────────────────────────────────────────────────────

    case 'list':
      return (
        <ul className="space-y-1 text-sm text-gray-800">
          {children.map((child, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              <A2UIComponentRenderer component={child} />
            </li>
          ))}
        </ul>
      )

    // ── Table ─────────────────────────────────────────────────────────────────

    case 'table': {
      const headers = (props.headers as string[]) ?? []
      const rows = (props.rows as string[][]) ?? []
      return (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 text-gray-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // ── Button ────────────────────────────────────────────────────────────────

    case 'button': {
      const variant = (props.variant as string) ?? 'primary'
      const btnClasses =
        variant === 'secondary'
          ? 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
          : 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
      return (
        <button type="button" className={btnClasses}>
          {content}
        </button>
      )
    }

    // ── Form (read-only display) ──────────────────────────────────────────────

    case 'form':
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          {Boolean(props.title) && (
            <h3 className="font-semibold text-gray-900 text-sm">{String(props.title)}</h3>
          )}
          {children.map((child, i) => (
            <A2UIComponentRenderer key={i} component={child} />
          ))}
        </div>
      )

    // ── Chart (placeholder) ───────────────────────────────────────────────────

    case 'chart':
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          📊 {(props.title as string) ?? 'Chart'}
        </div>
      )

    // ── CRM: Section ──────────────────────────────────────────────────────────
    // props: { title, color?, icon? }

    case 'section': {
      const color = (props.color as string) ?? 'blue'
      const icon = props.icon as string | undefined
      const accent = SECTION_ACCENT[color] ?? SECTION_ACCENT.blue

      return (
        <div className={`rounded-xl border-l-4 px-4 py-3 ${accent}`}>
          {Boolean(props.title) && (
            <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              {icon && <span>{icon}</span>}
              {String(props.title)}
            </h3>
          )}
          <div className="space-y-2">
            {children.map((child, i) => (
              <A2UIComponentRenderer key={i} component={child} />
            ))}
          </div>
        </div>
      )
    }

    // ── CRM: Stat Grid ────────────────────────────────────────────────────────
    // props: { stats: StatItem[] }

    case 'stat_grid': {
      const stats = (props.stats as StatItem[]) ?? []
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((stat, i) => {
            const color = stat.color ?? 'blue'
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${STAT_BG[color] ?? STAT_BG.blue}`}
              >
                <p className="text-xs text-gray-500 font-medium truncate">{stat.label}</p>
                <div className="mt-1 flex items-end justify-between gap-1">
                  <p className={`text-lg font-bold leading-tight ${STAT_VALUE[color] ?? STAT_VALUE.blue}`}>
                    {stat.value}
                  </p>
                  {stat.trend && <TrendArrow trend={stat.trend} />}
                </div>
                {stat.sublabel && (
                  <p className="mt-0.5 text-xs text-gray-400 truncate">{stat.sublabel}</p>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    // ── CRM: Key-Value Table ──────────────────────────────────────────────────
    // props: { rows: KVRow[] }

    case 'kv_table': {
      const rows = (props.rows as KVRow[]) ?? []
      return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <dl className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 gap-4 hover:bg-gray-50 transition-colors"
              >
                <dt className="text-xs font-medium text-gray-500 shrink-0 w-36">{row.key}</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-sm text-gray-800 truncate ${
                      row.monospace ? 'font-mono text-xs' : ''
                    }`}
                  >
                    {row.value}
                  </span>
                  {row.badge && (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        BADGE_COLORS[row.badge.color ?? 'gray'] ?? BADGE_COLORS.gray
                      }`}
                    >
                      {row.badge.text}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )
    }

    // ── CRM: Progress / Score Bar ─────────────────────────────────────────────
    // props: { label, value (0-100), color?, sublabel? }

    case 'progress': {
      const value = Math.min(100, Math.max(0, Number(props.value ?? 0)))
      const color = (props.color as string) ?? 'blue'
      const label = props.label as string | undefined
      const sublabel = props.sublabel as string | undefined
      const bar = PROGRESS_BAR[color] ?? PROGRESS_BAR.blue

      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            {label && <span className="font-medium text-gray-700">{label}</span>}
            <span className={`font-bold tabular-nums ${STAT_VALUE[color] ?? STAT_VALUE.blue}`}>
              {value}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${bar}`}
              style={{ width: `${value}%` }}
            />
          </div>
          {sublabel && (
            <p className="text-xs text-gray-400">{sublabel}</p>
          )}
        </div>
      )
    }

    // ── CRM: Contact Chip ─────────────────────────────────────────────────────
    // props: { name, title?, company?, email?, phone? }

    case 'contact_chip': {
      const name = (props.name as string) ?? 'Unknown'
      const title = props.title as string | undefined
      const company = props.company as string | undefined
      const email = props.email as string | undefined
      const phone = props.phone as string | undefined

      return (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
          <Avatar name={name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            {(title || company) && (
              <p className="text-xs text-gray-500 truncate">
                {[title, company].filter(Boolean).join(' · ')}
              </p>
            )}
            {(email || phone) && (
              <div className="mt-0.5 flex gap-3">
                {email && (
                  <span className="text-xs text-blue-600 truncate">{email}</span>
                )}
                {phone && (
                  <span className="text-xs text-gray-500">{phone}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    default:
      // Unknown component type — render nothing (security: no fallback eval)
      return null
  }
}
