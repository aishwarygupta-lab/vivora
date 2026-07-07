'use client'

import dynamic from 'next/dynamic'
import { PanelLoader } from '@/components/PanelLoader'

// Reads/writes localStorage and user preferences on mount, so it can't render on the server.
const SettingsPanel = dynamic(
  () => import('@/components/SettingsPanel').then((m) => m.SettingsPanel),
  { ssr: false, loading: () => <PanelLoader label="Loading settings…" /> },
)

export function SettingsPageClient() {
  return <SettingsPanel />
}
