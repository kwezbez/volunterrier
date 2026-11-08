import { useEffect, useState } from 'react'
import { Lock, UserCheck, UserPlus } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { del, get, post } from '../lib/api'
import { ProgressView } from '../components/ProgressView'
import { Avatar, Button, EmptyState, Tag } from '../components/ui'
import { catOf } from '../data/taxonomy'
import type { Avatar as AvatarT, CategoryId, Progress } from '../types'

interface PublicProfileT {
  username: string
  displayName: string
  avatar: AvatarT | null
  bio: string
  pronouns: string
  interests: CategoryId[]
  causes: string[]
  memberSince: number
  limited?: boolean
  friendship: 'me' | 'none' | 'friends' | 'pending-in' | 'pending-out'
  progressVisibility?: 'private' | 'public'
  progress: Progress | null
}

export default function PublicProfile({ username }: { username: string }) {
  const { toast, fail } = useStore()
  const [p, setP] = useState<PublicProfileT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () =>
    get<{ profile: PublicProfileT }>(`/users/${encodeURIComponent(username)}`).then(
      (r) => setP(r.profile),
      (e) => setError(e.message),
    )
  useEffect(() => {
    setP(null)
    setError(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  if (error) return <div className="p-8"><EmptyState title="Profile not found" body={error} action={<Button onClick={() => go('friends')}>Back to friends</Button>} /></div>
  if (!p) return <div className="p-8"><div className="skeleton h-64 rounded-xl" /></div>

  const friendAction = async () => {
    try {
      if (p.friendship === 'none') await post('/friends/request', { username: p.username })
      else if (p.friendship === 'pending-in') await post(`/friends/${p.username}/accept`)
      else if (p.friendship === 'friends' && confirm(`Remove ${p.displayName} from your friends?`)) await del(`/friends/${p.username}`)
      else return
      toast('Updated', 'info')
      load()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div>
      <div className="border-b border-line px-5 pb-6 pt-8 sm:px-8">
        <div className="flex flex-wrap items-end gap-5">
          <Avatar name={p.displayName} avatar={p.avatar} size={88} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.displayName}</h1>
            <p className="mt-1 text-sm text-ink-500">
              @{p.username}
              {p.pronouns ? ` · ${p.pronouns}` : ''} · Member since {new Date(p.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          </div>
          {p.friendship === 'me' ? (
            <Button size="sm" variant="secondary" onClick={() => go('profile')}>Edit profile</Button>
          ) : (
            <Button size="sm" variant={p.friendship === 'friends' ? 'secondary' : 'primary'} onClick={friendAction} disabled={p.friendship === 'pending-out'}>
              {p.friendship === 'friends' ? <><UserCheck size={16} /> Friends</> : p.friendship === 'pending-out' ? 'Request sent' : p.friendship === 'pending-in' ? <><UserCheck size={16} /> Accept request</> : <><UserPlus size={16} /> Add friend</>}
            </Button>
          )}
        </div>
        {p.bio && <p className="mt-4 max-w-2xl text-ink-700">{p.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {p.interests.map((i) => (
            <Tag key={i}>
              {catOf(i).label}
            </Tag>
          ))}
          {p.causes.map((c) => (
            <Tag key={c} tone="violet">
              {c}
            </Tag>
          ))}
        </div>
      </div>
      <div className="px-5 py-8 sm:px-8">
        {p.friendship === 'me' && (
          <p className="mb-6 text-sm text-ink-500">
            This is how others see your profile. Your progress is <b>{p.progressVisibility}</b> — change it in <a href="#/settings" className="font-bold underline">Settings</a>.
          </p>
        )}
        {p.limited && (
          <p className="mb-4 text-sm text-ink-500">{p.displayName.split(' ')[0]}’s profile is private. Add them as a friend to see their bio and interests.</p>
        )}
        {p.progress ? (
          <ProgressView p={p.progress} />
        ) : (
          <EmptyState title={`${p.displayName.split(' ')[0]} keeps their progress private`} body="Volunteer hours and activity are only visible when someone chooses to share them." />
        )}
        <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-500">
          <Lock size={12} /> Public profiles never show email, schedules, location or account details.
        </p>
      </div>
    </div>
  )
}
