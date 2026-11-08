import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Group, Me, Opportunity, Settings, UserProfile } from '../types'
import { ApiError, del, get, patch, post, put } from './api'
import { freshIds } from './recommend'

// Display/accessibility preferences are per-device conveniences, so they stay in localStorage.
const SETTINGS_KEY = 'volunterrier:display'
const defaultSettings: Settings = { textScale: 1, reduceMotion: false, highContrast: false, dyslexiaFont: false }
function loadSettings(): Settings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return defaultSettings
  }
}

interface ApiMe {
  username: string
  displayName: string
  profile: Omit<UserProfile, 'id' | 'name'>
  onboarded: boolean
  settings: Me['settings']
  home: Me['home']
  memberSince: number
}
export function toMe(u: ApiMe): Me {
  const p = u.profile
  return {
    id: u.username,
    username: u.username,
    name: u.displayName,
    avatar: p.avatar ?? { kind: 'initials', value: '', color: 0 },
    bio: p.bio ?? '',
    pronouns: p.pronouns ?? '',
    school: p.school ?? '',
    interests: p.interests ?? [],
    causes: p.causes ?? [],
    skills: p.skills ?? [],
    activities: p.activities ?? [],
    availability: p.availability ?? [],
    area: p.area ?? 'bu',
    maxDistance: p.maxDistance ?? 5,
    access: p.access ?? [],
    social: p.social ?? [],
    onboarded: u.onboarded,
    settings: u.settings,
    home: u.home,
    memberSince: u.memberSince,
  }
}
export const profilePayload = (u: UserProfile) => ({
  displayName: u.name,
  avatar: u.avatar,
  bio: u.bio,
  pronouns: u.pronouns ?? '',
  school: u.school ?? '',
  interests: u.interests,
  causes: u.causes,
  skills: u.skills,
  activities: u.activities,
  availability: u.availability,
  area: u.area,
  maxDistance: u.maxDistance,
  access: u.access,
  social: u.social,
})

export interface AppState {
  user: Me | null
  opportunities: Opportunity[]
  groups: Group[]
  liked: string[]
  skipped: string[]
  saved: string[]
  joined: string[] // derived from opportunities.iAmGoing
  buddy: string[] // derived from opportunities.myBuddy
  groupsJoined: string[]
  settings: Settings
}

export interface Toast {
  id: number
  text: string
  tone?: 'success' | 'info' | 'love' | 'error'
}
export interface Conflict {
  title: string
  startAt: number
  endAt: number
  timeZone: string
}

const toggle = (arr: string[], id: string, on?: boolean) => {
  const has = arr.includes(id)
  const want = on ?? !has
  if (want && !has) return [...arr, id]
  if (!want && has) return arr.filter((x) => x !== id)
  return arr
}

function useStoreValue() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [user, setUserState] = useState<Me | null>(null)
  const [opportunities, setOpps] = useState<Opportunity[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [liked, setLiked] = useState<string[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [settings, setSettingsState] = useState<Settings>(loadSettings)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [dataVersion, setDataVersion] = useState(0) // bump to tell pages to refetch
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* private mode — fine */
    }
  }, [settings])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong.', 'error'), [toast])

  const loadData = useCallback(async () => {
    const [o, s, g] = await Promise.all([
      get<{ opportunities: Opportunity[] }>('/opportunities'),
      get<{ liked: string[]; skipped: string[]; saved: string[]; groupsJoined: string[] }>('/me/state'),
      get<{ groups: Group[] }>('/groups'),
    ])
    setOpps(o.opportunities)
    setLiked(s.liked)
    setSkipped(s.skipped)
    setSaved(s.saved)
    setGroups(g.groups)
    setDataVersion((v) => v + 1)
  }, [])

  const refreshOpp = useCallback(async (id: string) => {
    try {
      const { opportunity } = await get<{ opportunity: Opportunity }>(`/opportunities/${id}`)
      setOpps((list) => (list.some((o) => o.id === id) ? list.map((o) => (o.id === id ? { ...o, ...opportunity } : o)) : [...list, opportunity]))
      return opportunity
    } catch {
      return null
    }
  }, [])

  // initial session check
  useEffect(() => {
    get<{ user: ApiMe | null }>('/auth/session')
      .then(async ({ user }) => {
        if (user) {
          setUserState(toMe(user))
          loadedFor.current = user.username
          await loadData().catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setStatus('ready'))
  }, [loadData])

  const signedIn = useCallback(
    async (u: ApiMe) => {
      setUserState(toMe(u))
      if (loadedFor.current !== u.username) {
        loadedFor.current = u.username
        await loadData().catch(() => {})
      }
    },
    [loadData],
  )

  const actions = useMemo(
    () => ({
      signedIn,
      loadData,
      refreshOpp,
      setUserFromApi: (u: ApiMe) => setUserState(toMe(u)),
      logout: async () => {
        await post('/auth/logout').catch(() => {})
        loadedFor.current = null
        setUserState(null)
        setOpps([])
        setGroups([])
        setLiked([])
        setSkipped([])
        setSaved([])
      },
      updateUser: async (u: UserProfile) => {
        const res = await put<{ user: ApiMe }>('/me/profile', profilePayload(u))
        setUserState(toMe(res.user))
      },
      updatePrivacy: async (patchBody: Partial<Me['settings']>) => {
        const res = await patch<{ user: ApiMe }>('/me/settings', patchBody)
        setUserState(toMe(res.user))
      },
      setHome: async (home: { label: string; lat: number; lng: number } | null) => {
        const res = home ? await put<{ user: ApiMe }>('/me/location', home) : await del<{ user: ApiMe }>('/me/location')
        setUserState(toMe(res.user))
      },
      like: (id: string) => {
        setLiked((l) => toggle(l, id, true))
        setSkipped((s) => toggle(s, id, false))
        put(`/me/swipes/${id}`, { decision: 'like' }).catch(fail)
      },
      skip: (id: string) => {
        setSkipped((s) => toggle(s, id, true))
        setLiked((l) => toggle(l, id, false))
        put(`/me/swipes/${id}`, { decision: 'skip' }).catch(fail)
      },
      undo: (id: string) => {
        setSkipped((s) => toggle(s, id, false))
        setLiked((l) => toggle(l, id, false))
        del(`/me/swipes/${id}`).catch(fail)
      },
      unlike: (id: string) => {
        setLiked((l) => toggle(l, id, false))
        setSkipped((s) => toggle(s, id, true))
        put(`/me/swipes/${id}`, { decision: 'skip' }).catch(fail)
      },
      resetSwipes: () => {
        setSkipped([])
        del('/me/swipes').catch(fail)
      },
      toggleSaved: (id: string) => {
        setSaved((s) => {
          const on = !s.includes(id)
          ;(on ? put(`/me/saves/${id}`) : del(`/me/saves/${id}`)).catch(fail)
          return toggle(s, id, on)
        })
      },
      /** sign up / cancel. Returns true on success. Shows the conflict popup on a schedule clash. */
      setJoined: async (id: string, on: boolean, opts: { buddy?: boolean } = {}) => {
        try {
          if (on) await post(`/opportunities/${id}/signup`, { buddy: !!opts.buddy })
          else await del(`/opportunities/${id}/signup`)
          if (on) setLiked((l) => toggle(l, id, true))
          await refreshOpp(id)
          return true
        } catch (e) {
          if (e instanceof ApiError && e.code === 'SCHEDULE_CONFLICT') setConflict((e.data.conflict as Conflict) ?? { title: 'another event', startAt: 0, endAt: 0, timeZone: 'UTC' })
          else fail(e)
          await refreshOpp(id)
          return false
        }
      },
      toggleBuddy: async (id: string, on: boolean) => {
        try {
          await patch(`/opportunities/${id}/signup`, { buddy: on })
          await refreshOpp(id)
        } catch (e) {
          fail(e)
        }
      },
      setGroupJoined: async (id: string, on: boolean) => {
        setGroups((gs) => gs.map((g) => (g.id === id && g.joined !== on ? { ...g, joined: on, members: g.members + (on ? 1 : -1) } : g)))
        try {
          if (on) await put(`/groups/${id}/membership`)
          else await del(`/groups/${id}/membership`)
        } catch (e) {
          fail(e)
          setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, joined: !on, members: g.members + (on ? -1 : 1) } : g)))
        }
      },
      createOpportunity: async (body: Record<string, unknown>) => {
        const res = await post<{ opportunity: Opportunity; geocoded: boolean }>('/opportunities', body)
        freshIds.add(res.opportunity.id)
        setOpps((l) => [res.opportunity, ...l])
        return res
      },
      deleteOpportunity: async (id: string) => {
        await del(`/opportunities/${id}`)
        setOpps((l) => l.filter((o) => o.id !== id))
      },
      setSettings: (p: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...p })),
      dismissConflict: () => setConflict(null),
    }),
    [fail, loadData, refreshOpp, signedIn],
  )

  const state: AppState = useMemo(
    () => ({
      user,
      opportunities,
      groups,
      liked,
      skipped,
      saved,
      joined: opportunities.filter((o) => o.iAmGoing).map((o) => o.id),
      buddy: opportunities.filter((o) => o.myBuddy).map((o) => o.id),
      groupsJoined: groups.filter((g) => g.joined).map((g) => g.id),
      settings,
    }),
    [user, opportunities, groups, liked, skipped, saved, settings],
  )

  return { state, status, toasts, toast, fail, conflict, dataVersion, ...actions }
}

type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside provider')
  return v
}

// ---- tiny hash router: #/name or #/name/param ----
export type Route =
  | ''
  | 'login'
  | 'register'
  | 'reset'
  | 'invite'
  | 'onboarding'
  | 'home'
  | 'discover'
  | 'search'
  | 'schedule'
  | 'progress'
  | 'friends'
  | 'matches'
  | 'communities'
  | 'create'
  | 'profile'
  | 'settings'
  | 'u'

const parse = () => {
  const [name = '', ...rest] = window.location.hash.replace(/^#\/?/, '').split('?')[0]!.split('/')
  return { name: name as Route, param: rest.join('/') }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (r: Route, param?: string) => {
  window.location.hash = `/${r}${param ? `/${param}` : ''}`
}
