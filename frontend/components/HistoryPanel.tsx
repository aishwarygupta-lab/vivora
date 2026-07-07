'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock, MessageCircle, Trash2, Play, RefreshCw, Search, Loader2,
  Download, Pencil, Check, X, Sparkles,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import type { ChatMessage, SessionSummary, Avatar } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar as AvatarUI, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface HistoryPanelProps {
  /** Called when the user clicks "Open" — receives the avatar to resume against. */
  onResume: (avatarId: string, sessionId: string) => void
  /** When embedded inside another view (e.g. Studio), drop the page chrome
   *  (max-width wrapper + big title) so it slots in cleanly. */
  embedded?: boolean
}

interface ConversationSummary {
  id: string
  session_id: string
  title: string | null
  summary?: string | null
  message_count: number
  created_at: string
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function HistoryPanel({ onResume, embedded = false }: HistoryPanelProps) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({})
  const [loadingMessagesId, setLoadingMessagesId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ convId: string; sessionId: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: sessions, isLoading, refetch } = useQuery<SessionSummary[]>({
    queryKey: ['sessions'],
    queryFn: api.getSessions,
    refetchOnWindowFocus: false,
  })

  const { data: avatars } = useQuery<Avatar[]>({
    queryKey: ['avatars'],
    queryFn: api.getAvatars,
    refetchOnWindowFocus: false,
  })

  const { data: conversations } = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: api.listConversations,
    refetchOnWindowFocus: false,
  })

  const avatarMap = useMemo(() => {
    const m: Record<string, Avatar> = {}
    for (const a of avatars || []) m[a.id] = a
    return m
  }, [avatars])

  const convoBySession = useMemo(() => {
    const m: Record<string, ConversationSummary> = {}
    for (const c of conversations || []) {
      // If a session has multiple conversations, keep the most recent (first because backend sorts desc)
      if (!m[c.session_id]) m[c.session_id] = c
    }
    return m
  }, [conversations])

  const filtered = useMemo(() => {
    const list = sessions || []
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(s => {
      const av = avatarMap[s.avatar_id]
      const convo = convoBySession[s.id]
      const hay = `${av?.name || ''} ${convo?.title || ''} ${s.id}`.toLowerCase()
      return hay.includes(q)
    })
  }, [sessions, avatarMap, convoBySession, query])

  const toggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(sessionId)
    if (!messagesById[sessionId]) {
      setLoadingMessagesId(sessionId)
      try {
        const msgs = await api.getMessages(sessionId)
        setMessagesById(prev => ({ ...prev, [sessionId]: msgs }))
      } catch {
        toast.error('Could not load messages')
      } finally {
        setLoadingMessagesId(null)
      }
    }
  }

  const handleDelete = async (sessionId: string) => {
    setBusy(sessionId)
    try {
      await api.deleteSession(sessionId)
      toast.success('Conversation deleted')
      setMessagesById(prev => {
        const next = { ...prev }
        delete next[sessionId]
        return next
      })
      if (expandedId === sessionId) setExpandedId(null)
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error('Could not delete conversation')
    } finally {
      setBusy(null)
      setDeleteTarget(null)
    }
  }

  const handleExport = async (sessionId: string) => {
    setBusy(sessionId)
    try {
      const blob = await api.exportSession(sessionId)
      downloadBlob(blob, `session-${sessionId.slice(0, 8)}.json`)
      toast.success('Exported')
    } catch {
      toast.error('Could not export conversation')
    } finally {
      setBusy(null)
    }
  }

  const handleSummarize = async (convId: string) => {
    setSummarizingId(convId)
    try {
      await api.summarizeConversation(convId)
      toast.success('Summary generated', { icon: '✨' })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error('Could not summarize — backend or LLM unavailable')
    } finally {
      setSummarizingId(null)
    }
  }

  const handleStartRename = (convId: string, sessionId: string, currentTitle: string | null) => {
    setRenameTarget({ convId, sessionId })
    setRenameValue(currentTitle || '')
  }

  const handleSaveRename = async () => {
    if (!renameTarget) return
    const title = renameValue.trim()
    if (!title) {
      toast.error('Title cannot be empty')
      return
    }
    setBusy(renameTarget.sessionId)
    try {
      await api.renameConversation(renameTarget.convId, title)
      toast.success('Renamed')
      setRenameTarget(null)
      setRenameValue('')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error('Could not rename')
    } finally {
      setBusy(null)
    }
  }

  // Periodically refresh
  useEffect(() => {
    const t = setInterval(() => refetch(), 30000)
    return () => clearInterval(t)
  }, [refetch])

  return (
    <div className={embedded ? 'animate-fade-in' : 'max-w-4xl mx-auto px-6 py-10 animate-fade-in'}>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-black gradient-text mb-2">Conversation History</h1>
            <p className="text-muted-foreground">Re-open, review, export, and clean up your past sessions.</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          title="Refresh"
          aria-label="Refresh"
          className={embedded ? 'ml-auto' : ''}
        >
          <RefreshCw size={15} />
        </Button>
      </div>

      <div className="relative mb-6">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by avatar name, conversation title, or session id…"
          className="pl-11"
          aria-label="Search conversations"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="py-0">
              <div className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center border border-border">
            <MessageCircle size={28} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-foreground font-medium">No conversations yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              {query ? 'Nothing matches that search.' : 'Start a chat with an avatar to see it here.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const av = avatarMap[s.avatar_id]
            const convo = convoBySession[s.id]
            const isExpanded = expandedId === s.id
            const msgs = messagesById[s.id]
            const isRenaming = renameTarget?.sessionId === s.id
            const isBusy = busy === s.id
            const title = convo?.title || av?.name || 'Untitled conversation'
            return (
              <Card key={s.id} className="glass-card overflow-hidden py-0">
                <div className="flex items-center gap-4 px-5 py-4">
                  <AvatarUI className="w-12 h-12 rounded-xl flex-shrink-0">
                    {av?.thumbnail_url || av?.image_url ? (
                      <AvatarImage
                        src={av.thumbnail_url || av.image_url}
                        alt={av.name}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-xl bg-surface-700">
                      <MessageCircle size={20} className="text-muted-foreground" />
                    </AvatarFallback>
                  </AvatarUI>
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`rename-${s.id}`} className="sr-only">
                          Conversation title
                        </Label>
                        <Input
                          id={`rename-${s.id}`}
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename()
                            if (e.key === 'Escape') { setRenameTarget(null); setRenameValue('') }
                          }}
                          maxLength={200}
                          className="h-8 py-1.5 text-sm"
                          aria-label="Conversation title"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-green-400 size-8"
                          onClick={handleSaveRename}
                          aria-label="Save title"
                          disabled={isBusy}
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => { setRenameTarget(null); setRenameValue('') }}
                          aria-label="Cancel rename"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">{title}</span>
                        <Badge
                          variant={
                            s.status === 'active' ? 'default' :
                            s.status === 'paused' ? 'secondary' :
                            'outline'
                          }
                          className={cn(
                            'text-xs',
                            s.status === 'active' && 'bg-green-500/15 text-green-500 border-green-500/30',
                            s.status === 'paused' && 'bg-amber-500/15 text-amber-500 border-amber-500/30',
                          )}
                        >
                          {s.status}
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      <span>{timeAgo(s.started_at)}</span>
                      {av && <><span>·</span><span>{av.name}</span></>}
                      {convo && <><span>·</span><span>{convo.message_count} msgs</span></>}
                      <span>·</span>
                      <span className="font-mono">{s.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {convo && !isRenaming && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleStartRename(convo.id, s.id, convo.title)}
                        title="Rename conversation"
                        aria-label="Rename conversation"
                      >
                        <Pencil size={13} />
                      </Button>
                    )}
                    {convo && !isRenaming && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleSummarize(convo.id)}
                        title={convo.summary ? 'Regenerate AI summary' : 'Generate AI summary'}
                        aria-label="Summarize conversation with AI"
                        disabled={summarizingId === convo.id}
                      >
                        {summarizingId === convo.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleExport(s.id)}
                      title="Export as JSON"
                      aria-label="Export conversation"
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => toggleExpand(s.id)}
                      title="Preview messages"
                      aria-label="Toggle message preview"
                      aria-expanded={isExpanded}
                    >
                      {loadingMessagesId === s.id ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                    </Button>
                    {av && (
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={() => onResume(s.avatar_id, s.id)}
                        title="Open in chat"
                      >
                        <Play size={12} />
                        Open
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-red-400"
                      onClick={() => setDeleteTarget(s.id)}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      disabled={isBusy}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                {convo?.summary && !isExpanded && (
                  <>
                    <Separator />
                    <div className="px-5 py-3 bg-primary-500/5 flex items-start gap-2">
                      <Sparkles size={12} className="text-primary-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{convo.summary}</p>
                    </div>
                  </>
                )}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="px-5 py-4 bg-surface-800/40">
                      {convo?.summary && (
                        <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                          <Sparkles size={12} className="text-primary-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground leading-relaxed">{convo.summary}</p>
                        </div>
                      )}
                      {!msgs ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      ) : msgs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No messages in this session.</p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto messages-scroll">
                          {msgs.map((m) => (
                            <div key={m.id} className="flex gap-2 text-sm">
                              <span className={cn(
                                'font-mono text-xs px-1.5 py-0.5 rounded',
                                m.role === 'user' ? 'bg-accent-700/40 text-accent-200' : 'bg-primary-700/40 text-primary-200'
                              )}>
                                {m.role === 'user' ? 'YOU' : 'AI'}
                              </span>
                              <span className="text-foreground flex-1 leading-relaxed whitespace-pre-wrap">{m.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busy !== null && busy === deleteTarget}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget) }}
              disabled={busy !== null && busy === deleteTarget}
            >
              {busy !== null && busy === deleteTarget ? (
                <><Loader2 size={14} className="animate-spin" /> Deleting…</>
              ) : (
                <><Trash2 size={14} /> Delete</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
