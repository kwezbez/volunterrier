import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronRight, Compass, PlusCircle, Search, TrendingUp, Users, X } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { get } from '../lib/api'
import { rankOpportunities } from '../lib/recommend'
import { distanceTo, catOf } from '../data/taxonomy'
import { OppTile, Shelf, ShelfRow } from '../components/OppCard'
import { useDetails } from '../components/Details'
import { Avatar, Button, EmptyState, cx, fmtDate, fmtRange, hrs } from '../components/ui'
import { completion } from '../components/ProfileFields'
import type { Progress, PublicUser } from '../types'

interface FeedItem {
  user: PublicUser
  opportunityId: string
  title: string
  org: string
  category: string
  startAt: number
  timeZone: string
  hours: number
}

// Shortcut buttons: each says what that part of VolunTerrier is for, so new users know where to go.
const SHORTCUTS = [
  { to: 'discover', label: 'Discover', hint: 'Swipe through picks for you', icon: Compass },
  { to: 'search', label: 'Search near me', hint: 'Find by city, ZIP or address', icon: Search },
  { to: 'schedule', label: 'My Schedule', hint: 'Everything you’ve matched with', icon: CalendarDays },
  { to: 'progress', label: 'My Progress', hint: 'Your verified hours', icon: TrendingUp },
  { to: 'friends', label: 'Friends & Invites', hint: 'Volunteer with your people', icon: Users },
  { to: 'create', label: 'Post an opportunity', hint: 'Organize your own event', icon: PlusCircle },
] as const

const hideKey = (u: string) => `volunterrier:getting-started-hidden:${u}`

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const { state, dataVersion } = useStore()
  const { openOpp, openPerson } = useDetails()
  const user = state.user!
  const [progress, setProgress] = useState<Progress | null>(null)
  const [feed, setFeed] = useState<FeedItem[] | null>(null)
  const [friendCount, setFriendCount] = useState<number | null>(null)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hideKey(user.username)) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    get<{ progress: Progress }>('/progress').then((r) => setProgress(r.progress), () => {})
    get<{ feed: FeedItem[] }>('/feed').then((r) => setFeed(r.feed), () => setFeed([]))
    get<{ friends: unknown[]; outgoing: unknown[] }>('/friends').then((r) => setFriendCount(r.friends.length + r.outgoing.length), () => setFriendCount(0))
  }, [dataVersion])

  const [now] = useState(() => Date.now())
  const open = useMemo(() => state.opportunities.filter((o) => o.endAt > now && !o.isMine), [state.opportunities, now])
  const recommended = useMemo(() => rankOpportunities(user, open.filter((o) => !o.iAmGoing)).slice(0, 10), [user, open])
  const nearby = useMemo(
    () =>
      open
        .filter((o) => o.lat != null && !o.iAmGoing)
        .map((o) => ({ o, d: distanceTo(user, o) }))
        .filter((x) => x.d <= Math.max(user.maxDistance, 5))
        .sort((a, b) => a.d - b.d || a.o.startAt - b.o.startAt)
        .slice(0, 10),
    [open, user],
  )
  const schedule = state.opportunities.filter((o) => (o.iAmGoing || o.isMine) && o.endAt > now).sort((a, b) => a.startAt - b.startAt)
  const next = schedule[0]
  // Getting-started steps are computed from real account data, so they tick off as the user goes.
  const steps = [
    { done: completion(user) >= 70, title: 'Finish your profile', body: 'Your interests and schedule power your recommendations.', action: 'Edit profile', to: 'profile' },
    { done: state.opportunities.some((o) => o.iAmGoing), title: 'Match with an opportunity', body: 'Search nearby or swipe in Discover, then tap Match. It goes on your schedule.', action: 'Find one', to: 'search' },
    { done: (friendCount ?? 0) > 0, title: 'Invite a friend', body: 'Share a private link so you can volunteer together.', action: 'Invite', to: 'friends' },
    { done: (progress?.totalHours ?? 0) > 0, title: 'Earn your first verified hours', body: 'Show up, check in with the organizer’s code, and your hours are added.', action: 'How it works', to: 'progress' },
  ] as const
  const doneCount = steps.filter((x) => x.done).length
  const showSteps = !hidden && friendCount !== null && progress !== null && doneCount < steps.length
  const hideSteps = () => {
    setHidden(true)
    try {
      localStorage.setItem(hideKey(user.username), '1')
    } catch {
      /* private mode: hidden for this visit only */
    }
  }

  const pct = progress ? (progress.nextMilestone ? ((progress.totalHours - progress.previousMilestone) / (progress.nextMilestone - progress.previousMilestone)) * 100 : 100) : 0

  return (
    <div className="px-5 pb-12 pt-6 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {greeting()}, {user.name.split(' ')[0]}
      </h1>
      <p className="mt-1 text-ink-500">Find volunteer opportunities near you, match with them, and bring your friends.</p>

      {/* shortcuts */}
      <nav aria-label="Shortcuts" className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {SHORTCUTS.map((t) => (
          <a key={t.to} href={`#/${t.to}`} className="group flex items-center gap-2.5 rounded-xl border border-line p-2.5 transition-colors hover:bg-surface sm:gap-3 sm:p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-sage sm:h-10 sm:w-10 transition-colors group-hover:bg-moss group-hover:text-white">
              <t.icon size={19} strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.95rem] font-semibold leading-tight">{t.label}</span>
              <span className="hidden truncate text-sm text-ink-500 sm:block">{t.hint}</span>
            </span>
          </a>
        ))}
      </nav>

      {/* getting started (new users) */}
      {showSteps && (
        <section className="mt-6 rounded-xl border border-line p-4 sm:p-5" aria-labelledby="gs-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="gs-title" className="font-semibold">
                Getting started
              </h2>
              <p className="text-sm text-ink-500">
                {doneCount} of {steps.length} done
              </p>
            </div>
            <button onClick={hideSteps} className="rounded-full p-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-800" aria-label="Hide getting started">
              <X size={16} />
            </button>
          </div>
          <ol className="mt-3 divide-y divide-line">
            {steps.map((st, i) => (
              <li key={st.title} className="flex items-center gap-3 py-3">
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', st.done ? 'border-moss bg-moss text-white' : 'border-brand-300 text-ink-500')}>
                  {st.done ? <Check size={14} aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block font-medium', st.done && 'text-ink-500 line-through')}>{st.title}</span>
                  {!st.done && <span className="block text-sm text-ink-500">{st.body}</span>}
                  <span className="sr-only">{st.done ? 'Done' : 'Not done yet'}</span>
                </span>
                {!st.done && (
                  <Button size="sm" variant="secondary" onClick={() => go(st.to)}>
                    {st.action}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* summary strip */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] divide-y divide-line border-y border-line md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="py-4 md:pr-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-500">Next up</h2>
            <a href="#/schedule" className="flex items-center text-sm font-medium text-brand-700 hover:underline">
              Schedule <ChevronRight size={15} />
            </a>
          </div>
          {next ? (
            <button onClick={() => openOpp(next.id)} className="mt-1 block text-left">
              <span className="block text-lg font-semibold hover:underline">{next.title}</span>
              <span className="text-sm text-ink-500">
                {fmtDate(next.startAt, { timeZone: next.timeZone }).split(' · ')[0]} · {fmtRange(next.startAt, next.endAt, next.timeZone)}
                {schedule.length > 1 ? ` · ${schedule.length - 1} more coming up` : ''}
              </span>
            </button>
          ) : (
            <p className="mt-1 text-ink-600">Nothing scheduled. Match with an opportunity below to get started.</p>
          )}
        </div>
        <a href="#/progress" className="group block py-4 md:pl-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-500">Verified hours</h2>
            <span className="text-xs text-ink-500">{user.settings.progressVisibility === 'public' ? 'Public' : 'Private'}</span>
          </div>
          <p className="mt-1 text-lg font-semibold group-hover:underline">
            {progress ? hrs(progress.totalHours) : '—'}
            {progress?.nextMilestone ? <span className="font-normal text-ink-500"> · {+(progress.nextMilestone - progress.totalHours).toFixed(2)} hrs to the {progress.nextMilestone}-hour milestone</span> : null}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-200" role="progressbar" aria-label="Progress to next milestone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="h-full rounded-full bg-moss" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
          </div>
        </a>
      </div>

      <Shelf title="Recommended for you" action={<a href="#/discover" className="text-sm font-medium text-brand-700 hover:underline">Browse all</a>}>
        {recommended.length ? (
          <ShelfRow>
            {recommended.map((r) => (
              <OppTile key={r.opp.id} o={r.opp} note={r.headline} />
            ))}
          </ShelfRow>
        ) : (
          <EmptyState title="You’ve seen everything" body="Check back soon, or post an opportunity yourself." />
        )}
      </Shelf>

      <Shelf
        title="Near you"
        sub={user.home ? user.home.label : 'Based on your neighborhood. Set an exact location in Settings.'}
        action={<a href="#/search" className="text-sm font-medium text-brand-700 hover:underline">Search</a>}
      >
        {nearby.length ? (
          <ShelfRow>
            {nearby.map(({ o, d }) => (
              <OppTile key={o.id} o={o} note={`${d} mi away`} />
            ))}
          </ShelfRow>
        ) : (
          <EmptyState title="Nothing close by yet" body="Try a wider radius in Search." action={<Button size="sm" onClick={() => go('search')}>Open search</Button>} />
        )}
      </Shelf>

      <Shelf title="Friends’ activity" action={<a href="#/friends" className="text-sm font-medium text-brand-700 hover:underline">Friends</a>}>
        {feed === null ? (
          <div className="skeleton h-16 rounded-lg" />
        ) : feed.length === 0 ? (
          <EmptyState title="No friend activity yet" body="When friends who share their progress complete verified hours, it shows up here." action={<Button size="sm" variant="secondary" onClick={() => go('friends')}>Invite friends</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {feed.map((f) => (
              <li key={`${f.user.username}-${f.opportunityId}`} className="flex items-center gap-3 py-3">
                <button onClick={() => openPerson(f.user.username)} aria-label={`View ${f.user.displayName}'s profile`}>
                  <Avatar name={f.user.displayName} avatar={f.user.avatar} size={36} />
                </button>
                <p className="min-w-0 flex-1 text-sm">
                  <b className="font-semibold">{f.user.displayName}</b> volunteered {hrs(f.hours)} · {f.title}
                  <span className="block truncate text-ink-500">
                    {catOf(f.category).label} · {fmtDate(f.startAt, { timeZone: f.timeZone }).split(' · ')[0]}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Shelf>
    </div>
  )
}
