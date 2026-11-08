import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Copy, Eye, EyeOff, KeyRound, MapPin, ShieldCheck } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { ApiError, post } from '../lib/api'
import { Avatar, Button, Img, Logo, SampleBadge, cx, fmtDate } from '../components/ui'
import { Label, inputCls } from '../components/ProfileFields'
import type { Avatar as AvatarT, CategoryId } from '../types'

const PENDING_INVITE = 'volunterrier:pending-invite'
export const rememberInvite = (token: string) => {
  try {
    sessionStorage.setItem(PENDING_INVITE, token)
  } catch {
    /* ignore */
  }
}
export const takeInvite = () => {
  try {
    const t = sessionStorage.getItem(PENDING_INVITE)
    sessionStorage.removeItem(PENDING_INVITE)
    return t
  } catch {
    return null
  }
}

/** client-side hints that mirror the server's rules (the server is the source of truth) */
export function passwordHint(pw: string, username = '') {
  if (pw.length < 10) return 'At least 10 characters'
  if (new TextEncoder().encode(pw).length > 72) return 'At most 72 characters'
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return 'Can’t contain your username'
  return null
}
function strength(pw: string) {
  let s = 0
  if (pw.length >= 10) s++
  if (pw.length >= 14) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++
  if (pw.length >= 20) s++
  return Math.min(4, s)
}

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] min-h-screen bg-brand-50 lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-brand-800 p-12 text-brand-50 lg:flex lg:flex-col">
        <a href="#/" aria-label="VolunTerrier home">
          <Logo size={40} light />
        </a>
        <div className="my-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Volunteer with
            <br />
            <span className="text-sage">your people.</span>
          </h2>
          <p className="mt-6 max-w-sm text-brand-50/75">Find opportunities near campus, match without double-booking, bring friends, and keep a verified record of your hours.</p>
        </div>
        
      </div>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <a href="#/" className="lg:hidden" aria-label="VolunTerrier home">
          <Logo size={34} />
        </a>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-ink-500">{sub}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={cx(inputCls, 'pr-12')} aria-invalid={invalid} aria-describedby={describedBy} maxLength={200} required />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-500 hover:bg-brand-100" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

function ErrorText({ id, children }: { id?: string; children?: string | null }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-3 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-brand-50">
      {children}
    </p>
  )
}

async function afterAuth(signedIn: (u: never) => Promise<void>, user: unknown) {
  await signedIn(user as never)
  const invite = takeInvite()
  if (invite) return go('invite', invite)
  const u = user as { onboarded: boolean }
  go(u.onboarded ? 'home' : 'onboarding')
}

export function Login() {
  const { signedIn } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Shell title="Welcome back" sub="Log in to see what’s happening near you.">
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          if (!username.trim() || !password) return setError('Enter your username and password.')
          setBusy(true)
          try {
            const r = await post<{ user: unknown }>('/auth/login', { username, password })
            await afterAuth(signedIn as never, r.user)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed.')
          } finally {
            setBusy(false)
          }
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="username">Username</Label>
          <input id="username" className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={40} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
        <div className="flex justify-between text-sm">
          <a href="#/reset" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Forgot password?
          </a>
          <a href="#/register" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Create an account
          </a>
        </div>
      </form>
    </Shell>
  )
}

function RecoveryCode({ code, onDone, label = 'Continue' }: { code: string; onDone: () => void; label?: string }) {
  const { toast } = useStore()
  const [ack, setAck] = useState(false)
  return (
    <div>
      <div className="rounded-xl bg-brand-800 p-6 text-brand-50">
        <p className="flex items-center gap-2 font-bold">
          <KeyRound size={18} className="text-sage" /> Your recovery code
        </p>
        <p className="mt-1 text-sm text-brand-50/75">This is the only way to reset your password. We’ll never show it again.</p>
        <p className="mt-4 select-all break-all rounded-2xl bg-brand-900 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider text-sage">{code}</p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => toast('Recovery code copied'),
              () => toast('Select the code and copy it manually', 'info'),
            )
          }}
        >
          <Copy size={14} /> Copy code
        </Button>
      </div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#717744]" />
        I saved my recovery code somewhere safe (like a password manager).
      </label>
      <Button size="lg" className="mt-5 w-full" disabled={!ack} onClick={onDone}>
        {label} <ArrowRight size={18} />
      </Button>
    </div>
  )
}

export function Register() {
  const { signedIn } = useStore()
  const [f, setF] = useState({ displayName: '', username: '', password: '', confirm: '' })
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ code: string; user: unknown } | null>(null)
  const set = (p: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...p }))
    setError(null)
  }
  const s = strength(f.password)
  const hint = f.password ? passwordHint(f.password, f.username) : null

  if (done)
    return (
      <Shell title="Account created" sub="One last thing before we set up your profile.">
        <RecoveryCode code={done.code} onDone={() => afterAuth(signedIn as never, done.user)} label="Set up my profile" />
      </Shell>
    )

  return (
    <Shell title="Create your account" sub="Takes a minute. Your hours and progress stay private unless you choose to share.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!f.displayName.trim()) return setError({ msg: 'Add your name.', field: 'displayName' })
          if (!/^[a-zA-Z0-9_.]{3,24}$/.test(f.username)) return setError({ msg: 'Usernames are 3–24 characters: letters, numbers, dots or underscores.', field: 'username' })
          if (hint) return setError({ msg: hint, field: 'password' })
          if (f.password !== f.confirm) return setError({ msg: 'Passwords don’t match.', field: 'confirm' })
          setBusy(true)
          try {
            const r = await post<{ user: unknown; recoveryCode: string }>('/auth/register', { displayName: f.displayName, username: f.username, password: f.password })
            setDone({ code: r.recoveryCode, user: r.user })
          } catch (err) {
            setError({ msg: err instanceof Error ? err.message : 'Sign-up failed.', field: err instanceof ApiError ? err.field : undefined })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div>
          <Label htmlFor="displayName">Your name</Label>
          <input id="displayName" className={inputCls} value={f.displayName} onChange={(e) => set({ displayName: e.target.value })} autoComplete="name" maxLength={40} aria-invalid={error?.field === 'displayName'} />
          <p className="mt-1 text-xs text-ink-500">Shown to friends and organizers.</p>
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <input id="username" className={inputCls} value={f.username} onChange={(e) => set({ username: e.target.value.replace(/\s/g, '') })} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24} aria-invalid={error?.field === 'username'} aria-describedby="u-help" />
          <p id="u-help" className="mt-1 text-xs text-ink-500">
            3–24 letters, numbers, dots or underscores. This is how friends add you.
          </p>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" value={f.password} onChange={(v) => set({ password: v })} autoComplete="new-password" invalid={error?.field === 'password'} describedBy="pw-help" />
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cx('h-1.5 flex-1 rounded-full', i < s ? (s >= 3 ? 'bg-moss' : 'bg-sage') : 'bg-brand-200')} />
            ))}
          </div>
          <p id="pw-help" className="mt-1 text-xs text-ink-500">
            {hint ?? (f.password ? ['Weak', 'Okay', 'Good', 'Strong', 'Excellent'][s] + ' — a short phrase works great.' : 'At least 10 characters. A memorable phrase is best.')}
          </p>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" value={f.confirm} onChange={(v) => set({ confirm: v })} autoComplete="new-password" invalid={error?.field === 'confirm'} />
        </div>
        <ErrorText>{error?.msg}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-sm text-ink-500">
          Already have an account?{' '}
          <a href="#/login" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Log in
          </a>
        </p>
      </form>
    </Shell>
  )
}

export function Reset() {
  const { signedIn } = useStore()
  const [f, setF] = useState({ username: '', recoveryCode: '', newPassword: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ code: string; user: unknown } | null>(null)
  if (done)
    return (
      <Shell title="Password updated" sub="You’ve been signed out everywhere else. Here’s your new recovery code — the old one no longer works.">
        <RecoveryCode code={done.code} onDone={() => afterAuth(signedIn as never, done.user)} />
      </Shell>
    )
  return (
    <Shell title="Reset your password" sub="Use the recovery code you saved when you created your account.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          const h = passwordHint(f.newPassword, f.username)
          if (h) return setError(h)
          setBusy(true)
          try {
            const r = await post<{ user: unknown; recoveryCode: string }>('/auth/reset', f)
            setDone({ code: r.recoveryCode, user: r.user })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Reset failed.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <div>
          <Label htmlFor="username">Username</Label>
          <input id="username" className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" autoCapitalize="none" maxLength={40} />
        </div>
        <div>
          <Label htmlFor="code">Recovery code</Label>
          <input id="code" className={cx(inputCls, 'font-mono uppercase tracking-wider')} value={f.recoveryCode} onChange={(e) => setF({ ...f, recoveryCode: e.target.value })} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoComplete="one-time-code" maxLength={40} />
        </div>
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <PasswordInput id="newPassword" value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} autoComplete="new-password" />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Resetting…' : 'Reset password'}
        </Button>
        <p className="text-sm text-ink-500">
          Lost your recovery code too? For your security we can’t reset the account without it — create a new account instead.{' '}
          <a href="#/login" className="font-semibold text-brand-700 hover:underline">
            Back to log in
          </a>
        </p>
      </form>
    </Shell>
  )
}

interface InvitePreview {
  inviterName: string
  inviterAvatar: AvatarT | null
  expiresAt: number
  opportunity: { id: string; title: string; org: string; startAt: number; endAt: number; timeZone: string; city: string; area: string; image: string; category: CategoryId; isSample: boolean } | null
}

export function InvitePage({ token }: { token: string }) {
  const { state, toast, loadData, setJoined } = useStore()
  const [inv, setInv] = useState<InvitePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    post<{ invite: InvitePreview }>('/invites/lookup', { token }).then(
      (r) => setInv(r.invite),
      (e) => setError(e.message),
    )
  }, [token])

  const accept = async (joinToo: boolean) => {
    setBusy(true)
    try {
      const r = await post<{ opportunityId: string | null }>('/invites/accept', { token })
      await loadData()
      if (joinToo && r.opportunityId) {
        const ok = await setJoined(r.opportunityId, true)
        if (ok) toast(`You’re friends with ${inv!.inviterName} and matched with the event.`, 'info')
        go('schedule')
      } else {
        toast(`You’re now friends with ${inv!.inviterName}`, 'info')
        go('friends')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept the invitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title={inv ? `${inv.inviterName} invited you!` : error ? 'Invitation unavailable' : 'Loading invitation…'} sub={inv ? 'Volunteer together on VolunTerrier.' : ''}>
      {error && <ErrorText>{error}</ErrorText>}
      {inv && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={inv.inviterName} avatar={inv.inviterAvatar} size={48} />
            <p className="text-ink-600">
              <b className="text-brand-800">{inv.inviterName}</b> wants to volunteer with you{inv.opportunity ? ' at:' : '.'}
            </p>
          </div>
          {inv.opportunity && (
            <div className="overflow-hidden rounded-xl bg-surface">
              <Img src={inv.opportunity.image} alt="" category={inv.opportunity.category} className="h-36 w-full" />
              <div className="p-4">
                {inv.opportunity.isSample && <SampleBadge className="mb-1" />}
                <p className="text-lg font-bold">{inv.opportunity.title}</p>
                <p className="text-sm text-ink-500">{inv.opportunity.org}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-600">
                  <CalendarDays size={14} /> {fmtDate(inv.opportunity.startAt, { timeZone: inv.opportunity.timeZone })}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-ink-600">
                  <MapPin size={14} /> {inv.opportunity.city || 'Online'}
                </p>
              </div>
            </div>
          )}
          {state.user ? (
            <div className="space-y-2">
              {inv.opportunity && (
                <Button size="lg" className="w-full" disabled={busy} onClick={() => accept(true)}>
                  <Check size={18} /> Accept & match
                </Button>
              )}
              <Button size="lg" variant={inv.opportunity ? 'secondary' : 'primary'} className="w-full" disabled={busy} onClick={() => accept(false)}>
                Accept & add {inv.inviterName.split(' ')[0]} as a friend
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  rememberInvite(token)
                  go('register')
                }}
              >
                Create an account to accept
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  rememberInvite(token)
                  go('login')
                }}
              >
                I already have an account
              </Button>
            </div>
          )}
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <ShieldCheck size={14} /> Invitation links are private and expire {new Date(inv.expiresAt).toLocaleDateString()}. Accepting shares only your display name with {inv.inviterName.split(' ')[0]}.
          </p>
        </div>
      )}
    </Shell>
  )
}
