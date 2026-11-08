import { useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { Accessibility, CalendarClock, CalendarDays, Compass, Heart, Home as HomeIcon, LogOut, Menu, PlusCircle, Search as SearchIcon, Settings as SettingsIcon, TrendingUp, UserRound, Users, UsersRound } from 'lucide-react'
import { StoreProvider, useRoute, useStore, go, type Route } from './lib/store'
import { DetailsProvider, useDetails } from './components/Details'
import { A11yPanel } from './components/A11yPanel'
import { Avatar, Button, Logo, Modal, Toasts, cx, fmtDate, fmtRange } from './components/ui'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Discover from './pages/Discover'
import Matches from './pages/Matches'
import Communities from './pages/Communities'
import Create from './pages/Create'
import Profile from './pages/Profile'
import Home from './pages/Home'
import Search from './pages/Search'
import Schedule from './pages/Schedule'
import ProgressPage from './pages/Progress'
import Friends from './pages/Friends'
import PublicProfile from './pages/PublicProfile'
import SettingsPage from './pages/Settings'
import { InvitePage, Login, Register, Reset } from './pages/Auth'
import { ErrorBoundary } from './components/ErrorBoundary'

type NavItem = { id: Route; label: string; icon: typeof Compass }
const PRIMARY: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'search', label: 'Search', icon: SearchIcon },
]
const LIBRARY: NavItem[] = [
  { id: 'discover', label: 'Discover (swipe)', icon: Compass },
  { id: 'schedule', label: 'My Schedule', icon: CalendarDays },
  { id: 'progress', label: 'My Progress', icon: TrendingUp },
  { id: 'matches', label: 'Saved', icon: Heart },
]
const SOCIAL: NavItem[] = [
  { id: 'friends', label: 'Friends & Invites', icon: Users },
  { id: 'communities', label: 'Communities', icon: UsersRound },
]
const ACCOUNT: NavItem[] = [
  { id: 'profile', label: 'My Profile', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]
const MOBILE: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'discover', label: 'Swipe', icon: Compass },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
]
const APP_ROUTES: Route[] = ['home', 'discover', 'search', 'schedule', 'progress', 'friends', 'matches', 'communities', 'create', 'profile', 'settings', 'u']
const TITLES: Partial<Record<Route, string>> = {
  home: 'Home', discover: 'Discover', search: 'Search', schedule: 'My Schedule', progress: 'My Progress', friends: 'Friends', matches: 'Saved',
  communities: 'Communities', create: 'Create', profile: 'Profile', settings: 'Settings', login: 'Log in', register: 'Sign up', reset: 'Reset password', invite: 'Invitation', onboarding: 'Get started', u: 'Profile',
}

function useHtmlSettings() {
  const { state } = useStore()
  const s = state.settings
  useEffect(() => {
    const h = document.documentElement
    h.dataset.text = String(s.textScale)
    h.dataset.motion = s.reduceMotion ? 'reduce' : 'full'
    h.dataset.contrast = s.highContrast ? 'high' : 'normal'
    h.dataset.font = s.dyslexiaFont ? 'hyper' : 'default'
  }, [s])
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  return (
    <a
      href={`#/${item.id}`}
      aria-current={active ? 'page' : undefined}
      className={cx('group flex items-center gap-3 rounded-lg px-3 py-2 text-[0.95rem] font-medium transition-colors', active ? 'bg-brand-50/10 text-brand-50' : 'text-brand-50/65 hover:text-brand-50')}
    >
      <item.icon size={20} strokeWidth={active ? 2.4 : 1.8} className={active ? 'text-sage' : ''} />
      <span className="truncate">{item.label}</span>
      {!!badge && <span className="ml-auto text-xs font-semibold text-brand-50/60">{badge}</span>}
    </a>
  )
}

/** Spotify-style "now playing" bar → next commitment on your schedule */
function NextUp() {
  const { state } = useStore()
  const { openOpp } = useDetails()
  const now = Date.now()
  const next = state.opportunities.filter((o) => (o.iAmGoing || o.isMine) && o.endAt > now).sort((a, b) => a.startAt - b.startAt)[0]
  if (!next) return null
  const live = next.startAt <= now
  return (
    <button onClick={() => openOpp(next.id)} className="flex w-full items-center gap-3 rounded-lg border border-brand-50/10 p-2.5 text-left text-brand-50 hover:bg-brand-50/5" aria-label={`Next up: ${next.title}`}>
      <CalendarClock size={18} className="shrink-0 text-sage" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-sage">{live ? 'Happening now' : 'Next up'}</span>
        <span className="block truncate text-sm font-semibold">{next.title}</span>
        <span className="block truncate text-xs text-brand-50/70">{live ? fmtRange(next.startAt, next.endAt, next.timeZone) : fmtDate(next.startAt, { timeZone: next.timeZone })}</span>
      </span>
    </button>
  )
}

function ConflictDialog() {
  const { conflict, dismissConflict } = useStore()
  return (
    <Modal open={!!conflict} onClose={dismissConflict} label="Schedule conflict" top>
      {conflict && (
        <div className="p-6" role="alertdialog" aria-labelledby="conflict-title" aria-describedby="conflict-desc">
          <h2 id="conflict-title" className="pr-8 text-xl font-bold">
            You already have something planned during this time.
          </h2>
          <div id="conflict-desc" className="mt-3 rounded-2xl bg-surface p-4 text-sm">
            <p className="font-bold">{conflict.title}</p>
            {conflict.startAt > 0 && <p className="text-ink-500">{fmtDate(conflict.startAt, { timeZone: conflict.timeZone })} · {fmtRange(conflict.startAt, conflict.endAt, conflict.timeZone)}</p>}
          </div>
          <p className="mt-3 text-sm text-ink-500">To join this one, cancel the other commitment first.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={dismissConflict}>
              OK
            </Button>
            <Button
              onClick={() => {
                dismissConflict()
                go('schedule')
              }}
            >
              View my schedule
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Shell() {
  const route = useRoute()
  const { state, status, logout } = useStore()
  const [a11y, setA11y] = useState(false)
  const [more, setMore] = useState(false)
  useHtmlSettings()
  const user = state.user
  const isApp = APP_ROUTES.includes(route.name)

  useEffect(() => {
    if (status !== 'ready') return
    if (isApp && !user) go('login')
    else if (user && !user.onboarded && route.name !== 'onboarding' && route.name !== 'invite') go('onboarding')
    else if (user && ['login', 'register'].includes(route.name)) go('home')
  }, [isApp, user, status, route.name])

  useEffect(() => {
    const t = TITLES[route.name]
    document.title = t ? `${t} · VolunTerrier` : 'VolunTerrier — Find your people through doing good'
  }, [route.name])

  if (status === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-800" role="status" aria-label="Loading VolunTerrier">
        <img src="/logo-192.png" alt="" className="h-20 w-20 animate-pulse rounded-xl" />
      </div>
    )

  if (route.name === 'login') return <Login />
  if (route.name === 'register') return <Register />
  if (route.name === 'reset') return <Reset />
  if (route.name === 'invite') return <InvitePage token={route.param} />
  if (route.name === 'onboarding' && user) return <Onboarding />
  if (!isApp || !user) return <Landing />

  const pages: Partial<Record<Route, React.ReactNode>> = {
    home: <Home />, discover: <Discover />, search: <Search />, schedule: <Schedule />, progress: <ProgressPage />, friends: <Friends />,
    matches: <Matches />, communities: <Communities />, create: <Create />, profile: <Profile />, settings: <SettingsPage />, u: <PublicProfile username={route.param} />,
  }
  const upcoming = state.opportunities.filter((o) => (o.iAmGoing || o.isMine) && o.endAt > Date.now()).length

  return (
    <div className="min-h-screen bg-brand-50 lg:flex">
      <a href="#app-main" className="sr-only-focusable fixed left-4 top-4 z-50 rounded-full bg-brand-50 px-4 py-2 text-brand-800">
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-brand-800 px-3 py-5 lg:flex" aria-label="Sidebar">
        <a href="#/home" className="mb-6 block px-3" aria-label="VolunTerrier home">
          <Logo size={32} light />
        </a>
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <nav aria-label="Main" className="space-y-0.5">
            {PRIMARY.map((n) => (
              <NavLink key={n.id} item={n} active={route.name === n.id} />
            ))}
          </nav>
          <p className="px-3 pb-1.5 pt-6 text-xs font-medium text-brand-50/45">Your volunteering</p>
          <nav aria-label="Your volunteering" className="space-y-0.5">
            {LIBRARY.map((n) => (
              <NavLink key={n.id} item={n} active={route.name === n.id} badge={n.id === 'schedule' ? upcoming : undefined} />
            ))}
          </nav>
          <p className="px-3 pb-1.5 pt-6 text-xs font-medium text-brand-50/45">Social</p>
          <nav aria-label="Social" className="space-y-0.5">
            {SOCIAL.map((n) => (
              <NavLink key={n.id} item={n} active={route.name === n.id} />
            ))}
          </nav>
          <p className="px-3 pb-1.5 pt-6 text-xs font-medium text-brand-50/45">Account</p>
          <nav aria-label="Account" className="space-y-0.5">
            {ACCOUNT.map((n) => (
              <NavLink key={n.id} item={n} active={route.name === n.id} />
            ))}
            <button onClick={() => setA11y(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[0.95rem] font-medium text-brand-50/65 hover:text-brand-50">
              <Accessibility size={20} strokeWidth={1.8} /> Accessibility
            </button>
          </nav>
        </div>
        <div className="space-y-3 pt-4">
          <a href="#/create" className="flex items-center justify-center gap-2 rounded-full bg-sage px-4 py-2.5 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-200">
            <PlusCircle size={17} /> Post an opportunity
          </a>
          <NextUp />
        </div>
      </aside>

      {/* main panel */}
      <div className="min-w-0 flex-1">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-800 px-4 py-2.5 lg:hidden">
          <a href="#/home" aria-label="VolunTerrier home">
            <Logo size={30} light />
          </a>
          <div className="flex items-center gap-1">
            <button onClick={() => setA11y(true)} className="rounded-full p-2 text-brand-50 hover:bg-brand-50/10" aria-label="Accessibility settings">
              <Accessibility size={22} />
            </button>
            <a href="#/profile" aria-label="Your profile">
              <Avatar name={user.name} avatar={user.avatar} size={34} />
            </a>
          </div>
        </header>
        {/* desktop top bar */}
        <div className="sticky top-0 z-20 hidden items-center justify-end gap-2 border-b border-line bg-brand-50/95 px-8 py-2.5 backdrop-blur lg:flex">
          <a href={`#/u/${user.username}`} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium hover:bg-brand-100">
            <Avatar name={user.name} avatar={user.avatar} size={28} /> {user.name.split(' ')[0]}
          </a>
          <button onClick={() => logout().then(() => go(''))} className="rounded-full p-2 text-brand-700 hover:bg-brand-100" aria-label="Log out" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
        <main id="app-main" className="pb-28 lg:pb-10">
          <ErrorBoundary key={route.name}>{pages[route.name]}</ErrorBoundary>
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-50/10 bg-brand-800 pb-safe lg:hidden" aria-label="Main">
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {MOBILE.map((n) => {
            const on = route.name === n.id
            return (
              <li key={n.id} className="flex-1">
                <a href={`#/${n.id}`} aria-current={on ? 'page' : undefined} className={cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', on ? 'text-sage' : 'text-brand-50/60')}>
                  <n.icon size={22} strokeWidth={on ? 2.4 : 1.8} />
                  {n.label}
                </a>
              </li>
            )
          })}
          <li className="flex-1">
            <button onClick={() => setMore(true)} aria-haspopup="dialog" className={cx('flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium', ['progress', 'friends', 'matches', 'communities', 'profile', 'settings', 'create'].includes(route.name) ? 'text-sage' : 'text-brand-50/60')}>
              <Menu size={22} strokeWidth={1.8} /> More
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} label="More">
        <div className="p-5">
          <div className="flex items-center gap-3 pr-10">
            <Avatar name={user.name} avatar={user.avatar} size={44} />
            <div>
              <p className="font-bold">{user.name}</p>
              <p className="text-sm text-ink-500">@{user.username}</p>
            </div>
          </div>
          <nav className="mt-4 divide-y divide-line" aria-label="More pages" onClick={() => setMore(false)}>
            {[...LIBRARY.slice(1), ...SOCIAL, ...ACCOUNT, { id: 'create' as Route, label: 'Post an opportunity', icon: PlusCircle }].map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={cx('flex items-center gap-3 py-3 font-medium', route.name === n.id ? 'text-moss' : 'text-brand-800')}>
                <n.icon size={19} strokeWidth={1.8} /> {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-3">
            <NextUp />
          </div>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => logout().then(() => { setMore(false); go('') })}>
            <LogOut size={16} /> Log out
          </Button>
        </div>
      </Modal>

      <Modal open={a11y} onClose={() => setA11y(false)} label="Accessibility settings">
        <div className="p-6">
          <h2 className="flex items-center gap-2 pr-10 text-xl font-bold">
            <Accessibility className="text-moss" /> Accessibility
          </h2>
          <p className="mb-4 text-sm text-ink-500">Saved on this device. Applies everywhere.</p>
          <A11yPanel />
        </div>
      </Modal>
      <ConflictDialog />
    </div>
  )
}

function Root() {
  const { state } = useStore()
  return (
    <MotionConfig reducedMotion={state.settings.reduceMotion ? 'always' : 'user'}>
      <DetailsProvider>
        <Shell />
        <Toasts />
      </DetailsProvider>
    </MotionConfig>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  )
}
