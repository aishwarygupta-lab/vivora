import Link from 'next/link'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Camera, Mic2, Sparkles, Zap, Globe, Cpu, Play, ChevronRight,
  Activity, AudioWaveform, MessagesSquare, Clapperboard, ArrowRight,
} from 'lucide-react'

const STEPS = [
  { n: '01', icon: Camera, title: 'Create an avatar', body: 'Upload a photo or record a clip up to 20 seconds. Video avatars move naturally; photos get lifelike lip-sync.', target: '/avatars', cta: 'Add an avatar' },
  { n: '02', icon: Mic2, title: 'Clone a voice', body: 'Add a short sample to clone any voice in 23 languages — or skip it and use a natural default voice.', target: '/voices', cta: 'Clone a voice' },
  { n: '03', icon: Clapperboard, title: 'Talk in the Studio', body: 'Start a session, pick your avatar and voice, and converse by text or push-to-talk voice — in real time.', target: '/studio', cta: 'Open the Studio' },
]

const FEATURES = [
  { icon: Activity, title: 'Real-time lip-sync', description: 'Every reply is rendered as photorealistic talking-head video with MuseTalk, frame-aligned to the speech.', color: 'from-teal-500 to-emerald-500' },
  { icon: AudioWaveform, title: 'Zero-shot voice cloning', description: 'A few seconds of audio is enough to clone a voice in 23 languages, powered by Chatterbox.', color: 'from-emerald-500 to-cyan-500' },
  { icon: MessagesSquare, title: 'Text or voice, one session', description: 'Type or hold-to-talk in the same conversation — your avatar answers with voice and lip-sync either way.', color: 'from-cyan-500 to-teal-500' },
  { icon: Zap, title: 'Streamed end to end', description: 'Tokens, audio, and video stream over a WebSocket, so replies start playing almost immediately.', color: 'from-teal-400 to-emerald-600' },
  { icon: Cpu, title: 'Runs on your hardware', description: 'Auto-uses a GPU when present and falls back to CPU. Your clips, voices, and chats stay on your infra.', color: 'from-emerald-400 to-teal-600' },
  { icon: Globe, title: '23 languages', description: 'Whisper transcription and Chatterbox speech cover 23 languages, end to end.', color: 'from-cyan-400 to-emerald-500' },
]

const STATS = [
  { value: '23', label: 'Languages' },
  { value: 'Photo · Video', label: 'Avatar sources' },
  { value: 'Text · Voice', label: 'Ways to talk' },
  { value: '100%', label: 'Self-hostable' },
]

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 animate-float rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -right-40 top-10 h-80 w-80 animate-float rounded-full bg-accent-500/15 blur-3xl" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-10 left-1/3 h-72 w-72 animate-float rounded-full bg-primary-800/20 blur-3xl" style={{ animationDelay: '4s' }} />
        </div>

        <Badge variant="outline" className="mb-8 animate-slide-up gap-1.5 border-primary/30 bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Open-source · self-hostable
        </Badge>

        <h1 className="mb-6 animate-slide-up text-5xl font-black leading-[1.05] tracking-tight md:text-7xl lg:text-8xl" style={{ animationDelay: '0.1s' }}>
          <span className="text-foreground">Clone a face.</span>
          <br />
          <span className="gradient-text">Clone a voice.</span>
          <br />
          <span className="gradient-text-gold">Have a conversation.</span>
        </h1>

        <p className="mb-10 max-w-2xl animate-slide-up text-lg leading-relaxed text-muted-foreground md:text-xl" style={{ animationDelay: '0.2s' }}>
          Vivora turns a photo or a short clip into a live avatar that listens, thinks, and
          replies with a cloned voice and real lip-sync — streamed in real time, on your own machine.
        </p>

        <div className="flex animate-slide-up flex-wrap items-center justify-center gap-4" style={{ animationDelay: '0.3s' }}>
          <Button asChild size="lg" className="group h-12 px-8 text-base">
            <Link href="/studio">
              <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
              Open the Studio
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="h-12 px-8 text-base">
            <Link href="/avatars">
              <Camera className="h-4 w-4" /> Create an avatar
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid w-full max-w-3xl animate-slide-up grid-cols-2 gap-6 sm:grid-cols-4" style={{ animationDelay: '0.4s' }}>
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-black gradient-text md:text-3xl">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground md:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-black md:text-4xl">
            Three steps to a <span className="gradient-text">talking avatar</span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Manage avatars and voices separately, then bring them together in the Studio.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body, target, cta }) => (
            <Card key={n} className="relative border-border/60 bg-card/60 backdrop-blur-xl">
              <CardContent className="pt-6">
                <span className="absolute right-5 top-4 text-4xl font-black text-primary/10">{n}</span>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <Button asChild variant="ghost" size="sm" className="gap-1 px-0 text-primary hover:bg-transparent hover:text-primary">
                  <Link href={target}>
                    {cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-black md:text-4xl">
            Built to feel <span className="gradient-text">alive</span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            The whole pipeline — transcription, reasoning, speech, and lip-sync — runs locally or on your own GPU box.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <Card key={title} className="group border-border/60 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardContent className="pt-6">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <Card className="relative overflow-hidden border-primary/30 bg-linear-to-br from-primary/10 to-accent-500/10">
          <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
            <h2 className="text-3xl font-black md:text-4xl">Ready to meet your avatar?</h2>
            <p className="max-w-xl text-muted-foreground">
              Sign in with the demo account and start a session in under a minute.
            </p>
            <Button asChild size="lg" className="group h-12 px-8 text-base">
              <Link href="/studio">
                <Clapperboard className="h-5 w-5" /> Open the Studio
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Footer />
    </div>
  )
}
