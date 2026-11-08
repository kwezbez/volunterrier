import type { AccessId, AreaId, CategoryId, SlotId, SocialId } from '../types'

export const CATEGORIES: { id: CategoryId; label: string; emoji: string; hue: string }[] = [
  { id: 'sports', label: 'Sports & recreation', emoji: '🏀', hue: 'from-brand-400 to-brand-700' },
  { id: 'education', label: 'Education & tutoring', emoji: '📚', hue: 'from-brand-300 to-brand-600' },
  { id: 'environment', label: 'Environmental conservation', emoji: '🌿', hue: 'from-brand-500 to-brand-900' },
  { id: 'animals', label: 'Animal welfare', emoji: '🐾', hue: 'from-brand-200 to-brand-500' },
  { id: 'community', label: 'Community service', emoji: '🤝', hue: 'from-brand-400 to-brand-800' },
  { id: 'health', label: 'Healthcare', emoji: '🩺', hue: 'from-brand-300 to-brand-700' },
  { id: 'arts', label: 'Arts & culture', emoji: '🎨', hue: 'from-brand-200 to-brand-600' },
  { id: 'food', label: 'Food insecurity', emoji: '🥕', hue: 'from-brand-300 to-brand-500' },
  { id: 'mental-health', label: 'Mental health awareness', emoji: '💬', hue: 'from-brand-500 to-brand-800' },
  { id: 'stem', label: 'Technology & STEM', emoji: '💻', hue: 'from-brand-600 to-brand-900' },
]

export const CAUSES = [
  'Youth empowerment',
  'Climate action',
  'Ending hunger',
  'Animal rights',
  'Health equity',
  'Digital inclusion',
  'Elder care',
  'Mental health',
  'Disability inclusion',
  'Housing & homelessness',
  'Literacy',
  'Immigrant support',
  'Racial justice',
  'LGBTQ+ belonging',
]

export const SKILLS = [
  'Coaching',
  'Teaching',
  'Mentoring',
  'Coding',
  'Design',
  'Cooking',
  'Photography',
  'Event planning',
  'Social media',
  'Writing',
  'Spanish',
  'Mandarin',
  'ASL',
  'First aid',
  'Music',
  'Heavy lifting',
  'Patience with kids',
  'Public speaking',
]

export const ACTIVITIES = [
  'Basketball',
  'Soccer',
  'Running',
  'Mentoring',
  'Tutoring',
  'Reading buddies',
  'Dog walking',
  'Animal care',
  'Cleanups',
  'Gardening',
  'Tree planting',
  'Meal prep',
  'Food distribution',
  'Tech help',
  'Workshops',
  'Event organizing',
  'Art projects',
  'Music',
  'Peer support',
  'Fundraising',
  'Visiting seniors',
]

export const ACCESS: { id: AccessId; label: string; short: string; emoji: string; desc: string }[] = [
  { id: 'wheelchair', label: 'Wheelchair accessible', short: 'Wheelchair', emoji: '♿', desc: 'Accessible routes, seating and restrooms' },
  { id: 'step-free', label: 'Step-free entrance', short: 'Step-free', emoji: '🚪', desc: 'No stairs to get in' },
  { id: 'sensory', label: 'Sensory-friendly', short: 'Sensory-friendly', emoji: '🎧', desc: 'Quiet space, low noise, soft lighting' },
  { id: 'remote', label: 'Remote / virtual option', short: 'Remote', emoji: '🌐', desc: 'Join from anywhere' },
  { id: 'flexible', label: 'Flexible participation', short: 'Flexible', emoji: '🕒', desc: 'Come late, leave early, choose your role' },
  { id: 'asl', label: 'ASL interpretation', short: 'ASL', emoji: '🤟', desc: 'Sign-language interpreter available' },
  { id: 'transit', label: 'Accessible transit nearby', short: 'Transit', emoji: '🚇', desc: 'Accessible T stop or bus within 5 min' },
]

export const SOCIAL: { id: SocialId; label: string; short: string; emoji: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner-friendly', short: 'Beginner', emoji: '🌱', desc: 'Training provided on the day' },
  { id: 'solo', label: 'Great to attend solo', short: 'Solo-friendly', emoji: '🙋', desc: 'Most people come on their own' },
  { id: 'group', label: 'Bring your friends', short: 'Groups welcome', emoji: '👯', desc: 'Sign up as a team' },
  { id: 'no-experience', label: 'No experience needed', short: 'No experience', emoji: '✨', desc: 'Just show up' },
  { id: 'buddy', label: 'Buddy system', short: 'Buddy match', emoji: '🤝', desc: 'We pair newcomers with a buddy' },
  { id: 'quiet', label: 'Low-pressure / quiet roles', short: 'Quiet roles', emoji: '🍃', desc: 'Roles that don’t require lots of talking' },
]

// what onboarding asks about social comfort — maps to SocialId
export const SOCIAL_PREFS: { id: SocialId; label: string; emoji: string }[] = [
  { id: 'solo', label: 'I’ll probably go on my own', emoji: '🙋' },
  { id: 'beginner', label: 'I’m new to volunteering', emoji: '🌱' },
  { id: 'buddy', label: 'I’d like a buddy to go with', emoji: '🤝' },
  { id: 'quiet', label: 'I prefer low-pressure, quieter roles', emoji: '🍃' },
  { id: 'group', label: 'I want to bring friends', emoji: '👯' },
]

export const SLOTS: { id: SlotId; label: string }[] = [
  { id: 'weekday-morning', label: 'Weekday mornings' },
  { id: 'weekday-afternoon', label: 'Weekday afternoons' },
  { id: 'weekday-evening', label: 'Weekday evenings' },
  { id: 'weekend-morning', label: 'Weekend mornings' },
  { id: 'weekend-afternoon', label: 'Weekend afternoons' },
  { id: 'weekend-evening', label: 'Weekend evenings' },
]

// neighborhood centers (lat/lng) used for proximity when a user hasn't saved a precise home location
export const AREAS: { id: AreaId; label: string; lat: number; lng: number }[] = [
  { id: 'bu', label: 'BU / Fenway', lat: 42.3487, lng: -71.1001 },
  { id: 'allston', label: 'Allston-Brighton', lat: 42.3539, lng: -71.1337 },
  { id: 'backbay', label: 'Back Bay', lat: 42.3503, lng: -71.081 },
  { id: 'cambridge', label: 'Cambridge', lat: 42.3736, lng: -71.1097 },
  { id: 'roxbury', label: 'Roxbury / Dorchester', lat: 42.3152, lng: -71.0914 },
  { id: 'downtown', label: 'Downtown / Seaport', lat: 42.3555, lng: -71.0605 },
  { id: 'jp', label: 'Jamaica Plain', lat: 42.3097, lng: -71.1151 },
  { id: 'other', label: 'Elsewhere', lat: 42.3601, lng: -71.0589 },
  { id: 'remote', label: 'Remote / anywhere', lat: 0, lng: 0 },
]

export const areaLabel = (id: string) => AREAS.find((a) => a.id === id)?.label ?? id
export const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4]
export const accessOf = (id: string) => ACCESS.find((a) => a.id === id)!
export const socialOf = (id: string) => SOCIAL.find((a) => a.id === id)!

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10
}

/** user's reference point: saved home (coarse) or their neighborhood center */
export function originOf(user: { area: AreaId; home?: { lat: number; lng: number } | null }) {
  if (user.home) return { lat: user.home.lat, lng: user.home.lng }
  const a = AREAS.find((x) => x.id === user.area)
  return a && a.id !== 'remote' ? { lat: a.lat, lng: a.lng } : null
}

export function distanceTo(user: { area: AreaId; home?: { lat: number; lng: number } | null }, opp: { lat: number | null; lng: number | null }) {
  const o = originOf(user)
  if (!o || opp.lat == null || opp.lng == null) return 0
  return haversineMiles(o.lat, o.lng, opp.lat, opp.lng)
}

/** weekday/weekend + part of day, evaluated in the event's own time zone */
export function slotOf(iso: string, timeZone?: string): SlotId {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  )
  const weekend = parts.weekday === 'Sat' || parts.weekday === 'Sun'
  const h = Number(parts.hour)
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `${weekend ? 'weekend' : 'weekday'}-${part}` as SlotId
}

// flat avatar colors from the palette (name kept for compatibility)
export const AVATAR_GRADIENTS = [
  'bg-brand-800 text-sage',
  'bg-moss text-white',
  'bg-sage text-brand-800',
  'bg-brand-600 text-brand-50',
  'bg-brand-300 text-brand-800',
  'bg-brand-700 text-sage',
  'bg-brand-400 text-white',
  'bg-brand-200 text-brand-800',
]
