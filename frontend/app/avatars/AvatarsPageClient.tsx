'use client'

import { useState } from 'react'
import { AvatarUpload } from '@/components/AvatarUpload'
import { AvatarList } from '@/components/AvatarList'

export function AvatarsPageClient() {
  const [mgmtAvatar, setMgmtAvatar] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-6 py-10">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-black gradient-text">Avatars</h1>
        <p className="text-muted-foreground">Record or upload a photo or video and manage your avatars. Start talking to them in the Studio.</p>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <AvatarUpload />
        <AvatarList selectedAvatar={mgmtAvatar} onSelectAvatar={setMgmtAvatar} />
      </div>
    </div>
  )
}
