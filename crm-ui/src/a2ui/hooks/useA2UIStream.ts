import { useEffect, useRef, useCallback } from 'react'
import { openSessionStream } from '@/api/streamingApi'
import { useAgentStore } from '@/store'
import type { StreamEvent } from '@/types/agent'

/**
 * Hook that opens and manages an SSE stream for a session.
 * Automatically updates the agent store with incoming events.
 */
export function useA2UIStream(sessionId: string | null) {
  const closeRef = useRef<(() => void) | null>(null)
  const { setAgentStatus, setLastStreamEvent, appendStreamingContent, clearStreamingContent } =
    useAgentStore()

  const handleEvent = useCallback(
    (event: StreamEvent) => {
      setLastStreamEvent(event)
      switch (event.type) {
        case 'agent.thinking':
          setAgentStatus('thinking')
          break
        case 'agent.tool_call':
          setAgentStatus('working')
          break
        case 'agent.message': {
          const content = event.data?.content as string | undefined
          if (content) appendStreamingContent(content)
          break
        }
        case 'task.submitted':
          setAgentStatus('working')
          break
        case 'task.completed':
          setAgentStatus('done')
          break
        case 'task.failed':
          setAgentStatus('error')
          break
        default:
          break
      }
    },
    [setAgentStatus, setLastStreamEvent, appendStreamingContent]
  )

  useEffect(() => {
    if (!sessionId) return

    clearStreamingContent()
    setAgentStatus('idle')

    closeRef.current = openSessionStream(sessionId, handleEvent, () => {
      setAgentStatus('error')
    })

    return () => {
      closeRef.current?.()
      closeRef.current = null
    }
  }, [sessionId, handleEvent, clearStreamingContent, setAgentStatus])
}
