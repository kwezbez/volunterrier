import { useMemo, useState } from 'react'
import { Check, MapPin, Search, Users, CalendarDays } from 'lucide-react'
import { useStore } from '../lib/store'
import { useDetails } from '../components/Details'
import { AvatarStack, Button, EmptyState, Img, Modal, SampleBadge, SectionTitle, Tag, cx, fmtDate } from '../components/ui'
import { accessOf, areaLabel, catOf, socialOf } from '../data/taxonomy'
import type { Group } from '../types'

export default function Communities() {
  const { state } = useStore()
  const user = state.user!
  const [q, setQ] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const groups = useMemo(() => {
    const scored = state.groups.map((g) => ({
      g,
      shared: g.categories.filter((c) => user.interests.includes(c)),
      score: g.categories.filter((c) => user.interests.includes(c)).length * 10 + g.access.filter((a) => user.access.includes(a)).length * 4 + g.social.filter((s) => user.social.includes(s)).length * 3,
    }))
    return scored
      .filter(({ g }) => (onlyMine ? state.groupsJoined.includes(g.id) : true))
      .filter(({ g }) => !q || `${g.name} ${g.tagline} ${g.description} ${g.categories.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.score - a.score)
  }, [state.groups, state.groupsJoined, user, q, onlyMine])

  const openGroup = state.groups.find((g) => g.id === open)

  return (
    <div className="px-5 pb-12 pt-6 sm:px-8">
      <SectionTitle title="Communities" sub="Recurring groups make it easier to keep showing up with the same people." />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="hc-border flex flex-1 items-center gap-2 rounded-full border border-ink-200 bg-surface px-4 py-2.5 focus-within:ring-4 focus-within:ring-brand-100">
          <Search size={18} className="text-ink-400" aria-hidden />
          <span className="sr-only">Search groups</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hoops, animals, tech…" className="w-full bg-transparent outline-none" />
        </label>
        <div className="inline-flex rounded-full bg-surface p-1" role="group" aria-label="Show">
          {[
            { v: false, l: 'All groups' },
            { v: true, l: `My groups (${state.groupsJoined.length})` },
          ].map((o) => (
            <button key={o.l} aria-pressed={onlyMine === o.v} onClick={() => setOnlyMine(o.v)} className={cx('rounded-full px-4 py-2 text-sm font-bold', onlyMine === o.v ? 'bg-ink-900 text-white' : 'text-ink-500')}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={onlyMine ? 'You haven’t joined a group yet' : 'No groups match that search'} body={onlyMine ? 'Groups are the easiest way to make volunteering a habit — and make friends.' : 'Try a different keyword.'} action={onlyMine ? <Button onClick={() => setOnlyMine(false)}>Browse groups</Button> : undefined} />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ g, shared }, i) => (
            <GroupCard key={g.id} g={g} shared={shared} suggested={i < 2 && shared.length > 0 && !onlyMine && !q} onOpen={() => setOpen(g.id)} />
          ))}
        </ul>
      )}

      <Modal open={!!openGroup} onClose={() => setOpen(null)} label={openGroup ? openGroup.name : 'Group'} wide>
        {openGroup && <GroupDetail g={openGroup} />}
      </Modal>
    </div>
  )
}

function JoinButton({ g, size = 'sm' }: { g: Group; size?: 'sm' | 'md' }) {
  const { state, setGroupJoined, toast } = useStore()
  const joined = state.groupsJoined.includes(g.id)
  return (
    <Button
      size={size}
      variant={joined ? 'secondary' : 'primary'}
      aria-pressed={joined}
      onClick={(e) => {
        e.stopPropagation()
        setGroupJoined(g.id, !joined)
        toast(joined ? `Left ${g.name}` : `Joined ${g.name}`, 'info')
      }}
    >
      {joined ? (
        <>
          <Check size={14} /> Joined
        </>
      ) : (
        'Join group'
      )}
    </Button>
  )
}

function GroupCard({ g, shared, suggested, onOpen }: { g: Group; shared: string[]; suggested: boolean; onOpen: () => void }) {
  const members = g.friends.map((f) => ({ name: f.displayName, avatar: f.avatar }))
  return (
    <li className="group flex flex-col overflow-hidden rounded-xl bg-surface transition hover:-translate-y-0.5 hover:">
      <button onClick={onOpen} className="text-left" aria-label={`${g.name}. View group`}>
        <div className="relative h-32">
          <Img src={g.cover} alt="" category={g.categories[0]} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 to-transparent" />
          <span className="absolute left-3 top-3 flex gap-1.5">
            {g.isSample && <SampleBadge />}
            {suggested && <Tag tone="white">Suggested</Tag>}
          </span>
          </div>
        <div className="px-4 pb-2 pt-3">
          <h2 className="text-lg font-bold leading-tight">{g.name}</h2>
          <p className="mt-0.5 text-sm text-ink-500">{g.tagline}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink-500">
            <AvatarStack people={members} size={22} />
            <Users size={13} aria-hidden /> {g.members} member{g.members === 1 ? '' : 's'}{members.length ? ` · ${members.length} friend${members.length > 1 ? 's' : ''}` : ''} · <MapPin size={13} aria-hidden /> {areaLabel(g.area).split(' ')[0]}
          </div>
          {shared.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-brand-600">You share: {shared.map((c) => catOf(c).label.split(' ')[0]).join(', ')}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {g.access.slice(0, 3).map((a) => (
              <Tag key={a} tone="green">
                {accessOf(a).short}
              </Tag>
            ))}
          </div>
        </div>
      </button>
      <div className="mt-auto flex items-center justify-between px-4 pb-4 pt-2">
        <span className="text-xs text-ink-400">{g.meets}</span>
        <JoinButton g={g} />
      </div>
    </li>
  )
}

function GroupDetail({ g }: { g: Group }) {
  const { state } = useStore()
  const { openOpp, openPerson } = useDetails()
  const user = state.user!
  const upcoming = state.opportunities
    .filter((o) => (o.groupId === g.id || (o.org === g.name && !o.groupId)) && o.endAt > Date.now())
    .sort((a, b) => a.startAt - b.startAt)
  const shared = g.categories.filter((c) => user.interests.includes(c))
  return (
    <div>
      <div className="relative h-52">
        <Img src={g.cover} alt={g.name} category={g.categories[0]} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 flex items-end gap-4 text-white">
          <div>
            <h2 className="text-2xl font-bold">{g.name}</h2>
            <p className="text-white/80">{g.tagline}</p>
          </div>
        </div>
      </div>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <JoinButton g={g} size="md" />
          <span className="text-sm font-semibold text-ink-500">
            <Users size={14} className="inline" aria-hidden /> {g.members} member{g.members === 1 ? '' : 's'} · {g.meets} · {areaLabel(g.area)}
          </span>
        </div>
        <p className="leading-relaxed text-ink-600">{g.description}</p>
        {shared.length > 0 && (
          <p className="rounded-2xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">Shared interests: {shared.map((c) => catOf(c).label).join(', ')}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {g.access.map((a) => (
            <Tag key={a} tone="green">
              {accessOf(a).label}
            </Tag>
          ))}
          {g.social.map((s) => (
            <Tag key={s} tone="violet">
              {socialOf(s).label}
            </Tag>
          ))}
        </div>
        <section>
          <h3 className="font-bold">Upcoming activities</h3>
          {upcoming.length === 0 ? (
            <p className="mt-1 text-sm text-ink-500">No events posted yet — check back soon.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {upcoming.map((o) => (
                <li key={o.id}>
                  <button className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 p-2 text-left hover:bg-ink-50" onClick={() => openOpp(o.id)}>
                    <Img src={o.image} alt="" category={o.category} className="h-14 w-14 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{o.title}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-500">
                        <CalendarDays size={12} aria-hidden /> {fmtDate(o.startAt, { timeZone: o.timeZone })}
                      </span>
                    </span>
                    {o.iAmGoing && <Tag tone="brand">Matched</Tag>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="font-bold">Friends in this group</h3>
          {g.friends.length === 0 ? (
            <p className="mt-1 text-sm text-ink-500">None of your friends have joined yet. Members’ identities are only shown to their friends.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-3">
              {g.friends.map((m) => (
                <li key={m.username}>
                  <button onClick={() => openPerson(m.username)} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm font-semibold hover:bg-surface-hover">
                    <AvatarStack people={[{ name: m.displayName, avatar: m.avatar }]} size={30} /> {m.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {g.isSample && <p className="rounded-2xl bg-brand-100 p-3 text-sm text-ink-600"><b>Sample group.</b> An example community used to demonstrate VolunTerrier. Member counts reflect real VolunTerrier users who joined.</p>}
      </div>
    </div>
  )
}
