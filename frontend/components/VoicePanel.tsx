'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Mic, MicOff, Play, Pause, Trash2, Upload, Check, Loader2,
  Volume2, Wand2, Music, AlertCircle, PlusCircle, RefreshCw,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import type { VoiceApiResponse, ApiError } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface VoiceProfile {
  id: string
  name: string
  language: string
  duration: number
  createdAt: Date
  isDefault: boolean
}

const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'pt', label: '🇧🇷 Portuguese' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'it', label: '🇮🇹 Italian' },
  { code: 'ko', label: '🇰🇷 Korean' },
]

const PRESET_VOICES: VoiceProfile[] = [
  { id: 'default-en', name: 'Alex (English)', language: 'en', duration: 0, createdAt: new Date(), isDefault: true },
  { id: 'default-warm', name: 'Jordan (Warm)', language: 'en', duration: 0, createdAt: new Date(), isDefault: true },
  { id: 'default-deep', name: 'Morgan (Deep)', language: 'en', duration: 0, createdAt: new Date(), isDefault: true },
  { id: 'default-es', name: 'Sofia (Spanish)', language: 'es', duration: 0, createdAt: new Date(), isDefault: true },
]

const LANG_FLAGS: Record<string, string> = {
  en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', zh: '🇨🇳', ja: '🇯🇵', pt: '🇧🇷', hi: '🇮🇳',
}

function WaveformBar({ active, height }: { active: boolean; height: number }) {
  return (
    <div
      className="w-1 rounded-full transition-all duration-100"
      style={{
        height: active ? `${height}px` : '4px',
        background: 'linear-gradient(to top, var(--color-primary-600), var(--color-accent-400))',
        minHeight: '4px',
        maxHeight: '40px',
      }}
    />
  )
}

interface VoicePanelProps {
  onVoiceSelect?: (voiceId: string) => void
}

export function VoicePanel({ onVoiceSelect }: VoicePanelProps = {}) {
  const [voices, setVoices] = useState<VoiceProfile[]>(PRESET_VOICES)
  const [selectedVoice, setSelectedVoice] = useState<string>(PRESET_VOICES[0].id)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [newVoiceName, setNewVoiceName] = useState('')
  const [newVoiceLang, setNewVoiceLang] = useState('en')
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(20).fill(4))
  const [step, setStep] = useState<'select' | 'record' | 'name'>('select')
  const [recordMode, setRecordMode] = useState<'mic' | 'file'>('mic')

  // Voice library preview state — playback of an existing custom voice's WAV
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const MAX_RECORDING_SECS = 30

  // Load persisted custom voices from backend on mount
  useEffect(() => {
    api.listVoices()
      .then((data: VoiceApiResponse[]) => {
        if (!Array.isArray(data) || data.length === 0) return
        const custom: VoiceProfile[] = data.map((v) => ({
          id: v.id,
          name: v.name,
          language: v.language || 'en',
          duration: v.duration || 0,
          createdAt: v.created_at ? new Date(v.created_at) : new Date(),
          isDefault: false,
        }))
        setVoices([...PRESET_VOICES, ...custom])
      })
      .catch(() => { /* backend may not be up yet — keep presets */ })
  }, [])

  // Clean up any in-flight preview when the panel unmounts.
  useEffect(() => () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewingId(null)
  }, [])

  const playPreview = useCallback(async (voiceId: string) => {
    // Preset voices have no recorded sample — bail with a helpful toast
    if (voiceId.startsWith('default-')) {
      toast('Preset voices are previewed in chat', { icon: '🎧' })
      return
    }
    if (previewingId === voiceId) {
      stopPreview()
      return
    }
    stopPreview()
    try {
      const blob = await api.fetchVoicePreviewBlob(voiceId)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = stopPreview
      audio.onerror = () => {
        toast.error('Could not play preview')
        stopPreview()
      }
      previewUrlRef.current = url
      previewAudioRef.current = audio
      setPreviewingId(voiceId)
      await audio.play()
    } catch {
      toast.error('Could not load preview')
      stopPreview()
    }
  }, [previewingId, stopPreview])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser

      const animateWave = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const bars = Array.from({ length: 20 }, (_, i) => {
          const val = data[Math.floor((i / 20) * data.length)] || 0
          return Math.max(4, Math.min(40, val * 0.4))
        })
        setWaveHeights(bars)
        animFrameRef.current = requestAnimationFrame(animateWave)
      }
      animateWave()

      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
        setWaveHeights(Array(20).fill(4))
        stream.getTracks().forEach(t => t.stop())
        audioCtx.close()
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setStep('name')
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t + 1 >= MAX_RECORDING_SECS) {
            stopRecording()
            return t
          }
          return t + 1
        })
      }, 1000)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file (MP3, WAV, M4A, OGG…)')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20 MB')
      return
    }
    setAudioBlob(file)
    setAudioUrl(URL.createObjectURL(file))
    setRecordingTime(0)
    setStep('name')
  }

  const togglePlay = () => {
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setIsPlaying(false)
    }
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const cloneVoice = async () => {
    if (!audioBlob || !newVoiceName.trim()) {
      toast.error('Please record audio and give the voice a name')
      return
    }
    setIsCloning(true)
    try {
      const data = await api.cloneVoice(audioBlob, newVoiceName.trim(), newVoiceLang)

      const newProfile: VoiceProfile = {
        id: data.id,
        name: data.name,
        language: data.language || newVoiceLang,
        duration: data.duration || recordingTime,
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
        isDefault: false,
      }
      setVoices(v => [...v, newProfile])
      setSelectedVoice(newProfile.id)
      onVoiceSelect?.(newProfile.id)
      toast.success(`Voice "${newProfile.name}" cloned!`, { icon: '🎙️' })
      // Reset
      setAudioBlob(null)
      setAudioUrl(null)
      setNewVoiceName('')
      setNewVoiceLang('en')
      setStep('select')
    } catch (err: unknown) {
      const detail = (err as ApiError)?.response?.data?.detail || (err as ApiError)?.message
      toast.error(detail || 'Voice cloning failed — check backend is running')
    } finally {
      setIsCloning(false)
    }
  }

  const deleteVoice = async (id: string) => {
    if (previewingId === id) stopPreview()
    try {
      await api.deleteVoice(id)
    } catch { /* ignore network errors — local state still updates */ }
    setVoices(v => v.filter(x => x.id !== id))
    if (selectedVoice === id) {
      setSelectedVoice(PRESET_VOICES[0].id)
      onVoiceSelect?.(PRESET_VOICES[0].id)
    }
    toast.success('Voice removed')
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Voice Library ── */}
      <Card className="card flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Voice Library</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{voices.length} voices available</p>
          </div>
          <Button
            onClick={() => setStep('record')}
            className="btn-primary px-4 py-2 text-sm"
          >
            <PlusCircle size={15} />
            Clone Voice
          </Button>
        </div>

        <div className="divider" />

        <div className="space-y-2 overflow-y-auto max-h-96 messages-scroll">
          {voices.map((voice) => {
            const isSelected = selectedVoice === voice.id
            const isPreviewing = previewingId === voice.id
            return (
              <div
                key={voice.id}
                onClick={() => { setSelectedVoice(voice.id); onVoiceSelect?.(voice.id) }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group',
                  isSelected
                    ? 'bg-primary-500/15 border border-primary-500/40 shadow-glow-sm'
                    : 'bg-accent border border-border hover:bg-surface-700/70 hover:border-primary-500/20'
                )}
              >
                {/* Voice icon */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0',
                  voice.isDefault ? 'bg-surface-600' : 'bg-linear-to-br from-primary-700/60 to-accent-700/40'
                )}
                >
                  {LANG_FLAGS[voice.language] || '🎙️'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{voice.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {voice.isDefault ? (
                      <Badge className="badge-blue text-xs">Preset</Badge>
                    ) : (
                      <>
                        <Badge className="badge-purple text-xs">Custom · {fmtTime(voice.duration)}</Badge>
                        {voice.createdAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(voice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Preview button — custom voices only */}
                {!voice.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); playPreview(voice.id) }}
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200',
                      isPreviewing
                        ? 'bg-primary-600 text-foreground'
                        : 'bg-surface-700/0 hover:bg-primary-600/30 text-muted-foreground hover:text-primary-300 opacity-0 group-hover:opacity-100'
                    )}
                    title={isPreviewing ? 'Stop preview' : 'Preview voice sample'}
                    aria-label={isPreviewing ? 'Stop preview' : 'Preview voice sample'}
                  >
                    {isPreviewing ? <Pause size={12} /> : <Play size={12} />}
                  </Button>
                )}

                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                    <Check size={13} className="text-foreground" />
                  </div>
                ) : !voice.isDefault ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); deleteVoice(voice.id) }}
                    className="w-7 h-7 rounded-lg bg-red-600/0 hover:bg-red-600/30 flex items-center justify-center
                               text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100
                               transition-all duration-200 flex-shrink-0"
                    aria-label="Delete voice"
                  >
                    <Trash2 size={13} />
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Right Panel ── */}
      <div className="flex flex-col gap-4">

        {/* Select step — show selected voice info */}
        {step === 'select' && (
          <Card className="card flex flex-col gap-5 animate-fade-in">
            <h2 className="text-xl font-bold text-foreground">Active Voice</h2>
            <div className="divider" />
            {(() => {
              const v = voices.find(x => x.id === selectedVoice)
              if (!v) return null
              return (
                <div className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-primary-700/40 to-accent-700/30 border border-border flex items-center justify-center text-4xl">
                    {LANG_FLAGS[v.language] || '🎙️'}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground">{v.name}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {v.isDefault ? <Badge className="badge-blue">Preset Voice</Badge> : <Badge className="badge-purple">Custom Clone</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {!v.isDefault && (
                      <Button variant="secondary" onClick={() => playPreview(v.id)} className="btn-secondary">
                        {previewingId === v.id ? <><Pause size={16} /> Stop</> : <><Play size={16} /> Preview</>}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setStep('record')} className="btn-secondary">
                      <Wand2 size={16} />
                      Clone a New Voice
                    </Button>
                  </div>
                </div>
              )
            })()}
          </Card>
        )}

        {/* Record step */}
        {step === 'record' && (
          <Card className="card flex flex-col gap-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Voice Sample</h2>
              <Button variant="ghost" onClick={() => setStep('select')} className="btn-ghost text-sm">Cancel</Button>
            </div>
            <div className="divider" />

            {/* Tab switcher: mic vs file */}
            <div className="flex gap-1 p-1 rounded-xl bg-surface-800/80 border border-border">
              {(['mic', 'file'] as const).map(mode => (
                <Button
                  key={mode}
                  variant="ghost"
                  onClick={() => setRecordMode(mode)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    recordMode === mode
                      ? 'bg-linear-to-r from-primary-600/80 to-accent-600/80 text-foreground shadow-glow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mode === 'mic' ? <><Mic size={14} /> Record Mic</> : <><Upload size={14} /> Upload File</>}
                </Button>
              ))}
            </div>

            {/* Instructions */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
              <AlertCircle size={16} className="text-accent-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                {recordMode === 'mic'
                  ? <>Record at least <strong className="text-foreground">10 seconds</strong> of clear speech. Read naturally — avoid background noise.</>
                  : <>Upload an audio file (MP3, WAV, M4A, OGG) with at least <strong className="text-foreground">10 seconds</strong> of clear speech.</>
                }
              </p>
            </div>

            {recordMode === 'mic' ? (
              /* Big record button */
              <div className="flex flex-col items-center gap-6 py-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  className={cn(
                    'relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300',
                    isRecording
                      ? 'bg-destructive shadow-[0_0_40px_color-mix(in_oklab,var(--destructive)_50%,transparent)] scale-110'
                      : 'bg-linear-to-br from-primary-600 to-accent-600 hover:shadow-glow hover:scale-105'
                  )}
                >
                  {isRecording && (
                    <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping" />
                  )}
                  {isRecording ? <MicOff size={36} className="text-foreground" /> : <Mic size={36} className="text-foreground" />}
                </Button>

                <div className="text-center">
                  <p className={cn('text-3xl font-mono font-black', isRecording ? 'text-red-400' : 'text-muted-foreground')}>
                    {fmtTime(recordingTime)}
                    {isRecording && <span className="text-base ml-2 text-muted-foreground">/ {fmtTime(MAX_RECORDING_SECS)}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRecording ? 'Recording — tap to stop' : 'Tap the mic to start'}
                  </p>
                </div>

                {isRecording && (
                  <div className="flex items-center gap-1">
                    {waveHeights.map((h, i) => <WaveformBar key={i} active={isRecording} height={h} />)}
                  </div>
                )}

                {isRecording && (
                  <div className="w-full max-w-xs h-1.5 rounded-full bg-surface-600 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-primary-500 to-accent-500 transition-all duration-1000"
                      style={{ width: `${(recordingTime / MAX_RECORDING_SECS) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* File upload */
              <div className="flex flex-col items-center gap-4 py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-xs flex flex-col items-center gap-3 h-auto py-10 rounded-2xl border-2 border-dashed
                             border-border hover:border-primary-500/50 hover:bg-primary-500/5
                             text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
                >
                  <Upload size={36} className="opacity-60" />
                  <span className="text-sm font-medium">Click to browse audio file</span>
                  <span className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG · max 20 MB</span>
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Name step */}
        {step === 'name' && audioUrl && (
          <Card className="card flex flex-col gap-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Name Your Voice</h2>
              <Button
                variant="ghost"
                onClick={() => { setStep('record'); setAudioBlob(null); setAudioUrl(null) }}
                className="btn-ghost text-sm"
              >
                <RefreshCw size={14} /> Re-record
              </Button>
            </div>
            <div className="divider" />

            {/* Playback */}
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-accent border border-border">
              <Button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause playback' : 'Play sample'}
                className="w-10 h-10 rounded-xl bg-linear-to-br from-primary-600 to-accent-600 flex items-center justify-center flex-shrink-0 hover:shadow-glow transition-all"
              >
                {isPlaying ? <Pause size={18} className="text-foreground" /> : <Play size={18} className="text-foreground ml-0.5" />}
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 rounded-full bg-primary-500/60"
                      // Deterministic static waveform — a smooth sine pattern
                      // instead of impure Math.random() in render.
                      style={{ height: `${4 + Math.round(Math.abs(Math.sin(i * 0.6)) * 20)}px` }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Volume2 size={12} />
                <span>{fmtTime(recordingTime)}</span>
              </div>
            </div>

            {/* Name input */}
            <div className="space-y-1.5">
              <Label htmlFor="voice-name">Voice Name</Label>
              <Input
                id="voice-name"
                type="text"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                className="input-field"
                placeholder="e.g. My Voice, Character A…"
                maxLength={40}
                autoFocus
              />
            </div>

            {/* Language selector */}
            <div className="space-y-1.5">
              <Label htmlFor="voice-lang">Language spoken in sample</Label>
              <Select value={newVoiceLang} onValueChange={setNewVoiceLang}>
                <SelectTrigger id="voice-lang" className="input-field w-full">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map(l => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clone button */}
            <Button
              onClick={cloneVoice}
              disabled={isCloning || !newVoiceName.trim()}
              className="btn-primary w-full h-auto py-3.5 text-base rounded-xl"
            >
              {isCloning ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Cloning Voice…
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  Clone This Voice
                </>
              )}
            </Button>

            {isCloning && (
              <p className="text-xs text-center text-muted-foreground animate-pulse">
                Extracting voice characteristics · Training speaker model…
              </p>
            )}
          </Card>
        )}

        {/* Info card */}
        <Card className="card-glow flex flex-row items-start gap-3 animate-slide-up">
          <Music size={16} className="text-primary-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">How voice cloning works</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Record 10–60 seconds of your voice reading naturally. Chatterbox Multilingual extracts a
              speaker embedding and applies it as the avatar&apos;s voice during TTS synthesis. 23 languages supported.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
