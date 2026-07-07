'use client'

import dynamic from 'next/dynamic'
import { PanelLoader } from '@/components/PanelLoader'

// Touches microphone/localStorage on mount, so it can't render on the server.
const VoicePanel = dynamic(
  () => import('@/components/VoicePanel').then((m) => m.VoicePanel),
  { ssr: false, loading: () => <PanelLoader label="Loading voices…" /> },
)

export function VoicesPageClient() {
  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-10">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-black gradient-text">Voices</h1>
        <p className="text-muted-foreground">Clone and manage your voice library. Assign a voice when you start a session in the Studio.</p>
      </div>
      <VoicePanel />
    </div>
  )
}
