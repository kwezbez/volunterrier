// Location lookup. A built-in gazetteer covers Boston-area neighborhoods and ZIP codes
// (instant, no network). Anything else falls back to OpenStreetMap Nominatim (free, no key)
// with caching and a 1 request/second throttle per their usage policy.
// Searched locations are never stored or shown to other users.
import { config } from './config.js'

const PLACES = [
  ['boston', 'Boston, MA', 42.3601, -71.0589],
  ['boston university|bu|kenmore|fenway', 'Fenway / BU, Boston', 42.3487, -71.1001],
  ['allston', 'Allston, Boston', 42.3539, -71.1337],
  ['brighton', 'Brighton, Boston', 42.3464, -71.1627],
  ['back bay|copley', 'Back Bay, Boston', 42.3503, -71.081],
  ['south end', 'South End, Boston', 42.3418, -71.0752],
  ['beacon hill', 'Beacon Hill, Boston', 42.3588, -71.0707],
  ['north end', 'North End, Boston', 42.3647, -71.0542],
  ['downtown|downtown boston|financial district', 'Downtown Boston', 42.3555, -71.0605],
  ['seaport', 'Seaport, Boston', 42.3519, -71.0446],
  ['roxbury|nubian', 'Roxbury, Boston', 42.3243, -71.0846],
  ['mission hill', 'Mission Hill, Boston', 42.332, -71.096],
  ['dorchester', 'Dorchester, Boston', 42.3016, -71.0676],
  ['jamaica plain|jp', 'Jamaica Plain, Boston', 42.3097, -71.1151],
  ['south boston|southie', 'South Boston', 42.334, -71.04],
  ['east boston|eastie', 'East Boston', 42.3702, -71.0389],
  ['charlestown', 'Charlestown, Boston', 42.3782, -71.0602],
  ['cambridge', 'Cambridge, MA', 42.3736, -71.1097],
  ['central square', 'Central Square, Cambridge', 42.3654, -71.1037],
  ['harvard square|harvard', 'Harvard Square, Cambridge', 42.3736, -71.119],
  ['kendall|mit', 'Kendall Square, Cambridge', 42.3625, -71.0865],
  ['somerville', 'Somerville, MA', 42.3876, -71.0995],
  ['brookline', 'Brookline, MA', 42.3318, -71.1212],
  ['newton', 'Newton, MA', 42.337, -71.2092],
  ['quincy', 'Quincy, MA', 42.2529, -71.0023],
  ['medford', 'Medford, MA', 42.4184, -71.1062],
  ['malden', 'Malden, MA', 42.4251, -71.0662],
  ['chelsea', 'Chelsea, MA', 42.3918, -71.0328],
  ['waltham', 'Waltham, MA', 42.3765, -71.2356],
  ['worcester', 'Worcester, MA', 42.2626, -71.8023],
  ['lowell', 'Lowell, MA', 42.6334, -71.3162],
  ['providence', 'Providence, RI', 41.824, -71.4128],
]
const ZIPS = {
  '02215': [42.3471, -71.1027], '02134': [42.3576, -71.1294], '02135': [42.3486, -71.1567], '02116': [42.3496, -71.0765],
  '02115': [42.3427, -71.0922], '02118': [42.3366, -71.0711], '02119': [42.3243, -71.0846], '02120': [42.332, -71.096],
  '02130': [42.3097, -71.1145], '02139': [42.3647, -71.1042], '02138': [42.38, -71.134], '02142': [42.362, -71.083],
  '02141': [42.37, -71.083], '02143': [42.3814, -71.1002], '02144': [42.4, -71.122], '02108': [42.3576, -71.0646],
  '02109': [42.36, -71.054], '02110': [42.357, -71.051], '02111': [42.35, -71.06], '02113': [42.365, -71.055],
  '02114': [42.361, -71.068], '02210': [42.348, -71.04], '02121': [42.305, -71.086], '02122': [42.297, -71.059],
  '02124': [42.286, -71.071], '02125': [42.316, -71.059], '02127': [42.334, -71.04], '02128': [42.375, -71.025],
  '02129': [42.378, -71.062], '02446': [42.343, -71.122], '02445': [42.325, -71.134], '02458': [42.353, -71.188],
  '02148': [42.4251, -71.0662], '02155': [42.4184, -71.1062], '02169': [42.2529, -71.0023], '02150': [42.3918, -71.0328],
}

const cache = new Map()
let lastCall = 0

export function haversineMiles(aLat, aLng, bLat, bLng) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** coarse rounding (~1 km) used whenever we persist a user's own location */
export const coarse = (n) => Math.round(n * 100) / 100

export async function geocode(raw) {
  const q = String(raw).trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return null
  const zip = q.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zip && ZIPS[zip[1]] && q.replace(/[^a-z]/g, '').length < 4) return { label: `ZIP ${zip[1]}`, lat: ZIPS[zip[1]][0], lng: ZIPS[zip[1]][1] }
  const bare = q.replace(/,?\s*(ma|massachusetts|usa|us)$/, '').trim()
  for (const [names, label, lat, lng] of PLACES) if (names.split('|').includes(bare)) return { label, lat, lng }
  if (cache.has(q)) return cache.get(q)
  if (config.geocoder === 'off') return null

  // Nominatim allows ~1 request/second. Reserve a slot; refuse rather than build an unbounded queue.
  const slot = Math.max(Date.now(), lastCall + 1100)
  if (slot - Date.now() > 5000) return null
  lastCall = slot
  if (slot > Date.now()) await new Promise((r) => setTimeout(r, slot - Date.now()))
  try {
    const url = `${config.nominatimUrl}/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(raw)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': `VolunTerrier/1.0 (${config.appUrl || 'local development'})`, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const [hit] = await res.json()
    const out = hit ? { label: String(hit.display_name).split(',').slice(0, 3).join(',').trim(), lat: +hit.lat, lng: +hit.lon } : null
    cache.set(q, out)
    if (cache.size > 500) cache.delete(cache.keys().next().value)
    return out
  } catch {
    return null
  }
}
