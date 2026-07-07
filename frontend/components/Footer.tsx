import Link from 'next/link'
import { Github } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Separator } from '@/components/ui/separator'

const REPO_URL = 'https://github.com/sur950/vivora'

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-sm space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">
              Record a clip, clone a voice, and bring any face to life in real time — with
              on-device lip-sync you can self-host.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol title="Product" links={[
              { label: 'Avatars', href: '/avatars' },
              { label: 'Voice Studio', href: '/voices' },
              { label: 'Studio', href: '/studio' },
            ]} />
            <FooterCol title="Powered by" links={[
              { label: 'MuseTalk', href: 'https://github.com/TMElyralab/MuseTalk' },
              { label: 'Whisper', href: 'https://github.com/openai/whisper' },
              { label: 'Chatterbox', href: 'https://github.com/resemble-ai/chatterbox' },
            ]} />
            <FooterCol title="Resources" links={[
              { label: 'GitHub', href: REPO_URL },
              { label: 'Docs', href: `${REPO_URL}#readme` },
            ]} />
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Vivora · Suresh Konakanchi</p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" /> sur950/vivora
          </a>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
