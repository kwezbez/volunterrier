import { useStore } from '../lib/store'
import { cx } from './ui'

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="text-sm text-ink-500">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand-500' : 'bg-ink-200')}
      >
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-brand-50 shadow transition-all', on ? 'left-6' : 'left-1')} />
      </button>
    </label>
  )
}

export function A11yPanel() {
  const { state, setSettings } = useStore()
  const s = state.settings
  const sizes = ['A-', 'A', 'A+', 'A++'] as const
  return (
    <div className="divide-y divide-ink-100">
      <div className="pb-3">
        <p className="font-semibold">Text size</p>
        <div className="mt-2 inline-flex rounded-full bg-ink-100 p-1" role="radiogroup" aria-label="Text size">
          {sizes.map((l, i) => (
            <button
              key={l}
              role="radio"
              aria-checked={s.textScale === i}
              aria-label={['Small', 'Default', 'Large', 'Extra large'][i]}
              onClick={() => setSettings({ textScale: i as 0 | 1 | 2 | 3 })}
              className={cx('rounded-full px-4 py-1.5 font-bold', s.textScale === i ? 'bg-moss text-white' : 'text-ink-500')}
              style={{ fontSize: 12 + i * 2 }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Reduce motion" desc="Turns off card fly-outs and animations." on={s.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} />
      <Toggle label="High contrast" desc="Darker text and stronger borders." on={s.highContrast} onChange={(v) => setSettings({ highContrast: v })} />
      <Toggle label="Hyperlegible font" desc="Atkinson Hyperlegible, designed for low vision readers." on={s.dyslexiaFont} onChange={(v) => setSettings({ dyslexiaFont: v })} />
      <p className="pt-3 text-xs text-ink-500">Swiping is always optional: every card has Skip, Details and Like buttons, and works with ← → arrow keys.</p>
    </div>
  )
}
