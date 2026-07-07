import type { Metadata } from 'next'
import { AvatarsPageClient } from './AvatarsPageClient'

export const metadata: Metadata = {
  title: 'Avatars',
  description:
    'Upload a photo or record a short clip to create a talking avatar, then manage your avatar library before starting a session in the Studio.',
}

export default function AvatarsPage() {
  return <AvatarsPageClient />
}
