import type { Metadata } from 'next'
import { SettingsPageClient } from './SettingsPageClient'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account, preferences, and connection settings.',
  robots: { index: false, follow: false },
}

export default function SettingsPage() {
  return <SettingsPageClient />
}
