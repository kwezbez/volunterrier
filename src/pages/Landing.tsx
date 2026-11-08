import { ArrowRight, CalendarCheck, Search, TrendingUp, Users } from 'lucide-react'
import { go, useStore } from '../lib/store'
import { Button, Logo } from '../components/ui'

const FEATURES = [
  { I: Search, t: 'Find something nearby', d: 'Search by city, ZIP or address, or swipe through a feed tuned to what you care about.' },
  { I: CalendarCheck, t: 'Match without double-booking', d: 'Your schedule checks every match against what you’ve already planned.' },
  { I: Users, t: 'Bring your friends', d: 'Send a private invite link and see which friends matched with the same events.' },
  { I: TrendingUp, t: 'Track verified hours', d: 'Organizers confirm attendance. Your hours add up toward milestones, privately by default.' },
]

export default function Landing() {
  const { state } = useStore()
  const start = () => go(state.user ? 'home' : 'register')
  return (
    <div className="min-h-screen bg-brand-50">
      <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-50 rounded-full bg-brand-800 px-4 py-2 text-brand-50">
        Skip to content
      </a>

      <div className="bg-brand-800 text-brand-50">
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <Logo size={34} light />
          <nav className="flex items-center gap-1" aria-label="Account">
            {state.user ? (
              <Button size="sm" onClick={() => go('home')}>
                Open app
              </Button>
            ) : (
              <>
                <a href="#/login" className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-brand-50/85 hover:text-brand-50">
                  Log in
                </a>
                <Button size="sm" onClick={() => go('register')}>
                  Sign up
                </Button>
              </>
            )}
          </nav>
        </header>

        <section className="mx-auto max-w-5xl px-5 pb-20 pt-12 sm:pt-20" aria-labelledby="hero-title">
          <h1 id="hero-title" className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Volunteer with people you actually want to hang out with.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-brand-50/80">
            VolunTerrier helps college students find volunteer opportunities near campus, match with events that fit their schedule, bring friends along, and keep a verified record of their hours.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={start}>
              Get started <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="light" onClick={() => document.getElementById('main')?.scrollIntoView({ behavior: 'smooth' })}>
              How it works
            </Button>
          </div>
        </section>
      </div>

      <main id="main" className="mx-auto max-w-5xl scroll-mt-6 px-5">
        <section className="py-16" aria-labelledby="how-title">
          <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.t} className="flex gap-4">
                <f.I size={22} className="mt-0.5 shrink-0 text-moss" aria-hidden />
                <div>
                  <h3 className="font-semibold">{f.t}</h3>
                  <p className="mt-1 text-ink-600">{f.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)] gap-10 border-t border-line py-16 md:grid-cols-2" aria-labelledby="privacy-title">
          <div>
            <h2 id="privacy-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Private unless you say otherwise
            </h2>
            <p className="mt-3 text-ink-600">Your hours, schedule and location aren’t shared by default. You decide whether your progress is public.</p>
          </div>
          <ul className="space-y-4 text-ink-600">
            <li>
              <b className="font-semibold text-brand-800">Verified hours only.</b> Hours count after an organizer confirms you were there. No one can type them in.
            </li>
            <li>
              <b className="font-semibold text-brand-800">Location stays yours.</b> It’s optional, rounded, and never shown to other people.
            </li>
            <li>
              <b className="font-semibold text-brand-800">Safe invite links.</b> Random, expiring links that don’t reveal your username or account details.
            </li>
            <li>
              <b className="font-semibold text-brand-800">Accessible by design.</b> Access details on every listing, keyboard support, adjustable text size and reduced motion.
            </li>
          </ul>
        </section>

        <section className="flex flex-col items-start justify-between gap-5 border-t border-line py-16 sm:flex-row sm:items-center">
          <h2 className="max-w-lg text-2xl font-bold tracking-tight">Finding your community should be as easy as finding something you care about.</h2>
          <Button size="lg" onClick={start}>
            Join VolunTerrier
          </Button>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-5 sm:flex-row sm:items-center">
          <Logo size={26} />
          <p className="text-sm text-ink-500">Built at Boston University · Social accessibility</p>
        </div>
      </footer>
    </div>
  )
}
