import { useCallback, useEffect, useMemo, useState } from 'react'
import { Crosshair, List, LocateFixed, Map as MapIcon, Save, Search as SearchIcon, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../lib/store'
import { get } from '../lib/api'
import { MapView } from '../components/MapView'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { OppRow } from '../components/OppCard'
import { Button, Chip, EmptyState, SectionTitle, cx } from '../components/ui'
import { inputCls } from '../components/ProfileFields'
import { CATEGORIES } from '../data/taxonomy'
import type { CategoryId, Opportunity } from '../types'

const RADII = [5, 10, 25, 50]
type DateFilter = 'any' | 'today' | 'weekend' | 'week' | 'month' | 'custom'

function dateRange(f: DateFilter, from: string, to: string): { from?: number; to?: number } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const day = 86400_000
  if (f === 'today') return { from: Date.now(), to: start.getTime() + day }
  if (f === 'week') return { from: Date.now(), to: start.getTime() + 7 * day }
  if (f === 'month') return { from: Date.now(), to: start.getTime() + 30 * day }
  if (f === 'weekend') {
    const dow = start.getDay()
    const sat = start.getTime() + ((6 - dow + 7) % 7) * day - (dow === 0 ? day : 0)
    return { from: Math.max(Date.now(), sat), to: sat + 2 * day }
  }
  if (f === 'custom') return { from: from ? new Date(`${from}T00:00`).getTime() : undefined, to: to ? new Date(`${to}T23:59`).getTime() : undefined }
  return {}
}

interface Result {
  origin: { label: string; lat: number; lng: number }
  radius: number
  results: Opportunity[]
}

export default function Search() {
  const { state, setHome, toast, fail, dataVersion } = useStore()
  const user = state.user!
  const [q, setQ] = useState(user.home?.label ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [radius, setRadius] = useState(10)
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [dateF, setDateF] = useState<DateFilter>('any')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [remote, setRemote] = useState(true)
  const [sort, setSort] = useState<'distance' | 'date'>('distance')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [showFilters, setShowFilters] = useState(false)
  const [data, setData] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  const run = useCallback(
    async (opts: { q?: string; coords?: { lat: number; lng: number } | null } = {}) => {
      const c = opts.coords !== undefined ? opts.coords : coords
      const query = opts.q ?? q
      if (!c && !query.trim()) {
        setError('Enter a city, ZIP code or address — or use your location.')
        return
      }
      setLoading(true)
      setError(null)
      const p = new URLSearchParams({ radius: String(radius), includeRemote: String(remote) })
      if (c) {
        p.set('lat', String(c.lat))
        p.set('lng', String(c.lng))
      } else p.set('q', query.trim())
      if (category) p.set('category', category)
      const r = dateRange(dateF, from, to)
      if (r.from) p.set('from', String(r.from))
      if (r.to) p.set('to', String(r.to))
      try {
        setData(await get<Result>(`/opportunities/search?${p}`))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed.')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [coords, q, radius, remote, category, dateF, from, to],
  )

  // initial search from saved home location (coarse), and re-run when filters change
  useEffect(() => {
    if (coords || q.trim() || user.home) run(user.home && !coords && q === user.home.label ? { coords: { lat: user.home.lat, lng: user.home.lng } } : {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, category, dateF, from, to, remote, dataVersion])

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast('Your browser doesn’t support location. Type a place instead.', 'info')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // round to ~100 m before it ever leaves the device
        const c = { lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 }
        setCoords(c)
        setQ('')
        run({ coords: c, q: '' })
      },
      () => toast('Location permission was denied — no problem, type a place instead.', 'info'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  const results = useMemo(() => {
    const list = data?.results ?? []
    return sort === 'date' ? [...list].sort((a, b) => a.startAt - b.startAt) : list
  }, [data, sort])
  const mapped = results.filter((o) => o.lat != null)
  const activeFilters = (category ? 1 : 0) + (dateF !== 'any' ? 1 : 0) + (remote ? 0 : 1)

  return (
    <div className="px-4 pb-10 pt-6 sm:px-8 sm:pt-4">
      <SectionTitle eyebrow="Search" title="Find opportunities near you" sub="Search by city, neighborhood, ZIP code or address." />

      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          setCoords(null)
          run({ coords: null })
        }}
        role="search"
      >
        <label className="hc-border flex flex-1 items-center gap-2 rounded-full border border-brand-300 bg-brand-50 px-4 focus-within:ring-4 focus-within:ring-sage/50">
          <SearchIcon size={20} className="shrink-0 text-moss" aria-hidden />
          <span className="sr-only">City, ZIP code or address</span>
          <input
            value={coords ? 'Your current location' : q}
            onChange={(e) => {
              setCoords(null)
              setQ(e.target.value)
            }}
            placeholder="e.g. Cambridge, 02215, or 775 Commonwealth Ave"
            className="w-full bg-transparent py-3.5 outline-none placeholder:text-ink-400"
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </Button>
          <Button type="button" size="lg" variant="secondary" onClick={useMyLocation} title="Use my current location (optional)">
            <LocateFixed size={18} /> <span className="hidden md:inline">Use my location</span>
          </Button>
        </div>
      </form>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
        <ShieldCheck size={13} aria-hidden /> Location is optional. Your position is rounded, used only for this search, and never shown to anyone.
      </p>

      {/* radius + filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-surface p-1" role="radiogroup" aria-label="Search radius">
          {RADII.map((r) => (
            <button key={r} role="radio" aria-checked={radius === r} onClick={() => setRadius(r)} className={cx('rounded-full px-3.5 py-1.5 text-sm font-bold transition', radius === r ? 'bg-moss text-white' : 'text-brand-700 hover:bg-surface-hover')}>
              {r} mi
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-controls="search-filters" className={cx('flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold', showFilters || activeFilters ? 'bg-brand-800 text-brand-50' : 'bg-surface text-brand-800')}>
          <SlidersHorizontal size={15} /> Filters{activeFilters ? ` · ${activeFilters}` : ''}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as 'distance' | 'date')} className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 font-semibold">
            <option value="distance">Nearest first</option>
            <option value="date">Soonest first</option>
          </select>
        </label>
      </div>

      {showFilters && (
        <div id="search-filters" className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl bg-surface p-4 md:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Date</legend>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['any', 'Any time'],
                  ['today', 'Today'],
                  ['weekend', 'This weekend'],
                  ['week', 'Next 7 days'],
                  ['month', 'Next 30 days'],
                  ['custom', 'Pick dates'],
                ] as [DateFilter, string][]
              ).map(([v, l]) => (
                <Chip key={v} size="sm" selected={dateF === v} onClick={() => setDateF(v)}>
                  {l}
                </Chip>
              ))}
            </div>
            {dateF === 'custom' && (
              <div className="mt-2 flex gap-2">
                <label className="flex-1 text-xs font-semibold">
                  From
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cx(inputCls, 'mt-1 py-2')} />
                </label>
                <label className="flex-1 text-xs font-semibold">
                  To
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cx(inputCls, 'mt-1 py-2')} />
                </label>
              </div>
            )}
          </fieldset>
          <div className="space-y-3">
            <label className="block text-sm font-bold">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | '')} className={cx(inputCls, 'mt-2 py-2')}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="h-5 w-5 accent-[#717744]" /> Include remote / online opportunities
            </label>
            <button className="text-sm font-bold text-brand-700 underline" onClick={() => { setCategory(''); setDateF('any'); setRemote(true) }}>
              Reset filters
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-brand-800 px-4 py-3 text-sm font-semibold text-brand-50">
          {error}
        </p>
      )}

      {!data && !error && !loading && (
        <div className="mt-6">
          <EmptyState title="Where do you want to help?" body="Type a city, neighborhood or ZIP code above — try “Boston”, “Cambridge” or “02215” — or use your location." />
        </div>
      )}

      {data && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-600" aria-live="polite">
              <b className="text-brand-800">{results.length}</b> {results.length === 1 ? 'opportunity' : 'opportunities'} within {data.radius} mi of <b className="text-brand-800">{data.origin.label}</b>
            </p>
            <div className="flex items-center gap-2">
              {!coords && data.origin.label !== user.home?.label && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setHome({ label: data.origin.label, lat: data.origin.lat, lng: data.origin.lng }).then(
                      () => toast('Saved as your location (rounded to ~1 km, private to you)'),
                      fail,
                    )
                  }
                >
                  <Save size={14} /> Save as my location
                </Button>
              )}
              <div className="inline-flex rounded-full bg-surface p-1 lg:hidden" role="group" aria-label="View">
                <button aria-pressed={view === 'list'} onClick={() => setView('list')} className={cx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold', view === 'list' ? 'bg-brand-800 text-brand-50' : 'text-brand-700')}>
                  <List size={14} /> List
                </button>
                <button aria-pressed={view === 'map'} onClick={() => setView('map')} className={cx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold', view === 'map' ? 'bg-brand-800 text-brand-50' : 'text-brand-700')}>
                  <MapIcon size={14} /> Map
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <div className={cx(view === 'map' && 'hidden lg:block')}>
              {results.length === 0 ? (
                <EmptyState title="No opportunities match" body={`Try a bigger radius (you’re at ${data.radius} mi) or loosen the filters.`} action={data.radius < 50 ? <Button onClick={() => setRadius(RADII[RADII.indexOf(data.radius) + 1]!)}>Search {RADII[RADII.indexOf(data.radius) + 1]} mi</Button> : undefined} />
              ) : (
                <ol className="space-y-2.5">
                  {results.map((o) => {
                    const n = mapped.indexOf(o)
                    return (
                      <OppRow
                        key={o.id}
                        o={o}
                        active={active === o.id}
                        onHover={setActive}
                        right={
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            {n >= 0 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-moss text-[11px] font-bold text-white" aria-label={`Map pin ${n + 1}`}>{n + 1}</span>}
                            <span className="rounded-full bg-brand-800 px-2.5 py-1 text-xs font-bold text-brand-50">{o.distance == null ? 'Online' : `${o.distance} mi`}</span>
                          </span>
                        }
                      />
                    )
                  })}
                </ol>
              )}
            </div>
            <div className={cx('lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]', view === 'list' ? 'hidden lg:block' : 'h-[60vh]')}>
              <ErrorBoundary fallback={<div className="flex h-full min-h-[320px] items-center justify-center rounded-xl bg-surface p-6 text-center text-sm text-ink-500">The map couldn’t load. Distances are shown on each result.</div>}>
                <MapView origin={data.origin} radius={data.radius} items={results} activeId={active} onSelect={setActive} />
              </ErrorBoundary>
              <p className="mt-2 flex items-center gap-1 text-xs text-ink-500">
                <Crosshair size={12} aria-hidden /> Circle shows your {data.radius}-mile radius. Distances are straight-line estimates.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
