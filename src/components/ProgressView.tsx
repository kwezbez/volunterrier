import { Check, ShieldCheck } from 'lucide-react'
import type { Progress } from '../types'
import { catOf } from '../data/taxonomy'
import { CategoryIcon } from './CategoryIcon'
import { cx, fmtDate, hrs } from './ui'

const NAMES: Record<number, string> = { 5: 'First steps', 10: 'Regular', 25: 'Committed', 50: 'Community pillar', 100: 'Centurion' }

export function ProgressView({ p, self }: { p: Progress; self?: boolean }) {
  const pct = p.nextMilestone ? ((p.totalHours - p.previousMilestone) / (p.nextMilestone - p.previousMilestone)) * 100 : 100
  const maxMonth = Math.max(1, ...p.months.map((m) => m.hours))
  const cats = Object.entries(p.categories).sort((a, b) => b[1] - a[1])
  const thisMonth = p.months[p.months.length - 1]?.hours ?? 0
  const total = +p.totalHours.toFixed(2)
  return (
    <div>
      {/* headline number */}
      <section aria-label="Total verified hours">
        <p className="text-sm text-ink-500">Verified hours</p>
        <p className="text-6xl font-bold tracking-tight">{total}</p>
        <div className="mt-4 max-w-2xl">
          <div className="h-2 overflow-hidden rounded-full bg-brand-200" role="progressbar" aria-label="Progress to next milestone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="h-full rounded-full bg-moss transition-all duration-500" style={{ width: `${Math.max(1, Math.min(100, pct))}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-500">
            {p.nextMilestone ? (
              <>
                <b className="font-semibold text-brand-800">{+(p.nextMilestone - p.totalHours).toFixed(2)} hrs</b> to {NAMES[p.nextMilestone]} ({p.nextMilestone} hrs)
              </>
            ) : (
              'All milestones reached.'
            )}
          </p>
        </div>
        {/* milestone track */}
        <ol className="mt-6 flex max-w-2xl justify-between" aria-label="Milestones">
          {p.milestones.map((m) => (
            <li key={m.hours} className="flex flex-col items-center text-center">
              <span className={cx('flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold', m.reached ? 'border-moss bg-moss text-white' : 'border-brand-300 text-ink-500')}>
                {m.reached ? <Check size={15} aria-hidden /> : m.hours}
              </span>
              <span className="mt-1 text-xs font-medium">{m.hours} hrs</span>
              <span className="hidden text-xs text-ink-500 sm:block">{NAMES[m.hours]}</span>
              <span className="sr-only">{m.reached ? 'reached' : 'not yet reached'}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* stats row */}
      <dl className="mt-8 grid grid-cols-2 gap-y-4 border-y border-line py-4 sm:grid-cols-4">
        {[
          [total, 'Hours volunteered'],
          [p.eventsAttended, 'Events attended'],
          [+thisMonth.toFixed(2), 'Hours this month'],
          [p.milestones.filter((m) => m.reached).length, 'Milestones'],
        ].map(([n, l]) => (
          <div key={l as string}>
            <dt className="text-sm text-ink-500">{l}</dt>
            <dd className="text-2xl font-semibold">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <section aria-label="Hours by month">
          <h2 className="font-semibold">Last 6 months</h2>
          <div className="mt-4 flex h-36 items-end gap-3" role="img" aria-label={p.months.map((m) => `${m.month}: ${m.hours} hours`).join(', ')}>
            {p.months.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs text-ink-500">{m.hours ? +m.hours.toFixed(1) : ''}</span>
                <div className={cx('w-full rounded-sm', m.hours ? 'bg-moss' : 'bg-brand-200')} style={{ height: `${m.hours ? Math.max(6, (m.hours / maxMonth) * 100) : 3}px` }} />
                <span className="text-xs text-ink-500">{new Date(`${m.month}-15`).toLocaleDateString(undefined, { month: 'short' })}</span>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Hours by cause">
          <h2 className="font-semibold">By category</h2>
          {cats.length === 0 ? (
            <p className="mt-2 text-sm text-ink-500">No verified hours yet{self ? '. Your first event will show up here.' : '.'}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cats.map(([c, h]) => (
                <li key={c}>
                  <div className="flex justify-between text-sm">
                    <span>{catOf(c).label}</span>
                    <span className="text-ink-500">{hrs(h)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-200">
                    <div className="h-full rounded-full bg-moss" style={{ width: `${(h / p.totalHours) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10" aria-label="Activity history">
        <h2 className="font-semibold">Activity</h2>
        {p.history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No completed, verified volunteering yet.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line">
            {p.history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3">
                <CategoryIcon id={h.category} size={18} className="shrink-0 text-moss" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.title}</span>
                  <span className="block truncate text-sm text-ink-500">
                    {h.org} · {fmtDate(h.startAt, { timeZone: h.timeZone }).split(' · ')[0]}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{+h.hours.toFixed(2)} hrs</span>
                  <span className="flex items-center justify-end gap-1 text-xs text-ink-500">
                    <ShieldCheck size={11} aria-hidden /> {h.verifiedVia === 'checkin' ? 'Checked in' : 'Organizer verified'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
