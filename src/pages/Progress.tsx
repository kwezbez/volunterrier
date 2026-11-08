import { useEffect, useState } from 'react'
import { Globe2, Lock } from 'lucide-react'
import { useStore } from '../lib/store'
import { get } from '../lib/api'
import { ProgressView } from '../components/ProgressView'
import { SectionTitle, cx } from '../components/ui'
import type { Progress } from '../types'

export default function ProgressPage() {
  const { state, updatePrivacy, toast, fail, dataVersion } = useStore()
  const user = state.user!
  const [p, setP] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    get<{ progress: Progress }>('/progress').then(
      (r) => setP(r.progress),
      (e) => setError(e.message),
    )
  }, [dataVersion])
  const vis = user.settings.progressVisibility

  return (
    <div className="px-5 pb-12 pt-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle title="My progress" sub="Only verified hours from completed events count." />
        <div className="rounded-2xl bg-surface p-1.5" role="radiogroup" aria-label="Who can see your progress">
          {(
            [
              ['private', Lock, 'Private', 'Only you'],
              ['public', Globe2, 'Public', 'Other users can view'],
            ] as const
          ).map(([v, I, l, d]) => (
            <button
              key={v}
              role="radio"
              aria-checked={vis === v}
              onClick={() =>
                vis !== v &&
                updatePrivacy({ progressVisibility: v }).then(() => toast(v === 'public' ? 'Your progress is now public' : 'Your progress is now private', 'info'), fail)
              }
              title={d}
              className={cx('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', vis === v ? 'bg-moss text-white' : 'text-brand-700 hover:bg-brand-100')}
            >
              <I size={14} /> {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {error ? <p role="alert">{error}</p> : p ? <ProgressView p={p} self /> : <div className="skeleton h-48 rounded-lg" />}
      </div>

      {p?.awaitingVerification ? (
        <p className="mt-6 text-sm text-ink-600">
          <b>{p.awaitingVerification}</b> completed {p.awaitingVerification === 1 ? 'event is' : 'events are'} awaiting verification from the organizer.
        </p>
      ) : null}

      <section className="mt-10 border-t border-line pt-6 text-sm text-ink-600">
        <h2 className="font-semibold text-brand-800">How hours are verified
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Match with an event and show up.</li>
          <li>Check in with the code your organizer shares at the event, or the organizer verifies your attendance afterwards.</li>
          <li>Hours are credited once the event is completed, based on the event’s actual length (max 12 hours per event).</li>
          <li>You can’t add or edit hours yourself, and nobody can edit yours except the event’s organizer.</li>
        </ul>
        <p className="mt-3">
          {vis === 'private' ? 'Your progress is private — no one else can see your hours or activity.' : 'Your progress is public — logged-in users can see your hours, milestones and completed activities on your profile. Your schedule, location and account details always stay private.'}
        </p>
      </section>
    </div>
  )
}
