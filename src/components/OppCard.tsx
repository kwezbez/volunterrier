import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Opportunity } from '../types'
import { useDetails } from './Details'
import { AvatarStack, Img, SampleBadge, cx, fmtDate, hrs } from './ui'
import { areaLabel } from '../data/taxonomy'

/** Spotify-style tile used in horizontal shelves and grids */
export function OppTile({ o, note, className }: { o: Opportunity; note?: ReactNode; className?: string }) {
  const { openOpp } = useDetails()
  return (
    <button onClick={() => openOpp(o.id)} className={cx('group w-full rounded-xl p-2 text-left transition-colors hover:bg-surface', className)} aria-label={`${o.title} by ${o.org}. ${fmtDate(o.startAt, { timeZone: o.timeZone })}`}>
      <div className="relative overflow-hidden rounded-lg">
        <Img src={o.image} alt="" category={o.category} className="aspect-[4/3] w-full" />
        {o.isSample && <SampleBadge className="absolute left-2 top-2" />}
        {o.iAmGoing && <span className="absolute right-2 top-2 rounded-md bg-moss px-1.5 py-0.5 text-[11px] font-semibold text-white">Matched</span>}
        {o.friendsGoing.length > 0 && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-brand-800 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-brand-50">
            <AvatarStack people={o.friendsGoing.map((f) => ({ name: f.displayName, avatar: f.avatar }))} size={18} max={3} /> {o.friendsGoing.length} friend{o.friendsGoing.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 font-semibold leading-snug">{o.title}</p>
      <p className="truncate text-sm text-ink-500">{o.org}</p>
      <p className="mt-0.5 truncate text-sm text-ink-500">{fmtDate(o.startAt, { timeZone: o.timeZone })}</p>
      {note && <p className="mt-0.5 truncate text-sm text-moss">{note}</p>}
    </button>
  )
}

/** horizontal list row with all key facts (search results, schedule) */
export function OppRow({ o, active, onHover, right }: { o: Opportunity; active?: boolean; onHover?: (id: string | null) => void; right?: ReactNode }) {
  const { openOpp } = useDetails()
  return (
    <li onMouseEnter={() => onHover?.(o.id)} onMouseLeave={() => onHover?.(null)} className={cx('rounded-lg transition-colors', active ? 'bg-surface' : 'hover:bg-surface')}>
      <button onClick={() => openOpp(o.id)} className="flex w-full gap-4 p-3 text-left" onFocus={() => onHover?.(o.id)}>
        <Img src={o.image} alt="" category={o.category} className="h-20 w-20 shrink-0 rounded-lg sm:h-24 sm:w-24" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {o.isSample && <SampleBadge />}
            {o.iAmGoing && <span className="rounded-md bg-moss px-1.5 py-0.5 text-[11px] font-semibold text-white">Matched</span>}
            <span className="text-sm text-ink-500">{o.org}</span>
          </span>
          <span className="mt-0.5 block font-semibold leading-snug">{o.title}</span>
          <span className="mt-1 line-clamp-2 text-sm text-ink-600">{o.summary}</span>
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-500">
            <span className="flex items-center gap-1"><CalendarDays size={13} aria-hidden /> {fmtDate(o.startAt, { timeZone: o.timeZone })}</span>
            <span className="flex items-center gap-1"><Clock size={13} aria-hidden /> ≈ {hrs(o.durationHours)}</span>
            <span className="flex items-center gap-1"><MapPin size={13} aria-hidden /> {o.area === 'remote' ? 'Online' : `${o.address}${o.city ? `, ${o.city}` : ''}` || areaLabel(o.area)}</span>
            <span className="flex items-center gap-1"><Users size={13} aria-hidden /> {o.goingCount}/{o.maxParticipants} spots</span>
          </span>
        </span>
        {right}
      </button>
    </li>
  )
}

export function Shelf({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10" aria-label={title}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {sub && <p className="text-sm text-ink-500">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ShelfRow({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-5 flex snap-x gap-1 overflow-x-auto px-3 pb-2 sm:-mx-8 sm:px-6 [&>*]:w-[46%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-48">{children}</div>
}
