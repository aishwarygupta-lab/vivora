'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export function ConnectionStatus() {
  const wsStatus = useStore((s) => s.wsStatus)

  if (wsStatus === 'idle') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="status-dot offline" aria-hidden />
        <WifiOff size={14} className="text-muted-foreground" />
        <span className="text-muted-foreground">Idle</span>
      </div>
    )
  }

  const connected = wsStatus === 'connected'
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn('status-dot', connected ? 'online' : 'error')} aria-hidden />
      {connected ? (
        <>
          <Wifi size={14} className="text-accent-400" />
          <span className="text-foreground/80">Connected</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-destructive" />
          <span className="text-destructive">Disconnected</span>
        </>
      )}
    </div>
  )
}
