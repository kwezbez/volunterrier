import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Info, RotateCcw, SlidersHorizontal, X, Keyboard } from 'lucide-react'
import { useStore, go } from '../lib/store'
import { rankOpportunities, WEIGHTS } from '../lib/recommend'
import { SwipeCard, type Dir, type SwipeHandle } from '../components/SwipeCard'
import { useDetails } from '../components/Details'
import { AvatarStack, Button, Chip, EmptyState, cx, fmtDate, Img } from '../components/ui'
import { CATEGORIES, catOf } from '../data/taxonomy'
import type { AccessId, CategoryId, SocialId } from '../types'

type Filter = { kind: 'access'; id: AccessId } | { kind: 'social'; id: SocialId }
const QUICK: { key: string; label: string; f: Filter }[] = [
  { key: 'solo', label: 'Solo-friendly', f: { kind: 'social', id: 'solo' } },
  { key: 'beginner', label: 'Beginner', f: { kind: 'social', id: 'beginner' } },
  { key: 'quiet', label: 'Quiet roles', f: { kind: 'social', id: 'quiet' } },
  { key: 'remote', label: 'Remote', f: { kind: 'access', id: 'remote' } },
  { key: 'wheelchair', label: 'Wheelchair', f: { kind: 'access', id: 'wheelchair' } },
  { key: 'sensory', label: 'Sensory-friendly', f: { kind: 'access', id: 'sensory' } },
  { key: 'asl', label: 'ASL', f: { kind: 'access', id: 'asl' } },
  { key: 'step-free', label: 'Step-free', f: { kind: 'access', id: 'step-free' } },
]

export default function Discover() {
  const { state, like, skip, undo, resetSwipes, setJoined, toast } = useStore()
  const { openOpp } = useDetails()
  const user = state.user!
  const [filters, setFilters] = useState<string[]>([])
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [history, setHistory] = useState<{ id: string; dir: Dir }[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [likedPop, setLikedPop] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const topRef = useRef<SwipeHandle>(null)
  const busy = useRef(false)
  const reduceMotion = state.settings.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const [now] = useState(() => Date.now())
  const ranked = useMemo(() => rankOpportunities(user, state.opportunities), [user, state.opportunities])
  const deck = useMemo(() => {
    const seen = new Set([...state.liked, ...state.skipped, ...state.joined])
    return ranked.filter((r) => {
      if (seen.has(r.opp.id)) return false
      if (r.opp.endAt < now || r.opp.isMine) return false
      if (cat !== 'all' && r.opp.category !== cat) return false
      return filters.every((k) => {
        const f = QUICK.find((q) => q.key === k)!.f
        if (f.kind === 'access') return r.opp.access.includes(f.id) || (f.id === 'remote' && r.opp.area === 'remote')
        return r.opp.social.includes(f.id)
      })
    })
  }, [ranked, state.liked, state.skipped, state.joined, filters, cat, now])

  const top = deck[0]

  const decide = (dir: Dir) => {
    if (!top) return
    busy.current = false
    const id = top.opp.id
    setHistory((h) => [...h, { id, dir }])
    if (dir === 'right') {
      like(id)
      setLikedPop(id)
      setAnnounce(`Liked ${top.opp.title}. Added to matches.`)
    } else {
      skip(id)
      setAnnounce(`Skipped ${top.opp.title}.`)
    }
  }

  const trigger = (dir: Dir) => {
    if (!top || busy.current) return
    busy.current = true
    if (topRef.current) topRef.current.fly(dir)
    else decide(dir)
  }

  const doUndo = () => {
    const last = history[history.length - 1]
    if (!last) return
    undo(last.id)
    setHistory((h) => h.slice(0, -1))
    setLikedPop(null)
    setAnnounce('Undid last swipe.')
  }

  useEffect(() => {
    if (!likedPop) return
    const t = setTimeout(() => setLikedPop(null), 4500)
    return () => clearTimeout(t)
  }, [likedPop])

  // keyboard: ← skip, → like, Enter details, Backspace / U undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.key === 'ArrowRight') { e.preventDefault(); trigger('right') }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); trigger('left') }
      else if ((e.key === 'Enter' || e.key === 'ArrowUp') && el.id === 'deck' && top) { e.preventDefault(); openOpp(top.opp.id) }
      else if (e.key.toLowerCase() === 'u' || e.key === 'Backspace') doUndo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pop = likedPop ? state.opportunities.find((o) => o.id === likedPop) : null
  const popPeople = pop ? pop.friendsGoing.map((f) => ({ name: f.displayName, avatar: f.avatar })) : []
  const matchCount = state.liked.length

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-8 pt-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:pt-8">
      <section aria-labelledby="discover-title" className="mx-auto w-full min-w-0 max-w-[430px]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 id="discover-title" className="text-2xl font-bold tracking-tight">Discover</h1>
            <p className="text-sm text-ink-500">Swipe right to like, left to skip.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go('matches')}
              className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm font-bold text-brand-600"
              aria-label={`${matchCount} matches. View matches`}
            >
              <Heart size={16} className="fill-brand-500 text-brand-500" /> {matchCount}
            </button>
            <button
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              aria-controls="filters"
              className={cx('flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold', showFilters || filters.length || cat !== 'all' ? 'bg-ink-900 text-white' : 'bg-surface text-ink-700')}
            >
              <SlidersHorizontal size={16} /> Filters{filters.length + (cat !== 'all' ? 1 : 0) ? ` · ${filters.length + (cat !== 'all' ? 1 : 0)}` : ''}
            </button>
          </div>
        </div>

        {/* quick filters */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Quick accessibility and social filters">
          {QUICK.map((q) => (
            <Chip key={q.key} size="sm" selected={filters.includes(q.key)} onClick={() => setFilters((f) => (f.includes(q.key) ? f.filter((x) => x !== q.key) : [...f, q.key]))}>
              {q.label}
            </Chip>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div id="filters" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 rounded-2xl bg-surface p-4">
                <p className="text-sm font-bold">Category</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip size="sm" selected={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
                  {CATEGORIES.map((c) => (
                    <Chip key={c.id} size="sm" selected={cat === c.id} onClick={() => setCat(c.id)}>
                      {c.label}
                    </Chip>
                  ))}
                </div>
                <button className="mt-3 text-sm font-semibold text-brand-600 underline-offset-2 hover:underline" onClick={() => { setFilters([]); setCat('all') }}>
                  Clear all filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* deck */}
        <div
          id="deck"
          tabIndex={0}
          aria-label="Opportunity cards. Press right arrow to like, left arrow to skip, Enter for details, U to undo."
          aria-describedby="deck-help"
          className="relative mt-3 h-[clamp(21.5rem,calc(100dvh-20rem),36rem)] rounded-2xl lg:mt-4 lg:h-[clamp(28rem,calc(100dvh-16rem),36rem)]"
        >
          {deck.length === 0 ? (
            <div className="absolute inset-0">
              <EmptyState
                
                title={filters.length || cat !== 'all' ? 'No matches for these filters' : 'You’re all caught up!'}
                body={filters.length || cat !== 'all' ? 'Try removing a filter to see more opportunities.' : `You’ve swiped through everything. ${matchCount} matches are waiting for you.`}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {filters.length || cat !== 'all' ? (
                      <Button onClick={() => { setFilters([]); setCat('all') }}>Clear filters</Button>
                    ) : (
                      <>
                        <Button onClick={() => go('matches')}>See matches</Button>
                        <Button variant="secondary" onClick={() => { resetSwipes(); setHistory([]) }}>
                          <RotateCcw size={16} /> See skipped again
                        </Button>
                      </>
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            deck
              .slice(0, 3)
              .map((r, i) => (
                <SwipeCard
                  key={r.opp.id}
                  ref={i === 0 ? topRef : undefined}
                  rec={r}
                  depth={i}
                  reduceMotion={reduceMotion}
                  onDecide={decide}
                  onOpen={() => openOpp(r.opp.id)}
                />
              ))
              .reverse()
          )}
        </div>
        <p id="deck-help" className="sr-only">
          Swiping is optional. Use the Skip, Details and Like buttons below the card, or keyboard arrows.
        </p>
        <p className="sr-only" aria-live="polite">{announce}</p>

        {/* controls — swipe is never the only way */}
        <div className="mt-4 flex items-center justify-center gap-3 sm:mt-5 sm:gap-4" role="group" aria-label="Card actions">
          <CtrlButton label="Undo last swipe" onClick={doUndo} disabled={!history.length} small>
            <RotateCcw size={20} />
          </CtrlButton>
          <CtrlButton label="Skip" onClick={() => trigger('left')} disabled={!top} tone="skip">
            <X size={30} strokeWidth={3} />
          </CtrlButton>
          <CtrlButton label="View details" onClick={() => top && openOpp(top.opp.id)} disabled={!top} small>
            <Info size={20} />
          </CtrlButton>
          <CtrlButton label="Like — I’m interested" onClick={() => trigger('right')} disabled={!top} tone="like">
            <Heart size={30} strokeWidth={2.5} className="fill-white" />
          </CtrlButton>
        </div>
        <p className="mt-3 hidden items-center justify-center gap-1.5 text-xs text-ink-400 sm:flex">
          <Keyboard size={14} aria-hidden /> ← skip · → like · Enter details · U undo
        </p>

        <AnimatePresence>
          {pop && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-xl bg-ink-900 p-4 text-white lg:bottom-8"
              role="status"
            >
              <div className="flex items-center gap-3">
                <Img src={pop.image} alt="" category={pop.category} className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Liked</p>
                  <p className="truncate text-sm text-white/70">
                    {popPeople.length ? `${popPeople[0]!.name.split(' ')[0]}${popPeople.length > 1 ? ` + ${popPeople.length - 1} friends` : ''} ${popPeople.length > 1 ? 'are' : 'is'} going` : pop.goingCount ? `${pop.goingCount} people are going` : 'Match to add it to your schedule'}
                  </p>
                </div>
                <AvatarStack people={popPeople} size={26} max={3} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={async () => { setLikedPop(null); if (await setJoined(pop.id, true)) toast('Matched. It’s on your schedule.', 'info') }}>
                  Match
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 !border-brand-50/20 !bg-brand-50/10 !text-white" onClick={() => { openOpp(pop.id); setLikedPop(null) }}>
                  Details
                </Button>
                <button className="rounded-full px-3 text-sm font-semibold text-white/70 hover:text-white" onClick={() => setLikedPop(null)}>
                  Keep swiping
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <Sidebar />
    </div>
  )
}

function CtrlButton({ label, onClick, disabled, children, tone, small }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; tone?: 'like' | 'skip'; small?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'hc-border flex items-center justify-center rounded-full transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100',
        small ? 'h-11 w-11 bg-surface text-ink-500 sm:h-12 sm:w-12' : 'h-14 w-14 sm:h-[68px] sm:w-[68px]',
        tone === 'like' && 'bg-brand-gradient text-white',
        tone === 'skip' && 'border border-ink-100 bg-surface text-ink-500',
      )}
    >
      {children}
    </button>
  )
}

function Sidebar() {
  const { state } = useStore()
  const { openOpp } = useDetails()
  const user = state.user!
  const upcoming = state.opportunities
    .filter((o) => state.joined.includes(o.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  return (
    <aside className="hidden space-y-5 pt-14 lg:block" aria-label="Your discovery summary">
      <div className="border-b border-line pb-5">
        <p className="font-semibold">Tuned to you</p>
        <p className="mt-1 text-sm text-ink-500">Your feed is ranked by what you told us. Edit your profile and it re-ranks instantly.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {user.interests.map((i) => (
            <Chip key={i} as="span" size="sm">
              {catOf(i).label.split(' ')[0]}
            </Chip>
          ))}
          {user.activities.slice(0, 4).map((a) => (
            <Chip key={a} as="span" size="sm" selected>
              {a}
            </Chip>
          ))}
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink-700">How ranking works</summary>
          <ul className="mt-2 space-y-1 text-ink-500">
            <li>Interest match <b className="text-ink-800">+{WEIGHTS.interest}</b></li>
            <li>Each favorite activity <b className="text-ink-800">+{WEIGHTS.activity}</b></li>
            <li>Each shared cause <b className="text-ink-800">+{WEIGHTS.cause}</b></li>
            <li>Availability fit <b className="text-ink-800">+{WEIGHTS.availability}</b></li>
            <li>Close to you <b className="text-ink-800">up to +{WEIGHTS.locationMax}</b></li>
            <li>Each access need met <b className="text-ink-800">+{WEIGHTS.accessMatch}</b></li>
            <li>Each skill used <b className="text-ink-800">+{WEIGHTS.skill}</b></li>
            <li>Social comfort match <b className="text-ink-800">+{WEIGHTS.social}</b></li>
          </ul>
        </details>
      </div>

      <div className="border-b border-line pb-5">
        <p className="font-semibold">Coming up</p>
        {upcoming.length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">Nothing matched yet. Open a card and tap “Match”.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {upcoming.map((o) => (
              <li key={o.id}>
                <button className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-ink-50" onClick={() => openOpp(o.id)}>
                  <Img src={o.image} alt="" category={o.category} className="h-11 w-11 shrink-0 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{o.title}</span>
                    <span className="text-xs text-ink-500">{fmtDate(o.startAt, { timeZone: o.timeZone })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-ink-500">
        Have an idea?{' '}
        <button onClick={() => go('create')} className="font-medium text-brand-800 underline underline-offset-2">
          Post an opportunity
        </button>
      </p>
    </aside>
  )
}
