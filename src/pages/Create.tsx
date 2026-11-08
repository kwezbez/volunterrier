import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, ImagePlus, Link2, Sparkles, Upload } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { useDetails } from '../components/Details'
import { ChipGroup, Label, inputCls } from '../components/ProfileFields'
import { Button, Chip, Img, SectionTitle, Tag, cx, fmtDate } from '../components/ui'
import { ACCESS, ACTIVITIES, AREAS, CATEGORIES, SKILLS, SOCIAL, accessOf, catOf } from '../data/taxonomy'
import type { AccessId, AreaId, CategoryId, SocialId } from '../types'
import { ApiError } from '../lib/api'

const PRESETS: Record<CategoryId, string> = {
  sports: '1546519638-68e109498ffc',
  education: '1503676260728-1c00da094a0b',
  environment: '1542601906990-b4d3fb778b09',
  animals: '1548199973-03cce0bbc87b',
  community: '1559027615-cd4628902d4a',
  health: '1576091160550-2173dba999ef',
  arts: '1513364776144-60967b0f800f',
  food: '1488521787991-ed7bbaae773c',
  'mental-health': '1529156069898-49953e39b3ac',
  stem: '1531482615713-2afd69097998',
}
const presetUrl = (c: CategoryId) => `https://images.unsplash.com/photo-${PRESETS[c]}?auto=format&fit=crop&w=1200&q=70`

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const ZONES: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [LOCAL_TZ]

function tomorrow() {
  const d = new Date(Date.now() + 2 * 86400000)
  return d.toISOString().slice(0, 10)
}

interface Form {
  title: string
  description: string
  category: CategoryId | ''
  org: string
  area: AreaId
  address: string
  city: string
  date: string
  time: string
  endTime: string
  timeZone: string
  max: number
  skills: string[]
  activities: string[]
  access: AccessId[]
  social: SocialId[]
  image: string
  imageMode: 'preset' | 'url' | 'upload'
  vibe: string
}

const blank = (): Form => ({
  title: '',
  description: '',
  category: '',
  org: '',
  area: 'bu',
  address: '',
  city: 'Boston, MA',
  date: tomorrow(),
  time: '10:00',
  endTime: '12:00',
  timeZone: LOCAL_TZ,
  max: 12,
  skills: [],
  activities: [],
  access: [],
  social: ['beginner', 'solo'],
  image: '',
  imageMode: 'preset',
  vibe: '',
})

export default function Create() {
  const { state, createOpportunity, toast, fail } = useStore()
  const { openOpp } = useDetails()
  const user = state.user!
  const [f, setF] = useState<Form>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [done, setDone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (p: Partial<Form>) => {
    setF((x) => ({ ...x, ...p }))
    setErrors((e) => {
      const n = { ...e }
      for (const k of Object.keys(p)) delete n[k as keyof Form]
      return n
    })
  }

  const image = f.imageMode === 'preset' ? (f.category ? presetUrl(f.category) : '') : f.image
  // preview only (approximate in the viewer's zone) — the server converts precisely using the chosen time zone
  const isoDate = useMemo(() => {
    const d = new Date(`${f.date}T${f.time || '10:00'}`)
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  }, [f.date, f.time])
  const crossesMidnight = f.endTime <= f.time
  const durationH = (() => {
    const [a, b] = f.time.split(':').map(Number)
    const [c, d] = f.endTime.split(':').map(Number)
    let m = c! * 60 + d! - (a! * 60 + b!)
    if (m <= 0) m += 1440
    return m / 60
  })()

  const validate = () => {
    const e: typeof errors = {}
    if (f.title.trim().length < 5) e.title = 'Give it a title (at least 5 characters).'
    if (f.description.trim().length < 20) e.description = 'Describe it in at least 20 characters so people know what to expect.'
    if (!f.category) e.category = 'Choose a category.'
    if (!f.org.trim()) e.org = 'Add an organization or group name (your name is fine!).'
    if (f.area !== 'remote' && !f.address.trim()) e.address = 'Add an address or meeting point.'
    if (!f.date) e.date = 'Pick a date.'
    else if (f.timeZone === LOCAL_TZ && new Date(isoDate).getTime() < Date.now() - 5 * 60_000) e.date = 'Start time must be in the future.'
    if (!f.time || !f.endTime) e.endTime = 'Add start and end times.'
    if (!f.max || f.max < 1 || f.max > 500) e.max = 'Between 1 and 500 people.'
    if (f.imageMode === 'url' && f.image && !/^https?:\/\//.test(f.image)) e.image = 'Image URL should start with http(s)://'
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0]
      document.getElementById(`f-${first}`)?.focus()
      toast('Please fix the highlighted fields', 'info')
      return
    }
    setSubmitting(true)
    try {
      const res = await createOpportunity({
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category,
        org: f.org.trim(),
        area: f.area,
        address: f.address.trim(),
        city: f.city.trim(),
        date: f.date,
        startTime: f.time,
        endTime: f.endTime,
        timeZone: f.timeZone,
        maxParticipants: f.max,
        skills: f.skills,
        activities: f.activities,
        access: f.access,
        social: f.social,
        vibe: f.vibe.trim(),
        image,
      })
      setDone(res.opportunity.id)
      toast(res.geocoded || f.area === 'remote' ? 'Published! It’s live for volunteers' : 'Published! (We couldn’t map the address, so it won’t appear in distance search.)', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field === 'startTime' ? 'endTime' : err.field]: err.message } as typeof errors)
      fail(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (done)
    return (
      <div className="mx-auto max-w-lg px-4 pt-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 animate-pop">
          <CheckCircle2 size={44} className="text-brand-600" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">You just made it easier for someone to show up.</h1>
        <p className="mt-2 text-ink-500">“{f.title}” is published. It’s on your schedule as an event you’re organizing, and volunteers can find it in Search and Discover. Open it to get your check-in code and invite friends.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => go('discover')}>
            See it in Discover
          </Button>
          <Button size="lg" variant="secondary" onClick={() => openOpp(done)}>
            View details
          </Button>
          <Button size="lg" variant="ghost" onClick={() => { setF(blank()); setDone(null) }}>
            Post another
          </Button>
        </div>
      </div>
    )

  const err = (k: keyof Form) =>
    errors[k] ? (
      <p id={`e-${k}`} role="alert" className="mt-1.5 text-sm font-semibold text-brand-700">
        {errors[k]}
      </p>
    ) : null
  const aria = (k: keyof Form) => ({ id: `f-${k}`, 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `e-${k}` : undefined })
  const bad = (k: keyof Form) => (errors[k] ? '!border-brand-500 !ring-brand-100 ring-4' : '')

  return (
    <div className="px-4 pb-10 pt-6 sm:px-8 sm:pt-4">
      <SectionTitle eyebrow="Create" title="Post an opportunity" sub="Anyone can organize. A park cleanup, a study group for kids, a coat drive — if it helps, it belongs here. As the organizer, you’ll verify volunteers’ hours." />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} noValidate className="space-y-6">
          <Card title="The basics">
            <div>
              <Label htmlFor="f-title">Title *</Label>
              <input {...aria('title')} className={cx(inputCls, bad('title'))} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Saturday Pickup Soccer with Refugee Youth" maxLength={80} />
              {err('title')}
            </div>
            <div>
              <Label htmlFor="f-description">Description *</Label>
              <textarea {...aria('description')} rows={4} className={cx(inputCls, bad('description'))} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What will volunteers do? Who does it help? What should a first-timer know?" />
              {err('description')}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Category *</legend>
              <div className="flex flex-wrap gap-2" id="f-category" tabIndex={-1} aria-describedby={errors.category ? 'e-category' : undefined}>
                {CATEGORIES.map((c) => (
                  <Chip key={c.id} selected={f.category === c.id} onClick={() => set({ category: c.id })}>
                    {c.label}
                  </Chip>
                ))}
              </div>
              {err('category')}
            </fieldset>
            <div>
              <Label htmlFor="f-org">Organization or group *</Label>
              <input {...aria('org')} className={cx(inputCls, bad('org'))} value={f.org} onChange={(e) => set({ org: e.target.value })} placeholder={`e.g. ${user.name.split(' ')[0]}’s Neighborhood Crew`} list="org-options" />
              <datalist id="org-options">
                {state.groups.map((g) => (
                  <option key={g.id} value={g.name} />
                ))}
              </datalist>
              {err('org')}
            </div>
          </Card>

          <Card title="When & where" sub="Times are in the event’s time zone. Volunteers can’t double-book overlapping events.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="f-date">Date *</Label>
                <input {...aria('date')} type="date" className={cx(inputCls, bad('date'))} value={f.date} onChange={(e) => set({ date: e.target.value })} />
                {err('date')}
              </div>
              <div>
                <Label htmlFor="f-time">Start time *</Label>
                <input id="f-time" type="time" className={inputCls} value={f.time} onChange={(e) => set({ time: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="f-endTime">End time *</Label>
                <input {...aria('endTime')} type="time" className={cx(inputCls, bad('endTime'))} value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                {err('endTime')}
              </div>
            </div>
            <p className="-mt-2 text-sm text-ink-500">
              ≈ {+durationH.toFixed(2)} hours{crossesMidnight ? ' · ends the next day (crosses midnight)' : ''} — volunteers are credited this many hours once verified.
            </p>
            <div>
              <Label htmlFor="f-tz">Time zone</Label>
              <select id="f-tz" className={inputCls} value={f.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                    {z === LOCAL_TZ ? ' (your time zone)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Neighborhood *</legend>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <Chip key={a.id} selected={f.area === a.id} onClick={() => set({ area: a.id })}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            {f.area !== 'remote' && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <Label htmlFor="f-address">Address / meeting point *</Label>
                <input {...aria('address')} className={cx(inputCls, bad('address'))} value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="e.g. 775 Commonwealth Ave" />
                {err('address')}
              </div>
              <div>
                <Label htmlFor="f-city">City / town</Label>
                <input id="f-city" className={inputCls} value={f.city} onChange={(e) => set({ city: e.target.value })} placeholder="Boston, MA" maxLength={80} />
                <p className="mt-1 text-xs text-ink-500">Used to place the event on the map.</p>
              </div>
              </div>
            )}
            <div>
              <Label htmlFor="f-max">Maximum participants *</Label>
              <input {...aria('max')} type="number" min={1} max={500} className={cx(inputCls, 'max-w-[160px]', bad('max'))} value={f.max} onChange={(e) => set({ max: Number(e.target.value) })} />
              {err('max')}
            </div>
          </Card>

          <Card title="Who’s it for?">
            <ChipGroup label="Activities involved" options={ACTIVITIES} value={f.activities} onChange={(activities) => set({ activities })} />
            <ChipGroup label="Helpful skills (never required)" options={SKILLS} value={f.skills} onChange={(skills) => set({ skills })} />
          </Card>

          <Card title="Accessibility & comfort" sub="Opportunities with clear accessibility info get shown to more people who need it.">
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Accommodations offered</legend>
              <div className="flex flex-wrap gap-2">
                {ACCESS.map((a) => (
                  <Chip key={a.id} selected={f.access.includes(a.id)} onClick={() => set({ access: f.access.includes(a.id) ? f.access.filter((x) => x !== a.id) : [...f.access, a.id] })}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Social environment</legend>
              <div className="flex flex-wrap gap-2">
                {SOCIAL.map((s) => (
                  <Chip key={s.id} selected={f.social.includes(s.id)} onClick={() => set({ social: f.social.includes(s.id) ? f.social.filter((x) => x !== s.id) : [...f.social, s.id] })}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor="f-vibe" hint="(optional)">Describe the vibe for first-timers</Label>
              <input id="f-vibe" className={inputCls} value={f.vibe} onChange={(e) => set({ vibe: e.target.value })} placeholder="e.g. Small group, lots of folks come alone, I’ll greet you at the gate." />
            </div>
          </Card>

          <Card title="Photo">
            <div className="inline-flex rounded-full bg-ink-100 p-1" role="group" aria-label="Image source">
              {[
                { id: 'preset', l: 'Suggested', I: Sparkles },
                { id: 'url', l: 'Image URL', I: Link2 },
                { id: 'upload', l: 'Upload', I: Upload },
              ].map((m) => (
                <button key={m.id} type="button" aria-pressed={f.imageMode === m.id} onClick={() => set({ imageMode: m.id as Form['imageMode'], image: m.id === 'preset' ? '' : f.image })} className={cx('flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold', f.imageMode === m.id ? 'bg-moss text-white' : 'text-ink-500')}>
                  <m.I size={14} /> {m.l}
                </button>
              ))}
            </div>
            {f.imageMode === 'preset' && <p className="text-sm text-ink-500">{f.category ? 'We picked a photo matching your category.' : 'Choose a category and we’ll pick a matching photo.'}</p>}
            {f.imageMode === 'url' && (
              <div>
                <Label htmlFor="f-image">Image URL</Label>
                <input {...aria('image')} className={cx(inputCls, bad('image'))} value={f.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://…" />
                {err('image')}
              </div>
            )}
            {f.imageMode === 'upload' && (
              <div>
                <button type="button" onClick={() => fileRef.current?.click()} className="hc-border flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 p-6 text-ink-500 hover:border-brand-300 hover:bg-brand-50/40">
                  <ImagePlus /> <span className="text-sm font-semibold">{f.image ? 'Replace photo' : 'Choose a photo'}</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload opportunity photo"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const r = new FileReader()
                    r.onload = () => {
                      const img = new Image()
                      img.onload = () => {
                        const w = Math.min(1000, img.width)
                        const c = document.createElement('canvas')
                        c.width = w
                        c.height = (img.height / img.width) * w
                        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
                        set({ image: c.toDataURL('image/jpeg', 0.75) })
                      }
                      img.src = r.result as string
                    }
                    r.readAsDataURL(file)
                  }}
                />
              </div>
            )}
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Publishing…' : 'Publish opportunity'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setF(blank()); setErrors({}) }}>
              Clear form
            </Button>
          </div>
        </form>

        {/* live preview */}
        <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="Live card preview">
          <p className="mb-2 text-sm font-medium text-ink-500">Live preview</p>
          <div className="overflow-hidden rounded-2xl bg-surface">
            <div className="relative h-52">
              <Img src={image} alt="Preview" category={(f.category || 'community') as CategoryId} className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 to-transparent" />
              {f.category && (
                <span className="absolute left-4 top-4">
                  <Tag tone="white">
                    {catOf(f.category).label}
                  </Tag>
                </span>
              )}
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <p className="text-xl font-bold leading-tight">{f.title || 'Your opportunity title'}</p>
                <p className="text-sm text-white/80">{f.org || 'Your organization'}</p>
              </div>
            </div>
            <div className="space-y-2 p-4">
              <p className="line-clamp-3 text-sm text-ink-600">{f.description || 'Your description will appear here.'}</p>
              <p className="text-xs font-semibold text-ink-500">
                {fmtDate(isoDate)} · ≈{+durationH.toFixed(2)} hrs · {f.area === 'remote' ? 'Online' : f.city || AREAS.find((a) => a.id === f.area)?.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {f.access.map((a) => (
                  <Tag key={a} tone="green">
                    {accessOf(a).short}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl bg-surface p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {sub && <p className="text-sm text-ink-500">{sub}</p>}
      </div>
      {children}
    </section>
  )
}
