import type { Metadata } from 'next'
import { VoicesPageClient } from './VoicesPageClient'

export const metadata: Metadata = {
  title: 'Voice Cloning Studio',
  description:
    'Clone any voice from a short audio sample in 23 languages, then assign it to an avatar for real-time, lip-synced conversations.',
}

export default function VoicesPage() {
  return <VoicesPageClient />
}
