'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Check, User, Loader2, RefreshCw, Play, Settings2, Save, X, Mic2, MicOff } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import Image from 'next/image'
import type { Avatar } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface AvatarListProps {
  selectedAvatar: string | null
  onSelectAvatar: (avatarId: string) => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ready:      { label: 'Ready',      color: 'text-green-400',  dot: 'bg-green-400' },
  processing: { label: 'Processing', color: 'text-amber-400',  dot: 'bg-amber-400 animate-pulse' },
  failed:     { label: 'Failed',     color: 'text-red-400',    dot: 'bg-red-400' },
  pending:    { label: 'Pending',    color: 'text-gray-400',   dot: 'bg-gray-500' },
}

function AvatarCardSkeleton() {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <Skeleton className="aspect-square rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 rounded w-3/4" />
        <Skeleton className="h-3 rounded w-1/2" />
      </div>
    </div>
  )
}

export function AvatarList({ selectedAvatar, onSelectAvatar }: AvatarListProps) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPrompt, setDraftPrompt] = useState('')
  const [draftName, setDraftName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingVoiceUnset, setPendingVoiceUnset] = useState<string | null>(null)

  const { data: avatars, isLoading, refetch } = useQuery({
    queryKey: ['avatars'],
    queryFn: api.getAvatars,
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: (avatarId: string) => api.deleteAvatar(avatarId),
    onSuccess: () => {
      toast.success('Avatar deleted')
      queryClient.invalidateQueries({ queryKey: ['avatars'] })
    },
    onError: () => toast.error('Failed to delete avatar'),
  })

  const unsetVoiceMutation = useMutation({
    mutationFn: (avatarId: string) => api.unsetAvatarVoice(avatarId),
    onSuccess: () => {
      toast.success('Voice unassigned')
      queryClient.invalidateQueries({ queryKey: ['avatars'] })
    },
    onError: () => toast.error('Failed to unassign voice'),
  })

  const openEditor = (avatar: Avatar) => {
    setDraftPrompt(avatar.avatar_metadata?.system_prompt ?? '')
    setDraftName(avatar.name ?? '')
    setEditingId(avatar.id)
  }

  const savePrompt = async (avatarId: string) => {
    setIsSaving(true)
    try {
      const av = avatars?.find((a: Avatar) => a.id === avatarId)
      const saves: Promise<void>[] = [
        api.setAvatarMetadata(avatarId, { system_prompt: draftPrompt.trim() }),
      ]
      if (draftName.trim() && draftName.trim() !== av?.name) {
        saves.push(api.renameAvatar(avatarId, draftName.trim()))
      }
      await Promise.all(saves)
      queryClient.invalidateQueries({ queryKey: ['avatars'] })
      toast.success('Saved', { icon: '✅' })
      setEditingId(null)
    } catch {
      toast.error('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {/* Header */}
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="text-xl font-bold">Your Avatars</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {avatars?.length ?? 0} avatar{(avatars?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
          <RefreshCw size={15} />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Separator />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <AvatarCardSkeleton key={i} />)}
          </div>
        ) : !avatars || avatars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-700/80 flex items-center justify-center border border-border">
              <User size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium">No avatars yet</p>
              <p className="text-muted-foreground text-sm mt-1">Upload your first avatar to get started</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[28rem]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {avatars.map((avatar: Avatar, idx: number) => {
                  const isSelected = selectedAvatar === avatar.id
                  const status = STATUS_CONFIG[avatar.status] ?? STATUS_CONFIG.pending

                  return (
                    <Card
                      key={avatar.id}
                      onClick={() => onSelectAvatar(avatar.id)}
                      className={cn(
                        'relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group p-0 gap-0',
                        isSelected
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-900 shadow-glow-sm scale-[1.02]'
                          : 'hover:scale-[1.02] hover:shadow-glow-sm hover:ring-1 hover:ring-primary/40'
                      )}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      {/* Image */}
                      <div className="aspect-square relative bg-surface-700 overflow-hidden">
                        {(avatar.thumbnail_url || avatar.image_url) ? (
                          <Image
                            src={(avatar.thumbnail_url || avatar.image_url) as string}
                            alt={avatar.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User size={40} className="text-muted-foreground" />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-linear-to-t from-surface-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-glow-sm animate-scale-in">
                            <Check size={14} className="text-primary-foreground" />
                          </div>
                        )}

                        {!isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="w-10 h-10 rounded-full bg-primary-600/80 backdrop-blur-sm flex items-center justify-center">
                              <Play size={16} className="text-white ml-0.5" />
                            </div>
                          </div>
                        )}

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPendingDelete(avatar.id)
                          }}
                          className="absolute top-2 left-2 size-6 rounded-full bg-red-600/80 backdrop-blur-sm text-white
                                     opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500 hover:text-white"
                          title="Delete avatar"
                        >
                          {deleteMutation.isPending && pendingDelete === avatar.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Trash2 size={11} />
                          )}
                        </Button>

                        {/* Settings button — only for ready avatars */}
                        {avatar.status === 'ready' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              editingId === avatar.id ? setEditingId(null) : openEditor(avatar)
                            }}
                            className={cn(
                              'absolute bottom-2 right-2 size-6 rounded-full backdrop-blur-sm text-white transition-all duration-200',
                              editingId === avatar.id
                                ? 'bg-primary-600 opacity-100'
                                : 'bg-surface-800/80 opacity-0 group-hover:opacity-100 hover:bg-primary-600/60 hover:text-white'
                            )}
                            title="Edit personality"
                          >
                            <Settings2 size={11} />
                          </Button>
                        )}
                      </div>

                      {/* Info */}
                      <div className="bg-surface-800/90 px-3 py-2.5 border-t border-border">
                        <p className="font-semibold text-sm text-foreground truncate">{avatar.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                          <span className={cn('text-xs', status.color)}>{status.label}</span>
                          <div className="ml-auto flex items-center gap-1.5">
                            {avatar.avatar_metadata?.system_prompt && (
                              <span title="Custom personality" aria-label="Has custom personality" className="text-[10px] text-primary-400">🧠</span>
                            )}
                            {avatar.voice_id ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPendingVoiceUnset(avatar.id)
                                }}
                                className="text-[10px] text-primary-300 hover:text-red-400 transition-colors flex items-center gap-0.5"
                                title="Voice attached — click to unassign"
                                aria-label="Unassign voice from this avatar"
                              >
                                <Mic2 size={9} />
                              </button>
                            ) : (
                              <span title="No custom voice" aria-label="No custom voice" className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <MicOff size={9} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* ── Inline Personality Editor ── */}
              {editingId && (() => {
                const av = avatars.find((a: Avatar) => a.id === editingId)
                if (!av) return null
                return (
                  <div className="glass-card rounded-xl p-4 border border-primary/30 animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Settings2 size={14} className="text-primary-400" />
                        <span className="text-sm font-semibold text-foreground">
                          Personality — <span className="text-primary-400">{av.name}</span>
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                        <X size={13} />
                      </Button>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <Label htmlFor="draft-name" className="text-xs text-muted-foreground">Display name</Label>
                      <Input
                        id="draft-name"
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Avatar name"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      System prompt sent to the LLM at the start of every conversation with this avatar.
                    </p>

                    <Textarea
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder="You are a friendly assistant named Alex. Respond conversationally and keep answers concise…"
                      rows={4}
                      className="resize-none"
                    />

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">{draftPrompt.length} chars</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => savePrompt(editingId)}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </ScrollArea>
        )}

        {selectedAvatar && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500/10 border border-primary-500/20 animate-slide-up">
            <Check size={14} className="text-primary-400 flex-shrink-0" />
            <p className="text-sm text-primary-300">Avatar selected — go to Chat to start talking!</p>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this avatar?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The avatar will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice unassign confirmation */}
      <Dialog open={pendingVoiceUnset !== null} onOpenChange={(open) => { if (!open) setPendingVoiceUnset(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign the cloned voice?</DialogTitle>
            <DialogDescription>
              The cloned voice will be removed from this avatar. You can reassign one later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingVoiceUnset(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingVoiceUnset) unsetVoiceMutation.mutate(pendingVoiceUnset)
                setPendingVoiceUnset(null)
              }}
            >
              Unassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
