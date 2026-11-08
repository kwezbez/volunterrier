import { useRef } from 'react'
import { Upload } from 'lucide-react'
import type { UserProfile } from '../types'
import { ACCESS, ACTIVITIES, AREAS, AVATAR_GRADIENTS, CATEGORIES, CAUSES, SKILLS, SLOTS, SOCIAL_PREFS } from '../data/taxonomy'
import { Avatar, Chip, cx, initials } from './ui'
import { CategoryIcon } from './CategoryIcon'

export type Draft = UserProfile
type P = { draft: Draft; set: (patch: Partial<Draft>) => void }

const tog = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

const EMOJIS = ['🏀', '⚽', '📚', '🌿', '🐶', '🐱', '🎨', '🎸', '💻', '🌻', '🥕', '🌊', '✨', '🦄', '🧠', '☕']

export const inputCls =
  'hc-border w-full rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-brand-800 placeholder:text-ink-400 outline-none transition focus:border-moss focus:ring-4 focus:ring-sage/50'

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink-800">
      {children} {hint && <span className="font-normal text-ink-400">{hint}</span>}
    </label>
  )
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const s = 256
        const c = document.createElement('canvas')
        c.width = c.height = s
        const ctx = c.getContext('2d')!
        const m = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s)
        resolve(c.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function BasicsFields({ draft, set }: P) {
  const file = useRef<HTMLInputElement>(null)
  const a = draft.avatar
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={draft.name || 'You'} avatar={a.kind === 'initials' ? { ...a, value: initials(draft.name || 'You') } : a} size={84} />
        <div className="min-w-0">
          <p className="text-sm font-bold">Profile picture</p>
          <p className="text-xs text-ink-500">Pick an emoji, use your initials, or upload a photo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => file.current?.click()} className="hc-border inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-ink-50">
              <Upload size={14} /> Upload
            </button>
            <button type="button" onClick={() => set({ avatar: { kind: 'initials', value: '', color: a.color } })} className="hc-border rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-ink-50" aria-pressed={a.kind === 'initials'}>
              Initials
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload profile photo"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) set({ avatar: { kind: 'image', value: await resizeImage(f), color: a.color } })
            }}
          />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-bold">Emoji</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose an emoji avatar">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Emoji ${e}`}
              aria-pressed={a.kind === 'emoji' && a.value === e}
              onClick={() => set({ avatar: { kind: 'emoji', value: e, color: a.color } })}
              className={cx('flex h-10 w-10 items-center justify-center rounded-xl text-xl transition', a.kind === 'emoji' && a.value === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-ink-100 hover:bg-ink-200')}
            >
              {e}
            </button>
          ))}
        </div>
        <p className="mb-1.5 mt-3 text-sm font-bold">Color</p>
        <div className="flex gap-2" role="group" aria-label="Avatar color">
          {AVATAR_GRADIENTS.map((g, i) => (
            <button
              key={g}
              type="button"
              aria-label={`Color ${i + 1}`}
              aria-pressed={a.color === i}
              onClick={() => set({ avatar: { ...a, color: i } })}
              className={cx('h-8 w-8 rounded-full bg-gradient-to-br', g, a.color === i && 'ring-2 ring-ink-900 ring-offset-2')}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <Label htmlFor="name">Your name</Label>
          <input id="name" className={inputCls} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Taylor Brooks-Lee" autoComplete="name" required />
        </div>
        <div>
          <Label htmlFor="pronouns" hint="(optional)">Pronouns</Label>
          <input id="pronouns" className={inputCls} value={draft.pronouns ?? ''} onChange={(e) => set({ pronouns: e.target.value })} placeholder="they/them" />
        </div>
      </div>
      <div>
        <Label htmlFor="school" hint="(optional)">School or role</Label>
        <input id="school" className={inputCls} value={draft.school ?? ''} onChange={(e) => set({ school: e.target.value })} placeholder="BU ’27 · Education" />
      </div>
      <div>
        <Label htmlFor="bio" hint={`${draft.bio.length}/200`}>Short bio</Label>
        <textarea id="bio" rows={3} maxLength={200} className={inputCls} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="What brings you here? What do you love doing?" />
      </div>
    </div>
  )
}

export function InterestFields({ draft, set }: P) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2" role="group" aria-label="Interests">
      {CATEGORIES.map((c) => {
        const on = draft.interests.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => set({ interests: tog(draft.interests, c.id) })}
            className={cx(
              'hc-border group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-colors',
              on ? 'border-moss bg-sage/40' : 'border-brand-200 bg-brand-50 hover:border-brand-300',
            )}
          >
            <CategoryIcon id={c.id} size={20} className={cx('shrink-0', on ? 'text-moss' : 'text-ink-500')} />
            <span className={cx('text-sm font-medium leading-tight', on ? 'text-brand-800' : 'text-ink-700')}>{c.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ChipGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-ink-800">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} selected={value.includes(o)} onClick={() => onChange(tog(value, o))}>
            {o}
          </Chip>
        ))}
      </div>
    </fieldset>
  )
}

export function ActivityFields({ draft, set }: P) {
  return (
    <div className="space-y-6">
      <ChipGroup label="Activities you’d enjoy" options={ACTIVITIES} value={draft.activities} onChange={(activities) => set({ activities })} />
      <ChipGroup label="Skills you can bring (optional)" options={SKILLS} value={draft.skills} onChange={(skills) => set({ skills })} />
    </div>
  )
}

export function CauseFields({ draft, set }: P) {
  return <ChipGroup label="Causes you care about" options={CAUSES} value={draft.causes} onChange={(causes) => set({ causes })} />
}

export function WhenWhereFields({ draft, set }: P) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-bold">When are you usually free?</legend>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <Chip key={s.id} selected={draft.availability.includes(s.id)} onClick={() => set({ availability: tog(draft.availability, s.id) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Where are you based?</legend>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <Chip key={a.id} selected={draft.area === a.id} onClick={() => set({ area: a.id })}>
              {a.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="dist">
          How far will you travel? <span className="text-brand-600">{draft.maxDistance} mi</span>
        </Label>
        <input id="dist" type="range" min={1} max={8} step={1} value={draft.maxDistance} onChange={(e) => set({ maxDistance: Number(e.target.value) })} className="w-full accent-[#717744]" />
        <div className="flex justify-between text-xs text-ink-400">
          <span>Walking distance</span>
          <span>Anywhere on the T</span>
        </div>
      </div>
    </div>
  )
}

export function AccessFields({ draft, set }: P) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-bold">Accessibility needs</legend>
        <p className="mb-2 text-xs text-ink-500">We’ll prioritize places that meet these and flag ones that don’t. Private to you.</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
          {ACCESS.map((a) => {
            const on = draft.access.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ access: tog(draft.access, a.id) })}
                className={cx('hc-border flex items-start gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-brand-500 bg-brand-100' : 'border-ink-200 bg-surface hover:border-ink-300')}
              >
                <span className="text-xl" aria-hidden></span>
                <span>
                  <span className={cx('block text-sm font-semibold', on && 'text-brand-800')}>{a.label}</span>
                  <span className="text-xs text-ink-500">{a.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold">Social comfort</legend>
        <p className="mb-2 text-xs text-ink-500">Totally normal to feel nervous about new groups. Tell us what helps.</p>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PREFS.map((s) => (
            <Chip key={s.id} selected={draft.social.includes(s.id)} onClick={() => set({ social: tog(draft.social, s.id) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function completion(u: UserProfile) {
  const checks = [
    !!u.name.trim(),
    u.avatar.kind !== 'initials',
    u.bio.trim().length > 10,
    u.interests.length > 0,
    u.activities.length > 0,
    u.skills.length > 0,
    u.causes.length > 0,
    u.availability.length > 0,
    !!u.area,
    u.social.length > 0 || u.access.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
