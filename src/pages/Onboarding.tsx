import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { AccessFields, ActivityFields, BasicsFields, CauseFields, InterestFields, WhenWhereFields, type Draft } from '../components/ProfileFields'
import { Button, Logo, cx } from '../components/ui'

const empty: Draft = {
  id: '',
  name: '',
  avatar: { kind: 'emoji', value: '✨', color: 0 },
  bio: '',
  pronouns: '',
  school: '',
  interests: [],
  causes: [],
  skills: [],
  activities: [],
  availability: [],
  area: 'bu',
  maxDistance: 4,
  access: [],
  social: [],
}

const STEPS = [
  { title: 'Let’s set up your profile', sub: 'Tell people a little about you. You can change any of this later.', C: BasicsFields, ok: (d: Draft) => d.name.trim().length > 1 },
  { title: 'What are you into?', sub: 'Pick as many as you like — this shapes your feed.', C: InterestFields, ok: (d: Draft) => d.interests.length > 0 },
  { title: 'How do you like to help?', sub: 'We’ll match you with activities you’ll actually enjoy.', C: ActivityFields, ok: () => true },
  { title: 'What causes move you?', sub: 'Find people who care about the same things.', C: CauseFields, ok: () => true },
  { title: 'When & where?', sub: 'So we only show things you can make.', C: WhenWhereFields, ok: (d: Draft) => d.availability.length > 0 },
  { title: 'Make it comfortable', sub: 'Accessibility and social comfort come first here.', C: AccessFields, ok: () => true },
]

export default function Onboarding() {
  const { state, updateUser, toast, fail } = useStore()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => ({ ...empty, ...(state.user ?? {}), avatar: state.user?.avatar.kind === 'initials' ? { kind: 'emoji', value: '✨', color: state.user.avatar.color } : state.user?.avatar ?? empty.avatar }))
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')
  const headRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headRef.current?.focus()
  }, [step])

  const finish = async (d: Draft) => {
    setBuilding(true)
    try {
      await Promise.all([updateUser(d), new Promise((r) => setTimeout(r, 1200))])
      toast(`Welcome, ${d.name.split(' ')[0]}! Your feed is ready`, 'love')
      go('home')
    } catch (e) {
      setBuilding(false)
      fail(e)
    }
  }

  if (building) return <Building name={draft.name} interests={draft.interests.length} />

  const S = STEPS[step]
  const next = () => {
    if (!S) return
    if (!S.ok(draft)) {
      setError(step === 0 ? 'Please add your name to continue.' : step === 1 ? 'Pick at least one interest.' : 'Pick at least one time you’re free.')
      return
    }
    setError('')
    if (step === STEPS.length - 1) finish(draft)
    else setStep(step + 1)
  }

  return (
    <div className="min-h-screen bg-sage-fade bg-brand-50">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5">
        <a href="#/" aria-label="VolunTerrier home">
          <Logo size={34} />
        </a>
        {step >= 0 && (
          <p className="text-sm font-semibold text-ink-500">
            Step {step + 1} of {STEPS.length}
          </p>
        )}
      </header>
      {step >= 0 && (
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Onboarding progress">
            {STEPS.map((_, i) => (
              <div key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-brand-gradient' : 'bg-ink-200')} />
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}>
            {S && (
                <div>
                  <h1 ref={headRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
                    {S.title}
                  </h1>
                  <p className="mb-6 mt-1 text-ink-500">{S.sub}</p>
                  <div className="rounded-xl bg-surface p-5 sm:p-6">
                    <S.C draft={draft} set={(p) => { setDraft((d) => ({ ...d, ...p })); setError('') }} />
                  </div>
                  {error && (
                    <p role="alert" className="mt-3 font-semibold text-brand-700">
                      {error}
                    </p>
                  )}
                </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {step >= 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-brand-200 bg-brand-50/95 backdrop-blur pb-safe">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ArrowLeft size={18} /> Back
            </Button>
            <div className="flex items-center gap-2">
              {step >= 2 && step < STEPS.length - 1 && (
                <Button variant="ghost" onClick={() => setStep(step + 1)}>
                  Skip
                </Button>
              )}
              <Button onClick={next} size="lg">
                {step === STEPS.length - 1 ? 'Build my feed' : 'Continue'} <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Building({ name, interests }: { name: string; interests: number }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 px-6 text-center" role="status" aria-live="polite">
      <div className="relative h-40 w-32">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-xl bg-surface"
            initial={{ rotate: 0, y: 0 }}
            animate={{ rotate: [0, (i - 1) * 12, 0], y: [0, -8, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
          >
            <div className="m-2 h-20 rounded-2xl bg-brand-gradient opacity-80" />
            <div className="mx-3 mt-3 h-2 rounded-full bg-ink-100" />
            <div className="mx-3 mt-2 h-2 w-2/3 rounded-full bg-ink-100" />
          </motion.div>
        ))}
      </div>
      <h1 className="mt-10 text-2xl font-bold">Finding your people{name ? `, ${name.split(' ')[0]}` : ''}…</h1>
      <p className="mt-2 text-ink-500">Ranking opportunities by your {interests || ''} interests, schedule and access needs.</p>
    </div>
  )
}
