import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, List, MapPin } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { useDetails } from '../components/Details'
import { Button, EmptyState, SampleBadge, SectionTitle, Tag, cx, fmtDay, fmtRange, hrs } from '../components/ui'
import type { Opportunity } from '../types'

const dayKey = (ms: number, tz: string) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz })
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function status(o: Opportunity) {
  if (o.isMine) return { label: o.completed ? 'Organized' : 'Organizing', tone: 'dark' as const }
  if (o.myVerified) return { label: `Verified · ${hrs(o.durationHours)}`, tone: 'brand' as const }
  if (o.completed) return { label: 'Awaiting verification', tone: 'violet' as const }
  if (o.started) return { label: 'Happening now', tone: 'brand' as const }
  return { label: 'Matched', tone: 'green' as const }
}

export default function Schedule() {
  const { state, setJoined, toast } = useStore()
  const { openOpp } = useDetails()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState<string | null>(null)
  const now = Date.now()

  const mine = useMemo(() => state.opportunities.filter((o) => o.iAmGoing || o.isMine).sort((a, b) => a.startAt - b.startAt), [state.opportunities])
  const upcoming = mine.filter((o) => o.endAt > now)
  const past = mine.filter((o) => o.endAt <= now).reverse()
  const list = tab === 'upcoming' ? upcoming : past
  const hoursPlanned = upcoming.filter((o) => !o.isMine).reduce((s, o) => s + o.durationHours, 0)

  // group list by day (in each event's own zone)
  const groups = useMemo(() => {
    const m = new Map<string, Opportunity[]>()
    for (const o of list) {
      const k = dayKey(o.startAt, o.timeZone)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(o)
    }
    return [...m.entries()]
  }, [list])

  // calendar grid
  const cells = useMemo(() => {
    const first = new Date(month)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [month])
  const byDay = useMemo(() => {
    const m = new Map<string, Opportunity[]>()
    for (const o of mine) {
      const k = dayKey(o.startAt, o.timeZone)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(o)
    }
    return m
  }, [mine])
  const selectedEvents = selected ? byDay.get(selected) ?? [] : []

  const Row = ({ o }: { o: Opportunity }) => {
    const st = status(o)
    return (
      <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center">
        <button onClick={() => openOpp(o.id)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-brand-300">
            <span className="text-[11px] font-medium uppercase text-ink-500">{new Date(o.startAt).toLocaleDateString(undefined, { month: 'short', timeZone: o.timeZone })}</span>
            <span className="text-xl font-semibold leading-none">{new Date(o.startAt).toLocaleDateString(undefined, { day: 'numeric', timeZone: o.timeZone })}</span>
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <Tag tone={st.tone}>{st.label}</Tag>
              {o.isSample && <SampleBadge />}
            </span>
            <span className="mt-1 block font-semibold leading-snug">{o.title}</span>
            <span className="block text-sm text-ink-600">{o.org}</span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-ink-500">
              <span className="flex items-center gap-1">
                <Clock size={13} aria-hidden /> {fmtRange(o.startAt, o.endAt, o.timeZone)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={13} aria-hidden /> {o.area === 'remote' ? 'Online' : `${o.address}${o.city ? `, ${o.city}` : ''}`}
              </span>
            </span>
          </span>
        </button>
        {tab === 'upcoming' && !o.isMine && !o.myVerified && !o.started && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (await setJoined(o.id, false)) toast('Match cancelled', 'info')
            }}
          >
            Cancel match
          </Button>
        )}
      </li>
    )
  }

  return (
    <div className="px-5 pb-12 pt-6 sm:px-8">
      <SectionTitle title="My schedule" sub="Everything you’ve matched with or are organizing. We block double-booking automatically." />

      <p className="mt-4 text-sm text-ink-600">
        <b className="font-semibold text-brand-800">{upcoming.length}</b> upcoming · <b className="font-semibold text-brand-800">{+hoursPlanned.toFixed(2)}</b> hours planned ·{' '}
        <b className="font-semibold text-brand-800">{past.filter((o) => o.myVerified).length}</b> verified
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Schedule" className="inline-flex rounded-full bg-surface p-1">
          {(['upcoming', 'past'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setView('list') }} className={cx('rounded-full px-4 py-2 text-sm font-bold capitalize', tab === t && view === 'list' ? 'bg-moss text-white' : 'text-brand-700')}>
              {t} <span className="opacity-70">({t === 'upcoming' ? upcoming.length : past.length})</span>
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-full bg-surface p-1" role="group" aria-label="View">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')} className={cx('flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold', view === 'list' ? 'bg-brand-800 text-brand-50' : 'text-brand-700')}>
            <List size={15} /> List
          </button>
          <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} className={cx('flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold', view === 'calendar' ? 'bg-brand-800 text-brand-50' : 'text-brand-700')}>
            <CalendarDays size={15} /> Calendar
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="mt-5" role="tabpanel">
          {list.length === 0 ? (
            <EmptyState
              title={tab === 'upcoming' ? 'Nothing on your schedule yet' : 'No past commitments yet'}
              body={tab === 'upcoming' ? 'Find something you love and tap “Match”. It’ll show up here.' : 'After you volunteer, your past events and verification status appear here.'}
              action={tab === 'upcoming' ? <Button onClick={() => go('search')}>Find opportunities</Button> : undefined}
            />
          ) : (
            <div className="space-y-6">
              {groups.map(([day, items]) => (
                <section key={day} aria-label={fmtDay(items[0]!.startAt, items[0]!.timeZone)}>
                  <h2 className="mb-1 text-sm font-medium text-ink-500">{fmtDay(items[0]!.startAt, items[0]!.timeZone)}</h2>
                  <ul className="divide-y divide-line border-y border-line">
                    {items.map((o) => (
                      <Row key={o.id} o={o} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {tab === 'past' && past.some((o) => !o.isMine && !o.myVerified) && (
            <p className="mt-4 text-sm text-ink-500">
              Hours count toward your progress only after the organizer verifies your attendance (or you check in with the event code).
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full p-2 hover:bg-surface-hover" aria-label="Previous month">
                <ChevronLeft size={20} />
              </button>
              <h2 className="font-bold" aria-live="polite">
                {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full p-2 hover:bg-surface-hover" aria-label="Next month">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-ink-500" aria-hidden>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label="Month calendar">
              {cells.map((d) => {
                const k = localKey(d)
                const evs = byDay.get(k) ?? []
                const inMonth = d.getMonth() === month.getMonth()
                const today = k === localKey(new Date())
                return (
                  <button
                    key={k}
                    role="gridcell"
                    onClick={() => setSelected(k)}
                    aria-label={`${d.toDateString()}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`}
                    aria-selected={selected === k}
                    className={cx(
                      'flex aspect-square flex-col items-center justify-start rounded-xl p-1 text-sm font-semibold transition',
                      inMonth ? 'text-brand-800' : 'text-ink-300',
                      selected === k ? 'bg-moss text-white' : evs.length ? 'bg-sage/45 hover:bg-sage/70' : 'hover:bg-surface-hover',
                      today && selected !== k && 'ring-2 ring-moss',
                    )}
                  >
                    {d.getDate()}
                    {evs.length > 0 && (
                      <span className="mt-auto flex gap-0.5" aria-hidden>
                        {evs.slice(0, 3).map((e) => (
                          <span key={e.id} className={cx('h-1.5 w-1.5 rounded-full', selected === k ? 'bg-surface' : e.isMine ? 'bg-brand-800' : 'bg-moss')} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 flex gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-moss" /> Volunteering</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-800" /> Organizing</span>
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-bold">{selected ? new Date(`${selected}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Pick a day'}</h2>
            {selected && selectedEvents.length === 0 && <p className="text-sm text-ink-500">Nothing planned — a free day!</p>}
            <ul className="space-y-2">
              {selectedEvents.map((o) => (
                <Row key={o.id} o={o} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
