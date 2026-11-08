import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Avatar as AvatarT, CategoryId } from '../types'
import { AVATAR_GRADIENTS, catOf } from '../data/taxonomy'
import { useStore } from '../lib/store'
import { CategoryIcon } from './CategoryIcon'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/* ---------- Brand ---------- */
export function LogoMark({ size = 36 }: { size?: number }) {
  return <img src="/logo-192.png" width={size} height={size} alt="" aria-hidden="true" className="shrink-0 rounded-[28%]" draggable={false} />
}

export function Logo({ size = 36, className, light }: { size?: number; className?: string; light?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className={cx('font-bold tracking-tight', light ? 'text-brand-50' : 'text-brand-800')} style={{ fontSize: size * 0.6 }}>
        Volun<span className={light ? 'text-sage' : 'text-moss'}>Terrier</span>
      </span>
    </span>
  )
}

/* ---------- Images with graceful fallback ---------- */
export function Img({ src, alt, category, className }: { src: string; alt: string; category?: CategoryId; className?: string }) {
  const [failed, setFailed] = useState(!src)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setFailed(!src)
    setLoaded(false)
  }, [src])
  const cat = catOf(category ?? 'community')
  if (failed)
    return (
      <div role="img" aria-label={alt} className={cx('flex items-center justify-center bg-brand-300 text-brand-700 [container-type:size]', className)}>
        <CategoryIcon id={cat.id} strokeWidth={1.5} style={{ width: 'min(36cqmin, 4rem)', height: 'min(36cqmin, 4rem)' }} />
      </div>
    )
  return (
    <div className={cx('relative overflow-hidden', className)}>
      {!loaded && <div className="absolute inset-0 bg-brand-200" aria-hidden />}
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cx('h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}

/* ---------- Avatar ---------- */
export function Avatar({ avatar, name, size = 40, ring }: { avatar?: AvatarT | null; name: string; size?: number; ring?: boolean }) {
  const a = avatar ?? { kind: 'initials', value: initials(name), color: 0 }
  const cls = cx(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
    AVATAR_GRADIENTS[a.color % AVATAR_GRADIENTS.length],
    ring && 'ring-2 ring-brand-50',
  )
  const style = { width: size, height: size, fontSize: a.kind === 'emoji' ? size * 0.5 : size * 0.36 }
  if (a.kind === 'image' && a.value)
    return <img src={a.value} alt={name} className={cx(cls, 'object-cover')} style={style} />
  return (
    <span className={cls} style={style} role="img" aria-label={name}>
      {a.kind === 'emoji' ? a.value : a.value || initials(name)}
    </span>
  )
}
export const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?'

export function AvatarStack({ people, max = 4, size = 28 }: { people: { name: string; avatar?: AvatarT | null }[]; max?: number; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map((p, i) => (
        <Avatar key={i} name={p.name} avatar={p.avatar} size={size} ring />
      ))}
    </span>
  )
}

/* ---------- Buttons & chips ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'light'; size?: 'sm' | 'md' | 'lg' }
export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3.5 py-1.5 text-sm',
        size === 'md' && 'px-5 py-2.5 text-[0.95rem]',
        size === 'lg' && 'px-7 py-3.5 text-base',
        variant === 'primary' && 'bg-moss text-white hover:bg-brand-600',
        variant === 'secondary' && 'hc-border border border-brand-400/60 bg-transparent text-brand-800 hover:bg-brand-100',
        variant === 'ghost' && 'text-brand-700 hover:bg-brand-100',
        variant === 'dark' && 'bg-brand-800 text-brand-50 hover:bg-brand-900',
        variant === 'light' && 'border border-brand-50/40 text-brand-50 hover:bg-brand-50/10', // outline for dark backgrounds
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  size = 'md',
  as = 'button',
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  size?: 'sm' | 'md'
  as?: 'button' | 'span'
}) {
  const cls = cx(
    'hc-border inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium transition-colors select-none',
    size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
    selected
      ? 'border-moss bg-moss text-white'
      : 'border-brand-300 bg-transparent text-brand-800 hover:bg-brand-100',
  )
  if (as === 'span') return <span className={cls}>{children}</span>
  return (
    <button type="button" aria-pressed={!!selected} onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

export function Tag({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'brand' | 'green' | 'blue' | 'violet' | 'white' | 'dark' }) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        tone === 'ink' && 'bg-brand-100 text-brand-700',
        tone === 'brand' && 'bg-moss text-white',
        tone === 'green' && 'bg-brand-100 text-brand-700',
        tone === 'blue' && 'bg-brand-100 text-brand-700',
        tone === 'violet' && 'bg-brand-100 text-brand-700',
        tone === 'white' && 'bg-brand-50 text-brand-800',
        tone === 'dark' && 'bg-brand-800 text-brand-50',
      )}
    >
      {children}
    </span>
  )
}

/* ---------- Modal / sheet ---------- */
export function Modal({
  open,
  onClose,
  label,
  children,
  wide,
  top,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  wide?: boolean
  top?: boolean // stack above other open dialogs (e.g. alerts)
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], button')?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]!, last = f[f.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={cx('fixed inset-0 flex items-end justify-center sm:items-center sm:p-6', top ? 'z-[60]' : 'z-50')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cx(
              'relative max-h-[92vh] w-full overflow-y-auto overflow-x-hidden rounded-t-2xl bg-brand-50 shadow-lift sm:rounded-2xl',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-xl',
            )}
          >
            <div className="sticky top-0 z-30 h-0">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-full bg-brand-50 p-2 text-brand-800 hover:bg-brand-100"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Toasts ---------- */
export function Toasts() {
  const { toasts } = useStore()
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={cx(
              'pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white shadow-lift',
              t.tone === 'error' ? 'bg-brand-900 ring-2 ring-sage' : 'bg-brand-800',
            )}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function EmptyState({ title, body, action }: { emoji?: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionTitle({ title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-ink-500">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
/** short zone label, shown only when the event's zone differs from the viewer's */
export function tzLabel(iso: string | number, timeZone?: string) {
  if (!timeZone || timeZone === localTz) return ''
  const p = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date(iso)).find((x) => x.type === 'timeZoneName')
  return p ? ` ${p.value}` : ''
}
export function fmtDate(iso: string | number, opts: { long?: boolean; timeZone?: string } = {}) {
  const d = new Date(iso)
  const tz = opts.timeZone
  const day = d.toLocaleDateString(undefined, { timeZone: tz, ...(opts.long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' }) })
  const time = d.toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}${tzLabel(iso, tz)}`
}
export function fmtDay(iso: string | number, timeZone?: string) {
  return new Date(iso).toLocaleDateString(undefined, { timeZone, weekday: 'long', month: 'long', day: 'numeric' })
}
export function fmtRange(start: string | number, end: number, timeZone?: string) {
  const t = (d: Date) => d.toLocaleTimeString(undefined, { timeZone, hour: 'numeric', minute: '2-digit' })
  const s = new Date(start)
  const e = new Date(end)
  const nextDay = new Date(s).toLocaleDateString('en-CA', { timeZone }) !== e.toLocaleDateString('en-CA', { timeZone })
  return `${t(s)} – ${t(e)}${nextDay ? ' (next day)' : ''}${tzLabel(start, timeZone)}`
}
export const hrs = (h: number) => `${+h.toFixed(2)} hr${h === 1 ? '' : 's'}`

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span title="Example listing for demonstration — not a real event" className={cx('inline-flex items-center rounded-md bg-brand-800 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sage', className)}>
      Sample
    </span>
  )
}
