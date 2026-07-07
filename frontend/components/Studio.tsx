'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ArrowLeft, Clapperboard } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NewSessionDialog } from '@/components/NewSessionDialog'
import { ChatInterface } from '@/components/ChatInterface'
import { HistoryPanel } from '@/components/HistoryPanel'

export function Studio() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [active, setActive] = useState<{
    avatarId: string
    voiceId: string | null
    resumeSessionId: string | null
  } | null>(null)

  const startSession = async (avatarId: string, voiceId: string | null) => {
    // Assigning the voice to the avatar makes the backend auto-load it on connect;
    // we also pass voiceId straight to the socket for an immediate switch.
    if (voiceId) {
      try {
        await api.setAvatarVoice(avatarId, voiceId)
      } catch {
        toast.error('Could not assign that voice — using the default instead')
        voiceId = null
      }
    }
    setActive({ avatarId, voiceId, resumeSessionId: null })
    setDialogOpen(false)
  }

  const resume = (avatarId: string, sessionId: string) => {
    setActive({ avatarId, voiceId: null, resumeSessionId: sessionId })
  }

  // ── Active conversation ──────────────────────────────────────────────────
  if (active) {
    return (
      <div className="mx-auto max-w-7xl animate-fade-in px-6 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActive(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Studio
          </Button>
          <Button size="sm" onClick={() => { setActive(null); setDialogOpen(true) }} className="gap-1.5">
            <Plus className="h-4 w-4" /> New session
          </Button>
        </div>
        <ChatInterface
          key={`${active.avatarId}:${active.resumeSessionId ?? 'new'}`}
          avatarId={active.avatarId}
          voiceId={active.voiceId ?? undefined}
          resumeSessionId={active.resumeSessionId ?? undefined}
        />
        <NewSessionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onStart={startSession}
          onManageAvatars={() => router.push('/avatars')}
          onManageVoices={() => router.push('/voices')}
        />
      </div>
    )
  }

  // ── Studio home (start + history) ─────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-black gradient-text">
            <Clapperboard className="h-7 w-7 text-primary" /> Studio
          </h1>
          <p className="text-muted-foreground">
            Start a conversation with an avatar in text or voice, and pick up past sessions.
          </p>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-5 w-5" /> New session
        </Button>
      </div>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => setDialogOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDialogOpen(true) } }}
        className="mb-8 cursor-pointer border-dashed border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10"
      >
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Plus className="h-6 w-6" />
          </span>
          <p className="font-semibold text-foreground">Start a new session</p>
          <p className="text-sm text-muted-foreground">Choose an avatar and a voice, then talk by text or voice.</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recent sessions</h2>
        <HistoryPanel onResume={resume} embedded />
      </div>

      <NewSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStart={startSession}
        onManageAvatars={() => router.push('/avatars')}
        onManageVoices={() => router.push('/voices')}
      />
    </div>
  )
}
