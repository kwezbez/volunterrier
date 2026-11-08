import { useEffect, useState } from 'react'
import { Eye, Pencil, Settings as SettingsIcon, Trash2 } from 'lucide-react'
import { get } from '../lib/api'
import type { Progress } from '../types'
import { useStore, go } from '../lib/store'
import { useDetails } from '../components/Details'
import { AccessFields, ActivityFields, BasicsFields, CauseFields, InterestFields, WhenWhereFields, completion, type Draft } from '../components/ProfileFields'
import { Avatar, Button, Img, Modal, Tag, cx, fmtDate } from '../components/ui'
import { accessOf, areaLabel, catOf, SLOTS, SOCIAL_PREFS } from '../data/taxonomy'

const EDIT_TABS = [
  { id: 'basics', label: 'Basics', C: BasicsFields },
  { id: 'interests', label: 'Interests', C: InterestFields },
  { id: 'activities', label: 'Activities & skills', C: ActivityFields },
  { id: 'causes', label: 'Causes', C: CauseFields },
  { id: 'when', label: 'When & where', C: WhenWhereFields },
  { id: 'access', label: 'Access & comfort', C: AccessFields },
] as const

export default function Profile() {
  const { state, updateUser, deleteOpportunity, toast, fail, dataVersion } = useStore()
  const [progress, setProgress] = useState<Progress | null>(null)
  useEffect(() => {
    get<{ progress: Progress }>('/progress').then((r) => setProgress(r.progress), () => {})
  }, [dataVersion])
  const { openOpp } = useDetails()
  const user = state.user!
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<(typeof EDIT_TABS)[number]['id']>('basics')
  const [draft, setDraft] = useState<Draft>(user)

  const pct = completion(user)
  const joined = state.opportunities.filter((o) => o.iAmGoing).sort((a, b) => a.startAt - b.startAt)
  const posted = state.opportunities.filter((o) => o.isMine)
  const groups = state.groups.filter((g) => g.joined)
  const upcomingCount = joined.filter((o) => o.endAt > Date.now()).length


  const openEdit = (t: typeof tab = 'basics') => {
    setDraft(user)
    setTab(t)
    setEditing(true)
  }
  const save = async () => {
    if (draft.name.trim().length < 2) {
      setTab('basics')
      toast('Name is required', 'info')
      return
    }
    if (!draft.interests.length) {
      setTab('interests')
      toast('Pick at least one interest', 'info')
      return
    }
    try {
      await updateUser(draft)
      setEditing(false)
      toast('Profile saved. Recommendations updated.', 'info')
    } catch (e) {
      fail(e)
    }
  }

  const EditC = EDIT_TABS.find((t) => t.id === tab)!.C

  return (
    <div className="px-5 pb-12 pt-6 sm:px-8">
      {/* header */}
      <section className="flex flex-wrap items-start gap-5 border-b border-line pb-6">
        <Avatar name={user.name} avatar={user.avatar} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{user.name}</h1>
          <p className="text-sm text-ink-500">
            {['@' + user.username, user.pronouns, user.school, areaLabel(user.area)].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 max-w-xl text-ink-700">{user.bio || <span className="text-ink-500">No bio yet. Add one so people know you.</span>}</p>
          {pct < 100 && (
            <p className="mt-2 text-sm text-ink-500">
              Profile {pct}% complete.{' '}
              <button onClick={() => openEdit()} className="font-medium text-brand-800 underline underline-offset-2">
                Finish it
              </button>{' '}
              for better recommendations.
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => openEdit()}>
          <Pencil size={14} /> Edit profile
        </Button>
      </section>

      {/* stats */}
      <dl className="grid grid-cols-2 gap-y-4 border-b border-line py-4 sm:grid-cols-4" aria-label="Volunteer stats">
        {[
          [progress ? +progress.totalHours.toFixed(2) : 0, 'Verified hours'],
          [progress?.eventsAttended ?? 0, 'Events attended'],
          [upcomingCount, 'Upcoming matches'],
          [groups.length, 'Groups'],
        ].map(([n, l]) => (
          <div key={l as string}>
            <dt className="text-sm text-ink-500">{l}</dt>
            <dd className="text-2xl font-semibold">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Panel title="Interests & causes" onEdit={() => openEdit('interests')}>
            <div className="flex flex-wrap gap-1.5">
              {user.interests.map((i) => (
                <Tag key={i}>
                  {catOf(i).label}
                </Tag>
              ))}
              {user.causes.map((c) => (
                <Tag key={c} tone="brand">
                  {c}
                </Tag>
              ))}
            </div>
          </Panel>

          <Panel title="Activities & skills" onEdit={() => openEdit('activities')}>
            <div className="flex flex-wrap gap-1.5">
              {user.activities.map((a) => (
                <Tag key={a} tone="violet">
                  {a}
                </Tag>
              ))}
              {user.skills.map((s) => (
                <Tag key={s} tone="blue">
                  {s}
                </Tag>
              ))}
              {!user.activities.length && !user.skills.length && <p className="text-sm text-ink-400">None added yet.</p>}
            </div>
          </Panel>

          <Panel title="Groups joined">
            {groups.length ? (
              <ul className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Tag>{g.name}</Tag>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">
                No groups yet.{' '}
                <button className="font-semibold text-brand-600 underline" onClick={() => go('communities')}>
                  Browse communities
                </button>
              </p>
            )}
          </Panel>

          <Panel title={`Volunteering (${joined.length})`}>
            {joined.length ? (
              <ul className="space-y-2">
                {joined
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((o) => (
                    <li key={o.id}>
                      <button className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-left hover:bg-ink-50" onClick={() => openOpp(o.id)}>
                        <Img src={o.image} alt="" category={o.category} className="h-12 w-12 shrink-0 rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{o.title}</span>
                          <span className="text-xs text-ink-500">{fmtDate(o.startAt, { timeZone: o.timeZone })}</span>
                        </span>
                        <Tag tone={o.myVerified ? 'brand' : o.endAt <= Date.now() ? 'violet' : 'green'}>{o.myVerified ? 'Verified' : o.endAt <= Date.now() ? 'Awaiting verification' : 'Upcoming'}</Tag>
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">Join something from Discover and it’ll show up here.</p>
            )}
          </Panel>

          {posted.length > 0 && (
            <Panel title="Opportunities you posted">
              <ul className="space-y-2">
                {posted.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    <button className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-left hover:bg-ink-50" onClick={() => openOpp(o.id)}>
                      <Img src={o.image} alt="" category={o.category} className="h-12 w-12 shrink-0 rounded-xl" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{o.title}</span>
                        <span className="text-xs text-ink-500">{fmtDate(o.startAt, { timeZone: o.timeZone })}</span>
                      </span>
                    </button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${o.title}`} onClick={() => { if (confirm(`Delete “${o.title}”? Volunteers who matched will lose it.`)) deleteOpportunity(o.id).then(() => toast('Post deleted', 'info'), fail) }}>
                      <Trash2 size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div>
          <Panel title="Access & comfort" onEdit={() => openEdit('access')}>
            <div className="flex flex-wrap gap-1.5">
              {user.access.map((a) => (
                <Tag key={a} tone="green">
                  {accessOf(a).short}
                </Tag>
              ))}
              {user.social.map((s) => (
                <Tag key={s} tone="violet">
                  {SOCIAL_PREFS.find((x) => x.id === s)?.label}
                </Tag>
              ))}
              {!user.access.length && !user.social.length && <p className="text-sm text-ink-400">No preferences set.</p>}
            </div>
            <p className="mt-3 text-sm text-ink-500">
              Free: {user.availability.map((a) => SLOTS.find((s) => s.id === a)?.label).join(', ') || '—'} · within {user.maxDistance} mi
            </p>
          </Panel>

          <Panel title="Privacy & sharing" icon={<Eye size={18} className="text-moss" />}>
            <p className="text-sm text-ink-600">
              Progress is <b>{user.settings.progressVisibility}</b>. Friends {user.settings.shareAttendanceWithFriends ? 'can' : 'can’t'} see which events you attend.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => go('settings')}>
                <SettingsIcon size={14} /> Settings
              </Button>
              <Button size="sm" variant="ghost" onClick={() => go('u', user.username)}>
                View public profile
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      {/* edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} label="Edit profile" wide>
        <div className="p-6">
          <h2 className="text-2xl font-bold">Edit profile</h2>
          <div role="tablist" aria-label="Profile sections" className="no-scrollbar -mx-6 mt-4 flex gap-1.5 overflow-x-auto px-6 pb-1">
            {EDIT_TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cx('whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold', tab === t.id ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600')}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-5" role="tabpanel">
            <EditC draft={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} />
          </div>
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex justify-end gap-2 border-t border-ink-100 bg-surface px-6 py-4">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </div>
      </Modal>


    </div>
  )
}


function Panel({ title, children, onEdit, icon }: { title: string; children: React.ReactNode; onEdit?: () => void; icon?: React.ReactNode }) {
  return (
    <section className="border-b border-line py-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </h2>
        {onEdit && (
          <button onClick={onEdit} className="rounded-full p-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-800" aria-label={`Edit ${title}`}>
            <Pencil size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
