import { useState } from 'react'
import { Accessibility, Globe2, KeyRound, Lock, LogOut, MapPin, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { ApiError, get, post } from '../lib/api'
import { A11yPanel } from '../components/A11yPanel'
import { Button, Modal, SectionTitle, cx } from '../components/ui'
import { Label, inputCls } from '../components/ProfileFields'
import { passwordHint } from './Auth'

function Card({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        {icon} {title}
      </h2>
      {sub && <p className="mt-0.5 text-sm text-ink-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Switch({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="text-sm text-ink-500">{desc}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-moss' : 'bg-brand-300')}>
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-brand-50 shadow transition-all', on ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { state, updatePrivacy, setHome, toast, fail, logout } = useStore()
  const user = state.user!
  const [place, setPlace] = useState('')
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [codeModal, setCodeModal] = useState<'ask' | string | null>(null)
  const [delModal, setDelModal] = useState(false)
  const [confirmPw, setConfirmPw] = useState('')

  const savePlace = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = await get<{ label: string; lat: number; lng: number }>(`/opportunities/geocode?q=${encodeURIComponent(place)}`)
      await setHome(r)
      setPlace('')
      toast(`Location set to ${r.label}`)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-8 sm:pt-4">
      <SectionTitle eyebrow="Settings" title="Privacy, account & accessibility" />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <Card icon={<ShieldCheck size={20} className="text-moss" />} title="Privacy" sub="Everything defaults to private. You’re in control.">
          <div role="radiogroup" aria-label="Volunteer progress visibility" className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {(
              [
                ['private', Lock, 'Private', 'Only you can see your hours and activity.'],
                ['public', Globe2, 'Public', 'Logged-in users can see your hours, milestones and completed activities.'],
              ] as const
            ).map(([v, I, l, d]) => (
              <button
                key={v}
                role="radio"
                aria-checked={user.settings.progressVisibility === v}
                onClick={() => updatePrivacy({ progressVisibility: v }).then(() => toast(`Progress is now ${v}`, 'info'), fail)}
                className={cx('rounded-2xl border-2 p-4 text-left transition', user.settings.progressVisibility === v ? 'border-moss bg-brand-50' : 'border-transparent bg-brand-50/60 hover:border-brand-300')}
              >
                <span className="flex items-center gap-2 font-bold">
                  <I size={16} className="text-moss" /> {l} {user.settings.progressVisibility === v && <span className="ml-auto text-xs text-moss">Selected</span>}
                </span>
                <span className="mt-1 block text-sm text-ink-500">{d}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-brand-200 pt-2">
            <Switch
              label="Show friends which events I’m attending"
              desc="Only accepted friends see this. Turn off to attend privately."
              on={user.settings.shareAttendanceWithFriends}
              onChange={(v) => updatePrivacy({ shareAttendanceWithFriends: v }).then(() => toast('Saved', 'info'), fail)}
            />
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Never shared with anyone: your password, schedule, saved location, accessibility needs and recovery code.{' '}
            <a href={`#/u/${user.username}`} className="font-bold underline">
              Preview your public profile
            </a>
          </p>
        </Card>

        <Card icon={<MapPin size={20} className="text-moss" />} title="Your location" sub="Optional. Used only to sort “near you” results for you.">
          {user.home ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3">
              <span>
                <span className="block font-bold">{user.home.label}</span>
                <span className="text-xs text-ink-500">Stored rounded to about 1 km. Never shown to others.</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setHome(null).then(() => toast('Location removed', 'info'), fail)}>
                Remove
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-500">No location saved — we use your neighborhood from your profile.</p>
          )}
          <form onSubmit={savePlace} className="mt-3 flex gap-2">
            <label htmlFor="home-place" className="sr-only">
              City, neighborhood or ZIP code
            </label>
            <input id="home-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="City, neighborhood or ZIP" className={cx(inputCls, 'py-2.5')} maxLength={120} />
            <Button type="submit" disabled={!place.trim()}>
              Set
            </Button>
          </form>
        </Card>

        <Card icon={<KeyRound size={20} className="text-moss" />} title="Password & recovery" sub={`Signed in as @${user.username}`}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setPwErr(null)
              const h = passwordHint(pw.newPassword, user.username)
              if (h) return setPwErr(h)
              try {
                await post('/auth/change-password', pw)
                setPw({ currentPassword: '', newPassword: '' })
                toast('Password changed — other devices were signed out')
              } catch (err) {
                setPwErr(err instanceof Error ? err.message : 'Could not change password')
              }
            }}
          >
            <div>
              <Label htmlFor="cur-pw">Current password</Label>
              <input id="cur-pw" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className={inputCls} />
            </div>
            <div>
              <Label htmlFor="new-pw" hint="(10+ characters)">New password</Label>
              <input id="new-pw" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className={inputCls} />
            </div>
            {pwErr && <p role="alert" className="text-sm font-semibold text-brand-800">{pwErr}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!pw.currentPassword || !pw.newPassword}>
                Change password
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCodeModal('ask')}>
                New recovery code
              </Button>
            </div>
          </form>
        </Card>

        <Card icon={<Accessibility size={20} className="text-moss" />} title="Display & accessibility" sub="Saved on this device.">
          <A11yPanel />
        </Card>

        <Card icon={<Users size={20} className="text-moss" />} title="Session">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => logout().then(() => go(''))}>
              <LogOut size={16} /> Log out
            </Button>
            <Button variant="ghost" onClick={() => setDelModal(true)}>
              <Trash2 size={16} /> Delete account
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={!!codeModal} onClose={() => { setCodeModal(null); setConfirmPw('') }} label="New recovery code">
        <div className="p-6">
          <h2 className="pr-8 text-xl font-bold">New recovery code</h2>
          {codeModal === 'ask' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const r = await post<{ recoveryCode: string }>('/auth/recovery-code', { password: confirmPw })
                  setCodeModal(r.recoveryCode)
                  setConfirmPw('')
                } catch (err) {
                  fail(err)
                }
              }}
            >
              <p className="mt-1 text-sm text-ink-500">Your old code will stop working. Confirm your password to continue.</p>
              <input type="password" aria-label="Password" autoComplete="current-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={cx(inputCls, 'mt-4')} />
              <Button type="submit" className="mt-4" disabled={!confirmPw}>
                Generate
              </Button>
            </form>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-500">Save this somewhere safe. It won’t be shown again.</p>
              <p className="mt-4 select-all rounded-2xl bg-brand-800 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider text-sage">{codeModal}</p>
              <Button className="mt-4" onClick={() => setCodeModal(null)}>
                I saved it
              </Button>
            </>
          )}
        </div>
      </Modal>

      <Modal open={delModal} onClose={() => setDelModal(false)} label="Delete account">
        <form
          className="p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await post('/auth/delete-account', { password: confirmPw })
              setDelModal(false)
              await logout()
              go('')
            } catch (err) {
              fail(err instanceof ApiError ? err : new Error('Could not delete account'))
            }
          }}
        >
          <h2 className="pr-8 text-xl font-bold">Delete your account?</h2>
          <p className="mt-2 text-sm text-ink-500">This permanently deletes your profile, matches, verified hours, friendships and any opportunities you organize. This can’t be undone.</p>
          <input type="password" aria-label="Confirm with your password" placeholder="Your password" autoComplete="current-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={cx(inputCls, 'mt-4')} />
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDelModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="dark" disabled={!confirmPw}>
              Delete forever
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
