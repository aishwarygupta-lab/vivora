'use client'

import dynamic from 'next/dynamic'
import { PanelLoader } from '@/components/PanelLoader'

// Opens a WebSocket and touches the microphone/camera on mount, so it can't render on the server.
const Studio = dynamic(
  () => import('@/components/Studio').then((m) => m.Studio),
  { ssr: false, loading: () => <PanelLoader label="Loading studio…" /> },
)

export function StudioPageClient() {
  return <Studio />
}
