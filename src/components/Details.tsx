import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bookmark, BookmarkCheck, CalendarDays, Check, CheckCircle2, Clock, Copy, Heart, KeyRound, Link2, MapPin, Share2, ShieldCheck, TrainFront, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { scoreOpportunity } from '../lib/recommend'
import { post } from '../lib/api'
import { ACCESS, areaLabel, catOf, socialOf } from '../data/taxonomy'
import { Avatar, AvatarStack, Button, Img, Modal, SampleBadge, Tag, cx, fmtDay, fmtRange, hrs } from './ui'
import { inputCls } from './ProfileFields'
import type { Opportunity } from '../types'

interface DetailsApi {
  openOpp: (id: string) => void
  openPerson: (username: string) => void
}
const Ctx = createContext<DetailsApi>({ openOpp: () => {}, openPerson: () => {} })
export const useDetails = () => useContext(Ctx)

export function DetailsProvider({ children }: { children: ReactNode }) {
  const [oppId, setOppId] = useState<string | null>(null)
  const closeOpp = useCallback(() => setOppId(null), [])
  useEffect(() => {
    const close = () => setOppId(null)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])
  const api = useMemo(
    () => ({
      openOpp: setOppId,
      openPerson: (username: string) => {
        setOppId(null)
        go('u', username)
      },
    }),
    [],
  )
  return (
    <Ctx.Provider value={api}>
      {children}
      <OpportunityModal id={oppId} onClose={closeOpp} />
    </Ctx.Provider>
  )
}

function OpportunityModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, refreshOpp } = useStore()
  const opp = state.opportunities.find((o) => o.id === id)
  const [loading, setLoading] = useState(false)

  // always pull fresh detail (friends going, organizer tools) when opened
  useEffect(() => {
    if (!id) return
    setLoading(true)
    refreshOpp(id).finally(() => setLoading(false))
  }, [id, refreshOpp])

  return (
    <Modal open={!!id} onClose={onClose} label={opp ? `${opp.title} details` : 'Opportunity details'} wide>
      {opp && state.user ? <Body opp={opp} onClose={onClose} /> : <div className="p-10 text-center text-ink-500">{loading ? 'Loading…' : 'This opportunity is no longer available.'}</div>}
    </Modal>
  )
}

function Body({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const { state, setJoined, toggleSaved, toggleBuddy, like, toast, deleteOpportunity, fail } = useStore()
  const { openPerson } = useDetails()
  const user = state.user!
  const rec = scoreOpportunity(user, opp)
  const saved = state.saved.includes(opp.id)
  const liked = state.liked.includes(opp.id)
  const cat = catOf(opp.category)
  const full = opp.goingCount >= opp.maxParticipants && !opp.iAmGoing
  const ended = opp.endAt <= Date.now()
  const [busy, setBusy] = useState(false)

  const join = async () => {
    setBusy(true)
    const ok = await setJoined(opp.id, !opp.iAmGoing)
    setBusy(false)
    if (ok) toast(opp.iAmGoing ? 'Match cancelled' : 'Matched. It’s on your schedule.', 'info')
  }

  return (
    <article>
      <div className="relative">
        <Img src={opp.image} alt={opp.title} category={opp.category} className="h-56 w-full sm:h-72" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-brand-50">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {opp.isSample && <SampleBadge />}
            <Tag tone="white">
              {cat.label}
            </Tag>
            <Tag tone="white">{rec.percent}% fit</Tag>
          </div>
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{opp.title}</h2>
          <p className="mt-1 text-brand-50/85">by {opp.org}</p>
        </div>
      </div>

      {opp.isSample && (
        <p className="border-b border-line px-6 py-2.5 text-sm text-ink-600">
          <b>Sample listing.</b> This is an example used to demonstrate VolunTerrier — not a real event. Real opportunities are posted by community organizers.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 p-5 sm:grid-cols-[minmax(0,1fr)_280px] sm:p-6">
        <div className="min-w-0 space-y-6">
          {rec.reasons.length > 0 && (
            <section aria-label="Why this is recommended">
              <p className="text-sm font-semibold text-moss">{rec.headline}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {rec.reasons.map((r) => (
                  <li key={r}>
                    <Tag>{r}</Tag>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-bold">About</h3>
            <p className="mt-1.5 whitespace-pre-line leading-relaxed text-ink-600">{opp.description}</p>
          </section>

          <section>
            <h3 className="font-bold">What to expect</h3>
            <ol className="mt-2 space-y-2">
              {opp.expect.map((s, i) => (
                <li key={i} className="flex gap-3 text-ink-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-bold text-brand-50">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="font-bold">The social vibe</h3>
            <p className="mt-1 text-ink-600">{opp.vibe}</p>
            {opp.social.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {opp.social.map((s) => (
                  <li key={s}>
                    <Tag tone="violet">
                      {socialOf(s).label}
                    </Tag>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="font-bold">Accessibility</h3>
            <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {ACCESS.map((a) => {
                const yes = opp.access.includes(a.id) || (a.id === 'remote' && opp.area === 'remote')
                const need = user.access.includes(a.id)
                return (
                  <li key={a.id} className={cx('flex items-start gap-2.5 rounded-xl border p-3 text-sm', yes ? 'border-line' : 'border-line text-ink-400')}>
                    <span aria-hidden className="text-lg leading-none">
                                          </span>
                    <span>
                      <span className={cx('font-semibold', yes ? 'text-brand-800' : 'line-through decoration-ink-300')}>{a.label}</span>
                      <span className="sr-only">{yes ? ': available' : ': not available'}</span>
                      {need && <span className="ml-1 text-xs font-bold text-brand-800">{yes ? '· meets your need' : '· doesn’t meet your need'}</span>}
                      {yes && <span className="block text-xs text-ink-500">{a.desc}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {opp.skills.length > 0 && (
            <section>
              <h3 className="font-bold">Helpful skills</h3>
              <p className="text-sm text-ink-500">Nice to have — never required to show up.</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {opp.skills.map((s) => (
                  <li key={s}>
                    <Tag tone={user.skills.includes(s) ? 'brand' : 'ink'}>
                      {user.skills.includes(s) && <Check size={12} />} {s}
                    </Tag>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-bold">Who’s going</h3>
            <p className="text-sm text-ink-500">
              {opp.goingCount} matched · {opp.maxParticipants} spots
            </p>
            {opp.friendsGoing.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {opp.friendsGoing.map((p) => (
                  <li key={p.username}>
                    <button onClick={() => openPerson(p.username)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-brand-100">
                      <Avatar name={p.displayName} avatar={p.avatar} size={38} />
                      <span>
                        <span className="block font-semibold">{p.displayName}</span>
                        <span className="text-xs text-ink-500">Friend · matched</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">None of your friends have matched yet. Invite some below.</p>
            )}
            <p className="mt-2 text-xs text-ink-400">For privacy, only friends who share their attendance are shown by name.</p>
          </section>

          {opp.isMine && opp.manage && <OrganizerPanel opp={opp} />}
        </div>

        {/* sidebar */}
        <aside className="space-y-4 sm:sticky sm:top-4 sm:self-start">
          <div className="hc-border space-y-3 rounded-xl border border-line p-4 text-sm">
            <p className="flex gap-2.5">
              <CalendarDays size={18} className="shrink-0 text-moss" aria-hidden />
              <span>
                <span className="block font-semibold">{fmtDay(opp.startAt, opp.timeZone)}</span>
                <span className="text-ink-500">{fmtRange(opp.startAt, opp.endAt, opp.timeZone)}</span>
              </span>
            </p>
            <p className="flex gap-2.5">
              <MapPin size={18} className="shrink-0 text-moss" aria-hidden />
              <span>
                <span className="block font-semibold">{opp.area === 'remote' ? 'Online' : opp.address}</span>
                <span className="text-ink-500">{opp.area === 'remote' ? 'Join from anywhere' : opp.city || areaLabel(opp.area)}</span>
                {opp.area !== 'remote' && rec.distance > 0 && <span className="block text-xs text-ink-400">≈ {rec.distance} mi from {user.home ? 'your saved location' : areaLabel(user.area)}</span>}
              </span>
            </p>
            {opp.transit && (
              <p className="flex gap-2.5">
                <TrainFront size={18} className="shrink-0 text-moss" aria-hidden />
                <span className="text-ink-600">{opp.transit}</span>
              </p>
            )}
            <p className="flex gap-2.5">
              <Clock size={18} className="shrink-0 text-moss" aria-hidden />
              <span className="text-ink-600">≈ {hrs(opp.durationHours)} of volunteering</span>
            </p>
            <div>
              <div className="flex justify-between text-xs font-semibold text-ink-500">
                <span className="flex items-center gap-1">
                  <Users size={14} aria-hidden /> {opp.goingCount} going
                </span>
                <span>{Math.max(0, opp.maxParticipants - opp.goingCount)} spots left</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-200" role="progressbar" aria-valuemin={0} aria-valuemax={opp.maxParticipants} aria-valuenow={opp.goingCount} aria-label="Spots filled">
                <div className="h-full rounded-full bg-moss" style={{ width: `${Math.min(100, (opp.goingCount / opp.maxParticipants) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {opp.isMine ? (
              <p className="rounded-xl border border-line p-3 text-center text-sm font-medium">You’re organizing this. It’s on your schedule.</p>
            ) : opp.myVerified ? (
              <p className="flex items-center justify-center gap-2 rounded-2xl bg-moss p-3 text-sm font-bold text-white">
                <ShieldCheck size={18} /> Attendance verified
              </p>
            ) : (
              <Button className="w-full" size="lg" variant={opp.iAmGoing ? 'secondary' : 'primary'} disabled={busy || (!opp.iAmGoing && (full || ended))} data-autofocus onClick={join}>
                {opp.iAmGoing ? (
                  <>
                    <X size={18} /> Cancel match
                  </>
                ) : ended ? (
                  'This event has ended'
                ) : full ? (
                  'Event is full'
                ) : (
                  <>
                    <Check size={18} /> {busy ? 'Checking your schedule…' : 'Match'}
                  </>
                )}
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                aria-pressed={liked}
                onClick={() => {
                  if (!liked) {
                    like(opp.id)
                    toast('Added to your matches', 'love')
                  }
                }}
              >
                <Heart size={16} className={liked ? 'fill-moss text-moss' : ''} /> {liked ? 'Liked' : 'Like'}
              </Button>
              <Button
                variant="secondary"
                aria-pressed={saved}
                onClick={() => {
                  toggleSaved(opp.id)
                  toast(saved ? 'Removed from saved' : 'Saved for later', 'info')
                }}
              >
                {saved ? <BookmarkCheck size={16} className="text-moss" /> : <Bookmark size={16} />} {saved ? 'Saved' : 'Save'}
              </Button>
            </div>
          </div>

          {opp.iAmGoing && !opp.myVerified && <CheckIn opp={opp} />}

          <InviteFriends opp={opp} />

          {/* social accessibility: buddy */}
          {!opp.isMine && (
            <div className="rounded-xl border border-line p-4">
              <p className="font-semibold">Nervous about going solo?</p>
              <p className="mt-1 text-sm text-ink-600">
                {opp.iAmGoing ? 'Ask for a buddy and the organizer will pair you with another solo volunteer at check-in.' : 'Match first, then ask for a buddy and we’ll pair you with another solo volunteer.'}
              </p>
              {(opp.buddySeekers ?? 0) > 0 && <p className="mt-2 text-sm font-medium text-moss">{opp.buddySeekers} other {opp.buddySeekers === 1 ? 'person is' : 'people are'} looking for a buddy too.</p>}
              <button
                disabled={!opp.iAmGoing}
                onClick={() => {
                  toggleBuddy(opp.id, !opp.myBuddy)
                  if (!opp.myBuddy) toast('Buddy request noted. The organizer will pair you at check-in.', 'info')
                }}
                aria-pressed={opp.myBuddy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-400/60 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
              >
                <UserPlus size={16} /> {opp.myBuddy ? 'Cancel buddy request' : 'Find me a buddy'}
              </button>
            </div>
          )}

          <div className="hc-border rounded-2xl border border-brand-200 p-4 text-sm">
            <p className="text-sm font-medium text-ink-500">Organizer</p>
            <p className="mt-1 font-semibold">{opp.isMine ? 'You' : opp.organizerName ?? opp.org}</p>
            <p className="text-ink-500">{opp.org}</p>
            <p className="mt-2 text-xs text-ink-500">First time? Organizers greet newcomers at check-in.</p>
            {opp.isMine && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 -ml-2"
                onClick={async () => {
                  if (!confirm('Delete this opportunity? Volunteers who matched will lose it from their schedule.')) return
                  try {
                    await deleteOpportunity(opp.id)
                    toast('Opportunity deleted', 'info')
                    onClose()
                  } catch (e) {
                    fail(e)
                  }
                }}
              >
                <Trash2 size={14} /> Delete listing
              </Button>
            )}
          </div>
        </aside>
      </div>
    </article>
  )
}

function InviteFriends({ opp }: { opp: Opportunity }) {
  const { toast, fail } = useStore()
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true)
    try {
      const r = await post<{ url: string }>('/invites', { opportunityId: opp.id })
      // server returns an absolute URL in production; fall back to this origin in dev
      setLink(r.url.startsWith('http') ? r.url : `${window.location.origin}${r.url}`)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied')
    } catch {
      toast('Couldn’t copy automatically — select the link and copy it.', 'info')
    }
  }
  const share = async () => {
    if (!link) return
    if (navigator.share) await navigator.share({ title: `Volunteer with me: ${opp.title}`, text: `Join me at “${opp.title}” on VolunTerrier!`, url: link }).catch(() => {})
    else copy()
  }
  return (
    <div className="hc-border rounded-xl border border-line p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Link2 size={16} className="text-moss" /> Invite friends
      </p>
      <p className="mt-1 text-sm text-ink-500">Share a private link. When friends accept, you’re connected and can see each other at events.</p>
      {link ? (
        <div className="mt-3 space-y-2">
          <label className="sr-only" htmlFor={`inv-${opp.id}`}>
            Invitation link
          </label>
          <input id={`inv-${opp.id}`} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={cx(inputCls, 'py-2 text-xs')} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={copy}>
              <Copy size={14} /> Copy link
            </Button>
            <Button size="sm" variant="secondary" onClick={share}>
              <Share2 size={14} /> Share
            </Button>
          </div>
          <p className="text-xs text-ink-400">Expires in 14 days. Track who accepted on the Friends page.</p>
        </div>
      ) : (
        <Button size="sm" className="mt-3 w-full" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create invite link'}
        </Button>
      )}
    </div>
  )
}

function CheckIn({ opp }: { opp: Opportunity }) {
  const { refreshOpp, toast, fail } = useStore()
  const [code, setCode] = useState('')
  const open = Date.now() >= opp.startAt - 30 * 60_000 && Date.now() <= opp.endAt + 24 * 3_600_000
  if (!open) return null
  return (
    <form
      className="rounded-xl border border-line p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await post(`/opportunities/${opp.id}/checkin`, { code })
          toast('Checked in. Your hours count once the event is completed.')
          refreshOpp(opp.id)
        } catch (err) {
          fail(err)
        }
      }}
    >
      <p className="flex items-center gap-2 font-bold">
        <KeyRound size={16} className="text-moss" /> Check in
      </p>
      <p className="mt-1 text-sm text-ink-600">Enter the code your organizer shares at the event to verify your hours.</p>
      <div className="mt-2 flex gap-2">
        <label htmlFor={`code-${opp.id}`} className="sr-only">
          Check-in code
        </label>
        <input id={`code-${opp.id}`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ABC123" className={cx(inputCls, 'py-2 font-mono tracking-widest')} autoComplete="off" />
        <Button size="sm" type="submit" disabled={code.length < 6}>
          Verify
        </Button>
      </div>
    </form>
  )
}

function OrganizerPanel({ opp }: { opp: Opportunity }) {
  const { refreshOpp, toast, fail } = useStore()
  const m = opp.manage!
  const started = opp.startAt <= Date.now()
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast(msg)
      await refreshOpp(opp.id)
    } catch (e) {
      fail(e)
    }
  }
  return (
    <section className="rounded-xl border border-moss p-4" aria-label="Organizer tools">
      <h3 className="flex items-center gap-2 font-bold">
        <ShieldCheck size={18} className="text-moss" /> Organizer tools
      </h3>
      <p className="mt-1 text-sm text-ink-500">Volunteer hours only count after you verify attendance. Volunteers can also check in with this code during the event.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-brand-800 px-4 py-2 font-mono text-xl font-bold tracking-[0.3em] text-sage" aria-label={`Check-in code ${m.checkinCode.split('').join(' ')}`}>
          {m.checkinCode}
        </span>
        {opp.completed ? (
          <Tag tone="brand">
            <CheckCircle2 size={12} /> Completed
          </Tag>
        ) : (
          <Button size="sm" variant="secondary" disabled={!started} onClick={() => act(() => post(`/opportunities/${opp.id}/complete`), 'Event marked completed')}>
            {started ? 'Mark event completed' : 'Can complete once started'}
          </Button>
        )}
      </div>
      <h4 className="mt-4 text-sm font-bold">Attendees ({m.attendees.length})</h4>
      {m.attendees.length === 0 ? (
        <p className="text-sm text-ink-500">No matches yet. Share an invite link to get the word out.</p>
      ) : (
        <ul className="mt-2 divide-y divide-brand-200">
          {m.attendees.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <Avatar name={a.displayName} avatar={a.avatar} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{a.displayName}</span>
                <span className="text-xs text-ink-500">
                  {a.verified ? `Verified${a.verifiedVia === 'checkin' ? ' via check-in' : ''}` : 'Not verified'}
                  {a.buddy ? ' · wants a buddy' : ''}
                </span>
              </span>
              <Button
                size="sm"
                variant={a.verified ? 'ghost' : 'primary'}
                disabled={!opp.completed}
                title={opp.completed ? undefined : 'Mark the event completed first'}
                onClick={() => act(() => post(`/opportunities/${opp.id}/attendees/${a.id}/verify`, { verified: !a.verified }), a.verified ? 'Verification removed' : `${a.displayName}’s hours verified`)}
              >
                {a.verified ? 'Undo' : 'Verify'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {m.attendees.some((a) => a.buddy) && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-500">
          <AvatarStack people={m.attendees.filter((a) => a.buddy).map((a) => ({ name: a.displayName, avatar: a.avatar }))} size={20} /> Pair these solo volunteers at check-in.
        </p>
      )}
    </section>
  )
}
