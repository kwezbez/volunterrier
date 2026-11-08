import type { Opportunity, UserProfile } from '../types'
import { accessOf, catOf, distanceTo, slotOf, socialOf } from '../data/taxonomy'

type Viewer = UserProfile & { home?: { lat: number; lng: number } | null }

/**
 * VolunTerrier recommendation weights.
 * Tweak these numbers to change how the feed is ranked.
 */
export const WEIGHTS = {
  interest: 30, // opportunity category is one of the user's interests
  activity: 14, // per matching preferred activity (e.g. Basketball)
  cause: 10, // per matching cause
  skill: 6, // per matching skill
  availability: 12, // falls in a time slot the user is free
  locationMax: 14, // full points in the same area, decays with distance
  outOfRange: -12, // farther than the user's max distance
  accessMatch: 9, // per accessibility need the opportunity meets
  accessMissing: -18, // per mobility need (wheelchair / step-free) it doesn't meet
  social: 5, // per social-comfort preference matched (solo, beginner, buddy...)
}

export interface Rec {
  opp: Opportunity
  score: number
  percent: number
  reasons: string[]
  headline: string
  distance: number
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

export function scoreOpportunity(user: Viewer, opp: Opportunity): Rec {
  let score = 0
  const reasons: string[] = []
  const likes: string[] = []

  if (user.interests.includes(opp.category)) {
    score += WEIGHTS.interest
    reasons.push(`Matches your interest in ${catOf(opp.category).label.toLowerCase()}`)
  }

  const acts = opp.activities.filter((a) => user.activities.includes(a))
  score += acts.length * WEIGHTS.activity
  likes.push(...acts.map((a) => a.toLowerCase()))

  const causes = opp.causes.filter((c) => user.causes.includes(c))
  score += causes.length * WEIGHTS.cause
  if (causes.length) reasons.push(`Supports ${list(causes.map((c) => c.toLowerCase()))}`)

  const skills = opp.skills.filter((s) => user.skills.includes(s))
  score += skills.length * WEIGHTS.skill
  if (skills.length) reasons.push(`Uses your ${list(skills.map((s) => s.toLowerCase()))} skills`)

  const slot = slotOf(opp.date, opp.timeZone)
  if (user.availability.includes(slot) || opp.access.includes('flexible')) {
    score += WEIGHTS.availability
    reasons.push(user.availability.includes(slot) ? 'Fits your availability' : 'Flexible timing')
  }

  const distance = opp.area === 'remote' ? 0 : distanceTo(user, opp)
  if (opp.area === 'remote') {
    score += user.access.includes('remote') || user.area === 'remote' ? WEIGHTS.locationMax : WEIGHTS.locationMax / 2
    if (user.access.includes('remote')) reasons.push('Remote — join from anywhere')
  } else if (distance > user.maxDistance) {
    score += WEIGHTS.outOfRange
  } else {
    score += Math.round(WEIGHTS.locationMax * (1 - distance / Math.max(user.maxDistance, 1)) * 10) / 10 + 3
    if (distance < 1) reasons.push('Right in your neighborhood')
  }

  const met = user.access.filter((a) => opp.access.includes(a) || (a === 'remote' && opp.area === 'remote'))
  score += met.length * WEIGHTS.accessMatch
  if (met.length) reasons.push(`${list(met.map((a) => accessOf(a).short.toLowerCase()))} ✓`)
  const missing = user.access.filter((a) => (a === 'wheelchair' || a === 'step-free') && !opp.access.includes(a) && opp.area !== 'remote')
  score += missing.length * WEIGHTS.accessMissing

  const soc = user.social.filter((s) => opp.social.includes(s))
  score += soc.length * WEIGHTS.social
  if (soc.length) reasons.push(`${list(soc.map((s) => socialOf(s).short.toLowerCase()))}`)

  // headline: "Recommended because you enjoy basketball and mentoring"
  let headline: string
  if (likes.length) headline = `Because you enjoy ${list(likes.slice(0, 3))}`
  else if (user.interests.includes(opp.category)) headline = `Because you care about ${catOf(opp.category).label.toLowerCase()}`
  else if (causes.length) headline = `Because you support ${causes[0].toLowerCase()}`
  else if (skills.length) headline = `Puts your ${skills[0].toLowerCase()} skills to use`
  else if (soc.includes('solo')) headline = 'Easy to join on your own'
  else headline = 'Something new to explore'

  // ~ max realistic score is ~ 150
  // real (non-sample) listings get a small boost so genuine community posts surface first
  if (!opp.isSample) score += 4
  const percent = Math.max(12, Math.min(99, Math.round((score / 130) * 100)))
  return { opp, score, percent, reasons, headline, distance }
}

export function rankOpportunities(user: Viewer, opps: Opportunity[]): Rec[] {
  return opps
    .map((o) => scoreOpportunity(user, o))
    .sort((a, b) => {
      // the user's own fresh posts float to the top so they can see them published
      const fresh = (r: Rec) => (r.opp.isMine && Date.now() - r.opp.startAt < 0 && freshIds.has(r.opp.id) ? 1 : 0)
      const aMine = fresh(a)
      const bMine = fresh(b)
      if (aMine !== bMine) return bMine - aMine
      return b.score - a.score
    })
}

/** shared-interest overlap between two people, used for "people like you" */
export function sharedWith(a: UserProfile, b: UserProfile) {
  const acts = a.activities.filter((x) => b.activities.includes(x))
  const ints = a.interests.filter((x) => b.interests.includes(x)).map((c) => catOf(c).label.split(' ')[0])
  const causes = a.causes.filter((x) => b.causes.includes(x))
  return [...acts, ...causes, ...ints].slice(0, 3)
}

/** ids of opportunities the user just published this session (floated to the top of their deck) */
export const freshIds = new Set<string>()
