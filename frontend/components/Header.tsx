'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LogOut, Settings, Menu, ChevronDown } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ConnectionStatus } from '@/components/ui/ConnectionStatus'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  disabled?: boolean
}

interface HeaderProps {
  items: NavItem[]
  username?: string
  onSignOut?: () => void
}

export function Header({ items, username, onSignOut }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const initials = (username || 'U').slice(0, 2).toUpperCase()
  const settingsActive = pathname === '/settings'

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: logo */}
        <Link
          href={items[0]!.href}
          className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Vivora home"
        >
          <Logo />
        </Link>

        {/* Center: classic underline nav (desktop) */}
        <nav className="hidden items-center gap-1 md:flex">
          {items.map(({ href, icon: Icon, label, disabled }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={disabled ? '#' : href}
                aria-disabled={disabled}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                  disabled ? 'pointer-events-none opacity-40 cursor-not-allowed' : '',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right: status, theme, account (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:block"><ConnectionStatus /></div>
          <ThemeToggle />

          {username && (
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[8rem] truncate text-sm">{username}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="truncate">{username}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" /> Settings / Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={onSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left"><Logo /></SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1 px-2">
                {items.map(({ href, icon: Icon, label, disabled }) => (
                  <Button
                    key={href}
                    variant={pathname === href ? 'secondary' : 'ghost'}
                    disabled={disabled}
                    className="justify-start gap-2"
                    asChild={!disabled}
                    onClick={() => setMobileOpen(false)}
                  >
                    {disabled ? (
                      <>
                        <Icon className="h-4 w-4" /> {label}
                      </>
                    ) : (
                      <Link href={href}>
                        <Icon className="h-4 w-4" /> {label}
                      </Link>
                    )}
                  </Button>
                ))}
                <div className="my-2 h-px bg-border" />
                <Button variant={settingsActive ? 'secondary' : 'ghost'} className="justify-start gap-2" asChild
                  onClick={() => setMobileOpen(false)}>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" /> Settings / Profile
                  </Link>
                </Button>
                {username && (
                  <Button variant="ghost" className="justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={() => { onSignOut?.(); setMobileOpen(false) }}>
                    <LogOut className="h-4 w-4" /> Log out
                  </Button>
                )}
                {username && (
                  <p className="mt-3 px-3 text-xs text-muted-foreground">Signed in as {username}</p>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
