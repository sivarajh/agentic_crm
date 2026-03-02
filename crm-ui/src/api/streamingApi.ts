import type { StreamEvent, StreamEventType } from '@/types/agent'

type EventHandler = (event: StreamEvent) => void

/**
 * Opens an SSE connection for a session.
 * Returns a cleanup function that closes the connection.
 */
export function openSessionStream(
  sessionId: string,
  onEvent: EventHandler,
  onError?: (err: Event) => void
): () => void {
  const url = `/api/v1/stream/session/${sessionId}`
  const source = new EventSource(url)

  const SSE_EVENT_TYPES: StreamEventType[] = [
    'agent.thinking',
    'agent.tool_call',
    'agent.message',
    'task.submitted',
    'task.completed',
    'task.failed',
    'session.update',
  ]

  for (const eventType of SSE_EVENT_TYPES) {
    source.addEventListener(eventType, (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data)
        onEvent({ type: eventType, data })
      } catch {
        // non-JSON data — pass as string
        onEvent({ type: eventType, data: { raw: ev.data } })
      }
    })
  }

  if (onError) {
    source.onerror = onError
  }

  return () => source.close()
}
