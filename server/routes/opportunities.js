import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { hit, newId, rateLimit, requireAuth } from '../security.js'
import { createOpportunitySchema, parse, searchSchema } from '../validate.js'
import { eventWindow } from '../time.js'
import { geocode, haversineMiles } from '../geo.js'
import { OPP_SELECT, friendsGoingMap, hoursOf, isCompleted, opportunity, publicUser } from '../serialize.js'

const r = Router()
r.use(requireAuth)

export const CONFLICT_MESSAGE = 'You already have something planned during this time.'
const checkinCode = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(6), (b) => a[b % a.length]).join('')
}

async function list(viewerId, where, params) {
  const rows = await db.query(`${OPP_SELECT} WHERE ${where} ORDER BY o.start_at`, [viewerId, ...params])
  const friends = await friendsGoingMap(db, viewerId)
  return rows.map((row) => opportunity(row, { viewerId, friendsGoing: friends.get(row.id) }))
}

/* -------- feed for the app (upcoming + anything I'm involved in) -------- */
r.get('/', async (req, res) => {
  const items = await list(req.user.id, `o.end_at > $2 OR o.organizer_id = $1 OR me.user_id IS NOT NULL`, [Date.now()])
  res.json({ opportunities: items })
})

/* -------- geocode a typed location -------- */
r.get('/geocode', rateLimit({ name: 'geocode', limit: 40, windowMs: 60_000, key: (req) => req.user.id }), async (req, res) => {
  const q = String(req.query.q || '').slice(0, 120)
  const place = await geocode(q)
  if (!place) return res.status(404).json({ error: 'We couldn’t find that place. Try a city, neighborhood or ZIP code.' })
  res.json(place)
})

/* -------- location search -------- */
r.get('/search', rateLimit({ name: 'search', limit: 60, windowMs: 60_000, key: (req) => req.user.id }), async (req, res) => {
  const p = parse(searchSchema, req.query, res)
  if (!p) return
  let origin
  if (p.lat != null && p.lng != null) origin = { label: 'Your current location', lat: p.lat, lng: p.lng }
  else if (p.q) {
    origin = await geocode(p.q)
    if (!origin) return res.status(404).json({ error: 'We couldn’t find that place. Try a city, neighborhood or ZIP code.' })
  } else return res.status(400).json({ error: 'Enter a city, ZIP code or address, or use your location.' })

  const now = Date.now()
  const from = Math.max(p.from ?? now, now - 3_600_000)
  const to = p.to ?? now + 365 * 86400_000
  const conds = ['o.end_at > $2', 'o.start_at <= $3']
  const params = [from, to]
  if (p.category) {
    params.push(p.category)
    conds.push(`o.category = $${params.length + 1}`)
  }
  const items = await list(req.user.id, conds.join(' AND '), params)
  const results = []
  for (const o of items) {
    if (o.lat == null || o.lng == null) {
      if (p.includeRemote === 'true' && o.area === 'remote') results.push({ ...o, distance: null })
      continue
    }
    const d = Math.round(haversineMiles(origin.lat, origin.lng, o.lat, o.lng) * 10) / 10
    if (d <= p.radius) results.push({ ...o, distance: d })
  }
  results.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999) || a.startAt - b.startAt)
  // round the echoed origin so we never reflect a precise coordinate back into logs/UI
  res.json({ origin: { label: origin.label, lat: Math.round(origin.lat * 1000) / 1000, lng: Math.round(origin.lng * 1000) / 1000 }, radius: p.radius, results })
})

/* -------- my schedule -------- */
r.get('/schedule/mine', async (req, res) => {
  const rows = await db.query(
    `${OPP_SELECT} WHERE me.user_id IS NOT NULL OR o.organizer_id = $1 ORDER BY o.start_at`,
    [req.user.id],
  )
  res.json({ events: rows.map((row) => ({ ...opportunity(row, { viewerId: req.user.id }), role: row.organizer_id === req.user.id ? 'organizer' : 'volunteer' })) })
})

/* -------- detail -------- */
r.get('/:id', async (req, res) => {
  const row = await db.one(`${OPP_SELECT} WHERE o.id = $2`, [req.user.id, req.params.id])
  if (!row) return res.status(404).json({ error: 'Opportunity not found.' })
  const friends = await friendsGoingMap(db, req.user.id, row.id)
  const out = opportunity(row, { viewerId: req.user.id, friendsGoing: friends.get(row.id) })
  const buddy = await db.one('SELECT COUNT(*)::int AS n FROM signups WHERE opportunity_id = $1 AND buddy = TRUE AND user_id <> $2', [row.id, req.user.id])
  out.buddySeekers = buddy.n
  if (out.isMine) {
    // organizers see who signed up (display names only) and manage verification
    const attendees = await db.query(
      `SELECT u.id, u.username, u.display_name, u.profile->'avatar' AS avatar, s.verified_at, s.verified_via, s.buddy
         FROM signups s JOIN users u ON u.id = s.user_id WHERE s.opportunity_id = $1 ORDER BY s.created_at`,
      [row.id],
    )
    out.manage = {
      checkinCode: row.checkin_code,
      completedAt: row.completed_at,
      attendees: attendees.map((a) => ({ id: a.id, ...publicUser(a), verified: a.verified_at != null, verifiedVia: a.verified_via, buddy: a.buddy })),
    }
  }
  res.json({ opportunity: out })
})

/* -------- create -------- */
r.post('/', rateLimit({ name: 'create-opp', limit: 20, windowMs: 60 * 60_000, key: (req) => req.user.id }), async (req, res) => {
  const b = parse(createOpportunitySchema, req.body, res)
  if (!b) return
  if (b.area !== 'remote' && !b.address) return res.status(400).json({ error: 'Add an address or meeting point.', field: 'address' })
  const { start, end } = eventWindow(b.date, b.startTime, b.endTime, b.timeZone)
  if (start < Date.now() - 5 * 60_000) return res.status(400).json({ error: 'Start time must be in the future.', field: 'date' })
  if (end - start > 24 * 3_600_000) return res.status(400).json({ error: 'Events can be at most 24 hours long.', field: 'endTime' })

  let lat = b.lat ?? null
  let lng = b.lng ?? null
  let city = b.city
  if (b.area !== 'remote' && (lat == null || lng == null)) {
    const place = await geocode([b.address, b.city].filter(Boolean).join(', '))
      || (b.city ? await geocode(b.city) : null)
    if (place) {
      lat = place.lat
      lng = place.lng
      if (!city) city = place.label
    }
  }
  if (b.area === 'remote') {
    lat = lng = null
    city = 'Online'
  }
  const access = b.area === 'remote' && !b.access.includes('remote') ? [...b.access, 'remote'] : b.access
  const id = newId()
  const summary = b.description.split(/(?<=[.!?])\s/)[0].slice(0, 160)
  await db.query(
    `INSERT INTO opportunities (id, organizer_id, org_name, title, summary, description, expect, vibe, category, activities, causes, skills,
       access, social, image, area, address, city, lat, lng, transit, start_at, end_at, time_zone, max_participants, is_sample, checkin_code, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,'[]'::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,NULL,$20,$21,$22,$23,FALSE,$24,$25)`,
    [
      id, req.user.id, b.org, b.title, summary, b.description,
      JSON.stringify(['Check in & meet the organizer', 'Get a quick intro to your role', 'Make a difference together']),
      b.vibe || 'Friendly and welcoming — newcomers encouraged.', b.category, JSON.stringify(b.activities), JSON.stringify(b.skills),
      JSON.stringify(access), JSON.stringify(b.social), b.image, b.area, b.area === 'remote' ? 'Online' : b.address, city || '',
      lat, lng, start, end, b.timeZone, b.maxParticipants, checkinCode(), Date.now(),
    ],
  )
  const row = await db.one(`${OPP_SELECT} WHERE o.id = $2`, [req.user.id, id])
  res.status(201).json({ opportunity: opportunity(row, { viewerId: req.user.id }), geocoded: lat != null })
})

r.delete('/:id', async (req, res) => {
  const out = await db.query('DELETE FROM opportunities WHERE id = $1 AND organizer_id = $2 RETURNING id', [req.params.id, req.user.id])
  if (!out.length) return res.status(404).json({ error: 'Not found or not yours.' })
  res.json({ ok: true })
})

/* -------- sign up (server-side duplicate, capacity and schedule-conflict checks) -------- */
r.post('/:id/signup', async (req, res) => {
  const uid = req.user.id
  const buddy = req.body?.buddy === true
  const result = await db.tx(async (t) => {
    // lock this user's row so two simultaneous signups can't both pass the conflict check
    await t.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [uid])
    const [opp] = await t.query('SELECT id, organizer_id, start_at, end_at, max_participants, title FROM opportunities WHERE id = $1 FOR UPDATE', [req.params.id])
    if (!opp) return { status: 404, body: { error: 'Opportunity not found.' } }
    if (opp.organizer_id === uid) return { status: 409, body: { code: 'ORGANIZER', error: 'You’re the organizer — it’s already on your schedule.' } }
    if (opp.end_at <= Date.now()) return { status: 400, body: { code: 'ENDED', error: 'This event has already ended.' } }
    const [dup] = await t.query('SELECT 1 FROM signups WHERE user_id = $1 AND opportunity_id = $2', [uid, opp.id])
    if (dup) return { status: 409, body: { code: 'DUPLICATE', error: 'You’re already signed up for this event.' } }
    const [{ n }] = await t.query('SELECT COUNT(*)::int AS n FROM signups WHERE opportunity_id = $1', [opp.id])
    if (n >= opp.max_participants) return { status: 409, body: { code: 'FULL', error: 'This event is full.' } }
    // overlap on absolute UTC instants: [start, end) — correct across midnight and time zones
    const [conflict] = await t.query(
      `SELECT o.id, o.title, o.start_at, o.end_at, o.time_zone FROM opportunities o
        WHERE o.id <> $2 AND o.start_at < $4 AND $3 < o.end_at
          AND (o.organizer_id = $1 OR EXISTS (SELECT 1 FROM signups s WHERE s.opportunity_id = o.id AND s.user_id = $1))
        ORDER BY o.start_at LIMIT 1`,
      [uid, opp.id, opp.start_at, opp.end_at],
    )
    if (conflict) {
      return {
        status: 409,
        body: { code: 'SCHEDULE_CONFLICT', error: CONFLICT_MESSAGE, conflict: { id: conflict.id, title: conflict.title, startAt: conflict.start_at, endAt: conflict.end_at, timeZone: conflict.time_zone } },
      }
    }
    await t.query('INSERT INTO signups (user_id, opportunity_id, buddy, created_at) VALUES ($1,$2,$3,$4)', [uid, opp.id, buddy, Date.now()])
    // joining counts as a like
    await t.query(
      `INSERT INTO swipes (user_id, opportunity_id, decision, created_at) VALUES ($1,$2,'like',$3)
       ON CONFLICT (user_id, opportunity_id) DO UPDATE SET decision = 'like'`,
      [uid, opp.id, Date.now()],
    )
    return { status: 201, body: { ok: true } }
  }).catch((e) => {
    if (String(e.code) === '23505') return { status: 409, body: { code: 'DUPLICATE', error: 'You’re already signed up for this event.' } }
    throw e
  })
  res.status(result.status).json(result.body)
})

r.delete('/:id/signup', async (req, res) => {
  const s = await db.one('SELECT verified_at FROM signups WHERE user_id = $1 AND opportunity_id = $2', [req.user.id, req.params.id])
  if (!s) return res.status(404).json({ error: 'You aren’t signed up for this event.' })
  if (s.verified_at) return res.status(409).json({ error: 'Verified attendance can’t be cancelled.' })
  await db.query('DELETE FROM signups WHERE user_id = $1 AND opportunity_id = $2', [req.user.id, req.params.id])
  res.json({ ok: true })
})

r.patch('/:id/signup', async (req, res) => {
  const out = await db.query('UPDATE signups SET buddy = $3 WHERE user_id = $1 AND opportunity_id = $2 RETURNING buddy', [req.user.id, req.params.id, req.body?.buddy === true])
  if (!out.length) return res.status(404).json({ error: 'Join the event first.' })
  res.json({ buddy: out[0].buddy })
})

/* -------- completion & verified hours -------- */
async function ownOpp(req, res) {
  const o = await db.one('SELECT * FROM opportunities WHERE id = $1', [req.params.id])
  if (!o || o.organizer_id !== req.user.id) {
    res.status(403).json({ error: 'Only the organizer can do that.' })
    return null
  }
  return o
}

r.post('/:id/complete', async (req, res) => {
  const o = await ownOpp(req, res)
  if (!o) return
  if (o.start_at > Date.now()) return res.status(400).json({ error: 'You can mark an event completed once it has started.' })
  await db.query('UPDATE opportunities SET completed_at = COALESCE(completed_at, $2) WHERE id = $1', [o.id, Date.now()])
  res.json({ ok: true })
})

r.post('/:id/attendees/:userId/verify', async (req, res) => {
  const o = await ownOpp(req, res)
  if (!o) return
  if (!isCompleted(o)) return res.status(400).json({ error: 'Mark the event completed (or wait until it ends) before verifying hours.' })
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'You can’t verify your own hours.' })
  const verified = req.body?.verified !== false
  const out = await db.query(
    `UPDATE signups SET verified_at = $3, verified_via = $4, hours = $5 WHERE opportunity_id = $1 AND user_id = $2 RETURNING user_id`,
    [o.id, req.params.userId, verified ? Date.now() : null, verified ? 'organizer' : null, verified ? hoursOf(o) : null],
  )
  if (!out.length) return res.status(404).json({ error: 'That person isn’t signed up.' })
  res.json({ ok: true, verified })
})

r.post('/:id/checkin', async (req, res) => {
  const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!hit(`checkin:${req.user.id}:${req.params.id}`, 8, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Ask the organizer to verify you instead.' })
  const o = await db.one('SELECT * FROM opportunities WHERE id = $1', [req.params.id])
  const s = o && (await db.one('SELECT verified_at FROM signups WHERE user_id = $1 AND opportunity_id = $2', [req.user.id, o.id]))
  if (!o || !s) return res.status(404).json({ error: 'Join this event first.' })
  if (s.verified_at) return res.json({ ok: true, already: true })
  const now = Date.now()
  if (now < o.start_at - 30 * 60_000 || now > o.end_at + 24 * 3_600_000) return res.status(400).json({ error: 'Check-in opens 30 minutes before the event and closes 24 hours after it ends.' })
  if (!o.checkin_code || !crypto.timingSafeEqual(Buffer.from(code.padEnd(6).slice(0, 6)), Buffer.from(o.checkin_code))) return res.status(400).json({ error: 'That check-in code isn’t right.' })
  await db.query(`UPDATE signups SET verified_at = $3, verified_via = 'checkin', hours = $4 WHERE user_id = $1 AND opportunity_id = $2`, [req.user.id, o.id, now, hoursOf(o)])
  res.json({ ok: true })
})

export default r
