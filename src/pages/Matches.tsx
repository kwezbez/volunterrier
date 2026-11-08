import { useState } from 'react'
import { Bookmark, CalendarCheck, Heart, MapPin, Trash2, Check, UserPlus } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { useDetails } from '../components/Details'
import { Button, EmptyState, Img, SectionTitle, Tag, cx, fmtDate } from '../components/ui'
import { areaLabel } from '../data/taxonomy'
import type { Opportunity } from '../types'

type Tab = 'going' | 'liked' | 'saved'

function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
}

export default function Matches() {
  const { state } = useStore()
  const [tab, setTab] = useState<Tab>('going')
  const byId = (ids: string[]) => state.opportunities.filter((o) => ids.includes(o.id))
  const going = byId(state.joined).filter((o) => o.endAt > Date.now()).sort((a, b) => a.startAt - b.startAt)
  const liked = byId(state.liked.filter((id) => !state.joined.includes(id)))
  const saved = byId(state.saved)
  const lists: Record<Tab, Opportunity[]> = { going, liked, saved }
  const tabs: { id: Tab; label: string; icon: typeof Heart; n: number }[] = [
    { id: 'going', label: 'Matched', icon: CalendarCheck, n: going.length },
    { id: 'liked', label: 'Liked', icon: Heart, n: liked.length },
    { id: 'saved', label: 'Saved', icon: Bookmark, n: saved.length },
  ]
  const list = lists[tab]

  return (
    <div className="px-5 pb-12 pt-6 sm:px-8">
      <SectionTitle title="Saved" sub="Opportunities you matched with, liked or saved." />

      <div role="tablist" aria-label="Match lists" className="mt-6 flex w-full rounded-full border border-brand-300 p-1 sm:inline-flex sm:w-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.id === tab)
              if (e.key === 'ArrowRight') setTab(tabs[(i + 1) % tabs.length]!.id)
              if (e.key === 'ArrowLeft') setTab(tabs[(i + tabs.length - 1) % tabs.length]!.id)
            }}
            tabIndex={tab === t.id ? 0 : -1}
            className={cx('flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition sm:flex-none sm:px-4', tab === t.id ? 'bg-moss text-white' : 'text-ink-500 hover:text-ink-800')}
          >
            <t.icon size={15} /> {t.label}
            <span className={cx('rounded-full px-1.5 text-xs', tab === t.id ? 'bg-brand-50/20' : 'bg-ink-100')}>{t.n}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {list.length === 0 ? (
          <EmptyState
            title={tab === 'going' ? 'No matches yet' : tab === 'liked' ? 'No likes yet' : 'Nothing saved'}
            body={
              tab === 'going'
                ? 'Match with an opportunity and it’ll show up here.'
                : tab === 'liked'
                  ? 'Swipe right, or tap the heart, on anything you’re curious about.'
                  : 'Tap “Save” on any opportunity to come back to it later.'
            }
            action={<Button onClick={() => go('discover')}>Start discovering</Button>}
          />
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {list.map((o) => (
              <MatchRow key={o.id} o={o} tab={tab} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


function MatchRow({ o, tab }: { o: Opportunity; tab: Tab }) {
  const { state, setJoined, unlike, toggleSaved, toast } = useStore()
  const { openOpp } = useDetails()
  const joined = state.joined.includes(o.id)
  const buddy = state.buddy.includes(o.id)
  return (
    <li className="overflow-hidden rounded-xl border border-line">
      <button onClick={() => openOpp(o.id)} className="flex w-full gap-3 p-3 text-left" aria-label={`${o.title}. Open details`}>
        <Img src={o.image} alt="" category={o.category} className="h-24 w-24 shrink-0 rounded-2xl" />
        <span className="min-w-0 flex-1">
          {tab === 'going' && <Tag tone="brand">{daysUntil(o.date)}</Tag>}
          <span className="mt-1 block font-bold leading-tight">{o.title}</span>
          <span className="mt-0.5 block text-xs text-ink-500">{fmtDate(o.startAt, { timeZone: o.timeZone })}</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
            <MapPin size={12} aria-hidden /> {areaLabel(o.area)} ·           </span>
          {buddy && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
              <UserPlus size={12} /> Buddy requested
            </span>
          )}
        </span>
      </button>
      <div className="flex gap-2 border-t border-ink-100 px-3 py-2">
        {joined ? (
          <Button size="sm" variant="secondary" disabled={o.started} onClick={async () => { if (await setJoined(o.id, false)) toast('Match cancelled', 'info') }}>
            Cancel match
          </Button>
        ) : (
          <Button size="sm" disabled={o.endAt <= Date.now()} onClick={async () => { if (await setJoined(o.id, true)) toast('Matched. It’s on your schedule.', 'info') }}>
            <Check size={14} /> Match
          </Button>
        )}
        {tab === 'liked' && (
          <Button size="sm" variant="ghost" onClick={() => unlike(o.id)} aria-label={`Remove ${o.title} from likes`}>
            <Trash2 size={14} /> Remove
          </Button>
        )}
        {tab === 'saved' && (
          <Button size="sm" variant="ghost" onClick={() => toggleSaved(o.id)} aria-label={`Unsave ${o.title}`}>
            <Trash2 size={14} /> Unsave
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openOpp(o.id)}>
          Details
        </Button>
      </div>
    </li>
  )
}
