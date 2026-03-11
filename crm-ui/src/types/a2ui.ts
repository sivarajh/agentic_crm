/**
 * A2UI Protocol type definitions.
 * Agents return A2UI-compliant component descriptors; the UI renders them.
 */

export type A2UIComponentType =
  | 'text'
  | 'markdown'
  | 'card'
  | 'list'
  | 'table'
  | 'form'
  | 'button'
  | 'chart'
  | 'badge'
  | 'divider'
  // ── CRM-specific rich components ──────────────────────────────────────────
  | 'section'        // titled section with optional colour accent + icon
  | 'stat_grid'      // row / grid of metric tiles (ARR, health score, NPS …)
  | 'kv_table'       // compact key-value pairs with optional inline badge
  | 'progress'       // labelled progress / score bar
  | 'contact_chip'   // avatar initials + name + title + company inline card

export interface A2UIComponent {
  type: A2UIComponentType
  id?: string
  props?: Record<string, unknown>
  children?: A2UIComponent[]
  content?: string
}

// ── Props shapes for new CRM components ──────────────────────────────────────

export interface StatItem {
  label: string
  value: string
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray'
  trend?: 'up' | 'down' | 'flat'
  sublabel?: string
}

export interface KVRow {
  key: string
  value: string
  badge?: { text: string; color?: 'green' | 'red' | 'blue' | 'yellow' | 'gray' }
  monospace?: boolean
}

export interface A2UICitation {
  title: string
  url: string
}

export interface A2UIResponse {
  schema_version: string   // "0.8"
  components: A2UIComponent[]
  citations?: A2UICitation[]
  follow_ups?: string[]
  metadata?: Record<string, unknown>
}

/** Checks if an agent artifact content is A2UI-renderable */
export function isA2UIResponse(content: unknown): content is A2UIResponse {
  return (
    typeof content === 'object' &&
    content !== null &&
    'components' in content &&
    Array.isArray((content as A2UIResponse).components)
  )
}
