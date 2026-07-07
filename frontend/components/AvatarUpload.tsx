'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload, Loader2, X, CheckCircle2, ImagePlus, Sparkles, AlertCircle,
  Video, Camera, Circle, Square,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const MAX_IMAGE_MB = 10
const MAX_VIDEO_MB = 100
const MAX_RECORD_SECONDS = 20

type Kind = 'image' | 'video'
type Tab = 'upload' | 'record'

export function AvatarUpload() {
  const [tab, setTab] = useState<Tab>('upload')
  const [dragActive, setDragActive] = useState(false)

  // Selected media (upload OR finished recording)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>('image')
  const [fileName, setFileName] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const liveVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.uploadAvatar(formData),
    onSuccess: () => {
      toast.success('Avatar created!', { icon: '✨' })
      resetSelection()
      setName('')
      queryClient.invalidateQueries({ queryKey: ['avatars'] })
    },
    onError: () => toast.error('Upload failed — please try again'),
  })

  // ── cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    stopStream()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setBlob(null)
    setPreviewUrl(null)
    setFileName('')
    setError(null)
  }

  // ── file selection (image OR video) ────────────────────────────────────────
  const processFile = (file: File) => {
    setError(null)
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setError('Please choose an image (JPG, PNG, WEBP) or a video (MP4, WEBM, MOV).')
      return
    }
    const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB
    if (file.size > maxMb * 1024 * 1024) {
      setError(`${isVideo ? 'Video' : 'Image'} must be under ${maxMb} MB.`)
      return
    }

    resetSelection()
    setKind(isVideo ? 'video' : 'image')
    setFileName(file.name)
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''))
    setPreviewUrl(URL.createObjectURL(file))
    setBlob(file)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0])
  }

  // ── in-browser recording ────────────────────────────────────────────────
  const stopStream = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  const startCamera = async () => {
    setError(null)
    resetSelection()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, facingMode: 'user' },
        audio: false, // the recorded clip only drives the face; TTS supplies the voice
      })
      streamRef.current = stream
      setCameraReady(true)
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        await liveVideoRef.current.play().catch(() => {})
      }
    } catch {
      setError('Could not access your camera. Check browser permissions and try again.')
    }
  }

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream) { startCamera(); return }

    chunksRef.current = []
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType: mime })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const recorded = new Blob(chunksRef.current, { type: 'video/webm' })
      if (recorded.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(`Recording is too large (max ${MAX_VIDEO_MB} MB). Try a shorter clip.`)
      } else {
        setKind('video')
        setFileName('recording.webm')
        if (!name) setName('My avatar')
        setPreviewUrl(URL.createObjectURL(recorded))
        setBlob(recorded)
      }
      stopStream()
      setIsRecording(false)
      setElapsed(0)
    }

    recorder.start()
    setIsRecording(true)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    stopTimeoutRef.current = setTimeout(stopRecording, MAX_RECORD_SECONDS * 1000)
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    stopStream()
    setIsRecording(false)
    setElapsed(0)
    resetSelection()
    setTab(next)
  }

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!blob) { setError('Please choose or record something first.'); return }
    if (!name.trim()) { setError('Please give your avatar a name.'); return }
    const fallback = kind === 'video' ? 'avatar.webm' : 'avatar.jpg'
    const formData = new FormData()
    formData.append('file', blob, fileName || fallback)
    formData.append('name', name.trim())
    uploadMutation.mutate(formData)
  }

  const busy = uploadMutation.isPending

  // Shared media preview (used by both tabs once media is chosen)
  const preview = previewUrl ? (
    <div className="relative rounded-2xl overflow-hidden border border-border group">
      {kind === 'video' ? (
        <video src={previewUrl} className="w-full max-h-64 object-contain bg-black" controls playsInline loop muted />
      ) : (
        // Raw <img> is required here: previewUrl is a blob: object URL from
        // URL.createObjectURL(), which next/image cannot load/optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Avatar preview" className="w-full max-h-64 object-cover" />
      )}
      <button
        onClick={resetSelection}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-900/80 backdrop-blur-sm border border-border
                   flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-destructive/40 transition-all"
      >
        <X size={15} />
      </button>
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                      bg-surface-900/80 backdrop-blur-sm border border-border">
        <CheckCircle2 size={13} className="text-green-400" />
        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
          {kind === 'video' ? '🎬 ' : '🖼 '}{fileName}
        </span>
      </div>
    </div>
  ) : null

  return (
    <Card className="flex flex-col gap-5">
      {/* Header */}
      <CardHeader>
        <CardTitle className="text-xl font-bold">Create Avatar</CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">
          Photo or video · record up to {MAX_RECORD_SECONDS}s · videos up to {MAX_VIDEO_MB} MB
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => switchTab(v as Tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1">
              <Upload size={15} /> Upload
            </TabsTrigger>
            <TabsTrigger value="record" className="flex-1">
              <Camera size={15} /> Record
            </TabsTrigger>
          </TabsList>

          {/* Name field (shared across tabs) */}
          <div className="space-y-1.5 mt-5">
            <Label htmlFor="avatar-name" className="text-muted-foreground">Avatar Name</Label>
            <Input
              id="avatar-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder="e.g. Alex, News Anchor, CEO…"
              maxLength={60}
            />
          </div>

          {/* ── UPLOAD tab ── */}
          <TabsContent value="upload" className="mt-5 flex flex-col gap-5">
            {previewUrl ? (
              preview
            ) : (
              /* ── UPLOAD drop zone (image or video) ── */
              <div
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={cn(
                  'relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300',
                  dragActive
                    ? 'border-primary-400 bg-primary-500/10 scale-[1.01] shadow-glow-sm'
                    : 'border-border hover:border-primary-500/50 hover:bg-primary-500/5'
                )}
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none flex flex-col items-center gap-4">
                  <div className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300',
                    dragActive ? 'bg-primary-500/20 border-primary-400/50' : 'bg-surface-700/80 border-border'
                  )}>
                    {dragActive ? <Sparkles size={28} className="text-primary-400 animate-pulse" />
                                : <ImagePlus size={28} className="text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-base mb-1">
                      {dragActive ? 'Drop to upload' : 'Drag & drop a photo or video'}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      or <span className="text-primary-400 font-medium underline underline-offset-2">click to browse</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {['Clear face', 'Good lighting', 'Front-facing'].map((tip) => (
                      <Badge key={tip} variant="secondary" className="text-xs">{tip}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── RECORD tab ── */}
          <TabsContent value="record" className="mt-5 flex flex-col gap-5">
            {previewUrl ? (
              preview
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden bg-black relative">
                <video ref={liveVideoRef} className="w-full max-h-64 object-cover" muted playsInline autoPlay />
                {!cameraReady && !isRecording && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900/70">
                    <Video size={30} className="text-primary-400" />
                    <Button variant="secondary" size="sm" onClick={startCamera}>
                      Enable camera
                    </Button>
                  </div>
                )}
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/80 backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs text-white font-medium">{elapsed}s / {MAX_RECORD_SECONDS}s</span>
                  </div>
                )}
              </div>
            )}

            {/* Record controls */}
            {!previewUrl && (
              <div className="flex justify-center">
                {!isRecording ? (
                  <Button
                    variant="destructive"
                    onClick={startRecording}
                    disabled={!cameraReady}
                  >
                    <Circle size={16} className="fill-white" /> Start recording
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={stopRecording}>
                    <Square size={16} className="fill-current" /> Stop
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 animate-slide-up">
            <AlertCircle size={14} className="text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Submit */}
        {previewUrl && (
          <Button
            onClick={handleSubmit}
            disabled={busy || !name.trim()}
            className="w-full py-3.5 text-base rounded-xl animate-slide-up h-auto"
          >
            {busy ? (<><Loader2 size={18} className="animate-spin" /> Uploading & Processing…</>)
                  : (<><Upload size={18} /> Create Avatar</>)}
          </Button>
        )}

        {busy && (
          <p className="text-xs text-center text-muted-foreground animate-pulse">
            {kind === 'video' ? 'Analysing frames · Extracting face · Optimizing…' : 'Detecting face · Cropping · Optimizing…'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
