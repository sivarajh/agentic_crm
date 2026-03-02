import { clsx } from 'clsx'

type Status = 'idle' | 'thinking' | 'working' | 'done' | 'error'

interface Props {
  status: Status
}

const STATUS_CONFIG: Record<Status, { label: string; dotColor: string; animate: boolean }> = {
  idle: { label: '', dotColor: 'bg-gray-300', animate: false },
  thinking: { label: 'Agent is thinking...', dotColor: 'bg-yellow-400', animate: true },
  working: { label: 'Agent is working...', dotColor: 'bg-blue-500', animate: true },
  done: { label: 'Done', dotColor: 'bg-green-500', animate: false },
  error: { label: 'Agent error', dotColor: 'bg-red-500', animate: false },
}

export function AgentStatusIndicator({ status }: Props) {
  const config = STATUS_CONFIG[status]
  if (status === 'idle' || status === 'done') return null

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span
        className={clsx(
          'h-2 w-2 rounded-full',
          config.dotColor,
          config.animate && 'animate-pulse'
        )}
      />
      <span>{config.label}</span>
    </div>
  )
}
