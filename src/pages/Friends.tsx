import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, Share2, UserPlus, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { del, get, post } from '../lib/api'
import { useDetails } from '../components/Details'
import { Avatar, AvatarStack, Button, EmptyState, SectionTitle, Tag, cx } from '../components/ui'
import { inputCls } from '../components/ProfileFields'
import type { PublicUser } from '../types'

interface FriendsRes {
  friends: (PublicUser & { publicProgress: boolean; totalHours: number | null })[]
  incoming: PublicUser[]
  outgoing: PublicUser[]
}
interface Invite {
  id: string
  createdAt: number
  expiresAt: number
  revoked: boolean
  opportunity: { id: string; title: string } | null
  accepted: (PublicUser & { acceptedAt: number })[]
}

export default function Friends() {
  const { toast, fail, state, loadData } = useStore()
  const { openOpp, openPerson } = useDetails()
  const [data, setData] = useState<FriendsRes | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [username, setUsername] = useState('')
  const [link, setLink] = useState<string | null>(null)

  const load = useCallback(() => {
    get<FriendsRes>('/friends').then(setData, fail)
    get<{ invites: Invite[] }>('/invites').then((r) => setInvites(r.invites), fail)
  }, [fail])
  useEffect(load, [load])

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast(msg, 'info')
      load()
      loadData()
    } catch (e) {
      fail(e)
    }
  }
  const makeLink = async () => {
    try {
      const r = await post<{ url: string }>('/invites', {})
      setLink(r.url.startsWith('http') ? r.url : `${window.location.origin}${r.url}`)
      load()
    } catch (e) {
      fail(e)
    }
  }
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast('Invite link copied'), () => toast('Select the link and copy it', 'info'))

  // events friends are attending
  const friendEvents = state.opportunities.filter((o) => o.friendsGoing.length > 0 && o.endAt > Date.now()).sort((a, b) => a.startAt - b.startAt)

  return (
    <div className="px-4 pb-10 pt-6 sm:px-8 sm:pt-4">
      <SectionTitle eyebrow="Friends & invitations" title="Volunteer together" sub="Invite friends, see where they’re going, and show up as a crew." />

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        {/* invite link */}
        <section className="rounded-xl bg-brand-800 p-6 text-brand-50">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Link2 size={20} className="text-sage" /> Invite friends with a link
          </h2>
          <p className="mt-1 text-sm text-brand-50/75">Anyone with the link can connect with you. Links are random, private and expire in 14 days — they never contain your username.</p>
          {link ? (
            <div className="mt-4 space-y-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" className="w-full rounded-2xl bg-brand-900 px-4 py-3 font-mono text-xs text-sage outline-none" />
              <div className="flex gap-2">
                <Button onClick={() => copy(link)}>
                  <Copy size={15} /> Copy link
                </Button>
                {typeof navigator.share === 'function' && (
                  <Button variant="secondary" onClick={() => navigator.share({ title: 'Volunteer with me on VolunTerrier', url: link }).catch(() => {})}>
                    <Share2 size={15} /> Share
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button className="mt-4" onClick={makeLink}>
              Create invite link
            </Button>
          )}
          <p className="mt-3 text-xs text-brand-50/60">Tip: open any opportunity and use “Invite friends” to invite people to that specific event.</p>
        </section>

        {/* add by username */}
        <section className="rounded-xl bg-surface p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UserPlus size={20} className="text-moss" /> Add by username
          </h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!username.trim()) return
              act(() => post('/friends/request', { username: username.trim() }), 'Friend request sent').then(() => setUsername(''))
            }}
          >
            <label htmlFor="add-friend" className="sr-only">
              Friend’s username
            </label>
            <input id="add-friend" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="their_username" className={cx(inputCls, 'py-2.5')} autoCapitalize="none" maxLength={24} />
            <Button type="submit">Send</Button>
          </form>
          <p className="mt-2 text-xs text-ink-500">Your username: <b>@{state.user?.username}</b></p>

          {data && (data.incoming.length > 0 || data.outgoing.length > 0) && (
            <div className="mt-5 space-y-3">
              {data.incoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold">Requests for you</h3>
                  <ul className="mt-2 space-y-2">
                    {data.incoming.map((u) => (
                      <li key={u.username} className="flex items-center gap-3 rounded-2xl bg-brand-50 p-2">
                        <Avatar name={u.displayName} avatar={u.avatar} size={36} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{u.displayName}</span>
                        <Button size="sm" onClick={() => act(() => post(`/friends/${u.username}/accept`), `You and ${u.displayName} are now friends`)}>
                          <Check size={14} /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={`Decline ${u.displayName}`} onClick={() => act(() => del(`/friends/${u.username}`), 'Request declined')}>
                          <X size={14} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.outgoing.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold">Sent</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {data.outgoing.map((u) => (
                      <li key={u.username} className="flex items-center gap-2 rounded-full bg-brand-50 py-1 pl-1 pr-2 text-sm">
                        <Avatar name={u.displayName} avatar={u.avatar} size={26} /> {u.displayName}
                        <button className="rounded-full p-1 hover:bg-brand-100" aria-label={`Cancel request to ${u.displayName}`} onClick={() => act(() => del(`/friends/${u.username}`), 'Request cancelled')}>
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* friends */}
      <section className="mt-8">
        <h2 className="text-xl font-bold">Your friends {data ? `(${data.friends.length})` : ''}</h2>
        {!data ? (
          <div className="skeleton mt-3 h-24 rounded-2xl" />
        ) : data.friends.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No friends yet" body="Share an invite link — when someone accepts, you’ll be connected automatically." />
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.friends.map((f) => (
              <li key={f.username}>
                <button onClick={() => openPerson(f.username)} className="flex w-full flex-col items-center rounded-2xl bg-surface p-4 text-center hover:bg-surface-hover">
                  <Avatar name={f.displayName} avatar={f.avatar} size={72} />
                  <span className="mt-2 block w-full truncate font-bold">{f.displayName}</span>
                  <span className="text-xs text-ink-500">{f.publicProgress ? `${+(f.totalHours ?? 0).toFixed(2)} verified hrs` : 'Private progress'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* friends attending */}
      <section className="mt-8">
        <h2 className="text-xl font-bold">Where your friends are going</h2>
        {friendEvents.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">When friends match with upcoming events (and share attendance), they’ll show up here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {friendEvents.map((o) => (
              <li key={o.id}>
                <button onClick={() => openOpp(o.id)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left hover:bg-surface-hover">
                  <AvatarStack people={o.friendsGoing.map((f) => ({ name: f.displayName, avatar: f.avatar }))} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{o.title}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {o.friendsGoing.map((f) => f.displayName.split(' ')[0]).join(', ')} matched · {new Date(o.startAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: o.timeZone })}
                    </span>
                  </span>
                  {o.iAmGoing ? <Tag tone="brand">You matched too</Tag> : <Tag>Match with them</Tag>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* invitations sent */}
      <section className="mt-8">
        <h2 className="text-xl font-bold">Invitations you’ve sent</h2>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No invitations yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invites.map((i) => {
              const expired = i.revoked || i.expiresAt < Date.now()
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{i.opportunity ? i.opportunity.title : 'General friend invite'}</span>
                    <span className="text-xs text-ink-500">
                      Created {new Date(i.createdAt).toLocaleDateString()} · {i.revoked ? 'Revoked' : expired ? 'Expired' : `Expires ${new Date(i.expiresAt).toLocaleDateString()}`}
                    </span>
                  </span>
                  {i.accepted.length > 0 ? (
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <AvatarStack people={i.accepted.map((a) => ({ name: a.displayName, avatar: a.avatar }))} size={26} />
                      Accepted by {i.accepted.map((a) => a.displayName.split(' ')[0]).join(', ')}
                    </span>
                  ) : (
                    <Tag>Not accepted yet</Tag>
                  )}
                  {!expired && (
                    <Button size="sm" variant="ghost" onClick={() => act(() => del(`/invites/${i.id}`), 'Invitation revoked')}>
                      Revoke
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-500">For security, a link is only shown once when you create it. Create a new one any time.</p>
      </section>
    </div>
  )
}
