'use client'

import { useState } from 'react'
import { Loader2, Eye, EyeOff, UserPlus, LogIn, KeyRound } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import { useStore } from '@/store/useStore'
import type { ApiError } from '@/lib/types'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// Demo account seeded by the backend (backend/seed_user.py). Shown here so a
// fresh install can sign in with one click — it is a demo, not a secret.
const DEMO_EMAIL = 'demo@vivora.app'
const DEMO_PASSWORD = 'VivoraDemo123!'

export function AuthModal() {
  const { setAuth } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regFullName, setRegFullName] = useState('')

  const doLogin = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await api.login(email, password)
      const profile = await api.getProfile()
      setAuth(data.access_token, profile)
      toast.success(`Welcome back, ${profile.username}!`, { icon: '👋' })
    } catch (err: unknown) {
      toast.error((err as ApiError)?.response?.data?.detail || 'Invalid credentials')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginEmail && loginPassword) doLogin(loginEmail, loginPassword)
  }

  const handleDemoLogin = () => {
    setLoginEmail(DEMO_EMAIL)
    setLoginPassword(DEMO_PASSWORD)
    doLogin(DEMO_EMAIL, DEMO_PASSWORD)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regEmail || !regUsername || !regPassword) return
    setIsLoading(true)
    try {
      await api.register({ email: regEmail, username: regUsername, password: regPassword, full_name: regFullName })
      const data = await api.login(regEmail, regPassword)
      const profile = await api.getProfile()
      setAuth(data.access_token, profile)
      toast.success(`Account created! Welcome, ${profile.username}!`, { icon: '🎉' })
    } catch (err: unknown) {
      toast.error((err as ApiError)?.response?.data?.detail || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader className="items-center gap-3">
          <Logo showWordmark={false} markClassName="h-11 w-11" />
          <DialogTitle className="text-2xl font-extrabold gradient-text">Vivora</DialogTitle>
          <DialogDescription>Sign in to bring your avatars to life.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login"><LogIn className="mr-1.5 h-4 w-4" /> Sign In</TabsTrigger>
            <TabsTrigger value="register"><UserPlus className="mr-1.5 h-4 w-4" /> Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? 'text' : 'password'}
                    value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" required className="pr-10" />
                  <Button type="button" variant="ghost" size="icon"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Sign In
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input id="reg-username" value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)} placeholder="cooluser" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-fullname">Full Name</Label>
                  <Input id="reg-fullname" value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" type="email" value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Password</Label>
                <Input id="reg-password" type={showPassword ? 'text' : 'password'} value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)} placeholder="Min 8 characters"
                  minLength={8} required />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleDemoLogin}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Continue with Demo Login
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Uses the shared demo account (<span className="font-mono">{DEMO_EMAIL}</span>) — data is visible to other testers.
        </p>
      </DialogContent>
    </Dialog>
  )
}
