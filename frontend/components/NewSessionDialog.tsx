'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, Mic2, Check, Loader2, Play, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import type { Avatar as AvatarType, VoiceApiResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NewSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fired with the chosen avatar and (optional) voice once the user hits Start. */
  onStart: (avatarId: string, voiceId: string | null) => void | Promise<void>
  onManageAvatars?: () => void
  onManageVoices?: () => void
}

export function NewSessionDialog({
  open, onOpenChange, onStart, onManageAvatars, onManageVoices,
}: NewSessionDialogProps) {
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const { data: avatars = [], isLoading: avatarsLoading } = useQuery<AvatarType[]>({
    queryKey: ['avatars'], queryFn: api.getAvatars, enabled: open,
  })
  const { data: voices = [], isLoading: voicesLoading } = useQuery<VoiceApiResponse[]>({
    queryKey: ['voices'], queryFn: api.listVoices, enabled: open,
  })

  const start = async () => {
    if (!avatarId) return
    setStarting(true)
    try {
      await onStart(avatarId, voiceId)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start a new session</DialogTitle>
          <DialogDescription>Pick an avatar to talk to, and optionally a voice.</DialogDescription>
        </DialogHeader>

        {/* Avatar picker */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Camera className="h-4 w-4 text-primary" /> Avatar <span className="text-destructive">*</span>
            </h3>
            {onManageAvatars && (
              <Button variant="ghost" size="sm" onClick={onManageAvatars} className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> New avatar
              </Button>
            )}
          </div>

          {avatarsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading avatars…</p>
          ) : avatars.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              No avatars yet — create one in the Avatars tab first.
            </p>
          ) : (
            <ScrollArea className="max-h-44">
              <div className="grid grid-cols-3 gap-3 pr-3 sm:grid-cols-4">
                {avatars.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvatarId(a.id)}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all',
                      avatarId === a.id
                        ? 'border-primary ring-2 ring-primary/50 bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-accent',
                    )}
                  >
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={a.thumbnail_url || a.image_url} alt={a.name} />
                      <AvatarFallback className="bg-primary/15 text-primary">
                        {a.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="line-clamp-1 text-center text-xs text-foreground">{a.name}</span>
                    {a.avatar_metadata?.media_type === 'video' && (
                      <Badge variant="secondary" className="absolute right-1 top-1 px-1 py-0 text-[9px]">video</Badge>
                    )}
                    {avatarId === a.id && (
                      <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        {/* Voice picker */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Mic2 className="h-4 w-4 text-primary" /> Voice <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </h3>
            {onManageVoices && (
              <Button variant="ghost" size="sm" onClick={onManageVoices} className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Clone voice
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <VoiceChip label="Default voice" active={voiceId === null} onClick={() => setVoiceId(null)} />
            {voicesLoading && <span className="text-sm text-muted-foreground">Loading voices…</span>}
            {voices.map((v) => (
              <VoiceChip
                key={v.id}
                label={`${v.name} · ${v.language.toUpperCase()}`}
                active={voiceId === v.id}
                onClick={() => setVoiceId(v.id)}
              />
            ))}
          </div>
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={start} disabled={!avatarId || starting} className="gap-1.5">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VoiceChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
