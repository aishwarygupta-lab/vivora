'use client'

import { Camera, Mic2, Sparkles, Clapperboard } from 'lucide-react'
import { AuthModal } from '@/components/AuthModal'
import { Header, type NavItem } from '@/components/Header'
import { api } from '@/lib/api'
import { useStore } from '@/store/useStore'

const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: Sparkles, label: 'Home' },
  { href: '/avatars', icon: Camera, label: 'Avatars' },
  { href: '/voices', icon: Mic2, label: 'Voices' },
  { href: '/studio', icon: Clapperboard, label: 'Studio' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, clearAuth } = useStore()

  return (
    <div className="min-h-screen">
      {!isAuthenticated() && <AuthModal />}

      <Header
        items={NAV_ITEMS}
        username={user?.username}
        onSignOut={() => { api.logout(); clearAuth() }}
      />

      <main className="pt-16">{children}</main>
    </div>
  )
}
