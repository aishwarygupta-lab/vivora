import type { Metadata } from 'next'
import { StudioPageClient } from './StudioPageClient'

export const metadata: Metadata = {
  title: 'Live Avatar Studio',
  description:
    'Start a real-time conversation with your avatar over text or voice — streamed end to end with cloned speech and photorealistic lip-sync.',
}

export default function StudioPage() {
  return <StudioPageClient />
}
