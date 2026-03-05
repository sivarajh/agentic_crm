import { Text, FlexLayout, LinearProgress } from '@salt-ds/core'

type Status = 'idle' | 'thinking' | 'working' | 'done' | 'error'

interface Props { status: Status }

const STATUS_CONFIG: Record<Status, { label: string; sentiment: 'info' | 'warning' | 'positive' | 'negative' | null }> = {
  idle:     { label: '',                   sentiment: null      },
  thinking: { label: 'Agent is thinking…', sentiment: 'info'    },
  working:  { label: 'Agent is working…',  sentiment: 'warning' },
  done:     { label: 'Done',               sentiment: 'positive' },
  error:    { label: 'Agent error',        sentiment: 'negative' },
}

export function AgentStatusIndicator({ status }: Props) {
  const config = STATUS_CONFIG[status]
  if (status === 'idle' || status === 'done') return null

  return (
    <FlexLayout direction="column" gap={0} style={{ width: '100%' }}>
      {(status === 'thinking' || status === 'working') && (
        <div style={{ overflow: 'hidden', height: 4 }}>
          <LinearProgress aria-label={config.label} />
        </div>
      )}
      {config.label && (
        <Text styleAs="label" style={{ color: 'var(--cgpt-text-secondary)', marginTop: 2 }}>
          {config.label}
        </Text>
      )}
    </FlexLayout>
  )
}
