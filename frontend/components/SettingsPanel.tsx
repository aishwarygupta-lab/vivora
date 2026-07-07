'use client'

import { useState } from 'react'
import { Save, Loader2, User, KeyRound, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import { useStore } from '@/store/useStore'
import type { ApiError } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Shared demo account (backend/seed_user.py) — editing it would lock other
// people out of the demo, so profile/password edits are blocked for it.
const DEMO_EMAIL = 'demo@vivora.app'

export function SettingsPanel() {
  const { user, setAuth, token, clearAuth } = useStore()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const isDemoAccount = user?.email === DEMO_EMAIL

  const saveProfile = async () => {
    if (isDemoAccount) {
      toast.error('Register a real account to edit your profile')
      return
    }
    setSavingProfile(true)
    try {
      const update: Record<string, string> = {}
      if (fullName !== (user?.full_name || '')) update.full_name = fullName
      if (username && username !== user?.username) update.username = username
      if (email && email !== user?.email) update.email = email
      if (Object.keys(update).length === 0) {
        toast('Nothing to update', { icon: 'ℹ️' })
        return
      }
      const updated = await api.updateProfile(update)
      if (token) setAuth(token, updated)
      toast.success('Profile updated')
    } catch (err: unknown) {
      toast.error((err as ApiError)?.response?.data?.detail || 'Could not save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    if (isDemoAccount) {
      toast.error('Register a real account to change your password')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await api.updateProfile({ password: newPassword })
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated')
    } catch (err: unknown) {
      toast.error((err as ApiError)?.response?.data?.detail || 'Could not change password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      {isDemoAccount && (
        <Card className="card-glow mb-6 flex flex-row items-start gap-3">
          <User size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-foreground font-semibold">You&apos;re signed in with the shared demo account.</p>
            <p className="text-xs text-muted-foreground mt-1">Register your own account to edit your profile and keep your data private.</p>
          </div>
        </Card>
      )}

      {/* Profile card */}
      <Card className="card flex flex-col gap-5">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <User size={16} className="text-primary-400" />
            Profile
          </CardTitle>
          <CardDescription>Update your account details.</CardDescription>
        </CardHeader>
        <div className="divider" />
        <CardContent className="p-0 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="Your name"
                disabled={isDemoAccount}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="username"
                disabled={isDemoAccount}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                disabled={isDemoAccount}
              />
            </div>
          </div>
          <Button
            onClick={saveProfile}
            disabled={savingProfile || isDemoAccount}
            className="btn-primary w-full md:w-auto md:self-end"
          >
            {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* Password card */}
      <Card className="card flex flex-col gap-5 mt-6">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <KeyRound size={16} className="text-primary-400" />
            Password
          </CardTitle>
          <CardDescription>Choose a strong password to secure your account.</CardDescription>
        </CardHeader>
        <div className="divider" />
        <CardContent className="p-0 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder="At least 8 characters"
                disabled={isDemoAccount}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Repeat your password"
                disabled={isDemoAccount}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button
            onClick={changePassword}
            disabled={savingPassword || isDemoAccount || !newPassword || !confirmPassword}
            className="btn-primary w-full md:w-auto md:self-end"
          >
            {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Update password
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="card flex flex-col gap-5 mt-6 border border-red-500/20">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Trash2 size={16} className="text-red-400" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Sign out of this device. Your avatars, voices, and conversations remain on the server.
          </CardDescription>
        </CardHeader>
        <div className="divider" />
        <CardContent className="p-0 flex flex-col gap-5">
          <Button
            variant="secondary"
            onClick={() => {
              api.logout()
              clearAuth()
              toast('Signed out', { icon: '👋' })
            }}
            className="btn-secondary w-full md:w-auto md:self-end"
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
