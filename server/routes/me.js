import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../security.js'
import { locationSchema, parse, profileSchema, settingsSchema } from '../validate.js'
import { coarse } from '../geo.js'
import { meJson, meRow } from './auth.js'

const r = Router()
r.use(requireAuth)

r.get('/', async (req, res) => res.json({ user: meJson(await meRow(req.user.id)) }))

/** private per-user state the app needs on load */
r.get('/state', async (req, res) => {
  const uid = req.user.id
  const [swipes, saves, groups] = await Promise.all([
    db.query('SELECT opportunity_id, decision FROM swipes WHERE user_id = $1', [uid]),
    db.query('SELECT opportunity_id FROM saves WHERE user_id = $1', [uid]),
    db.query('SELECT group_id FROM group_members WHERE user_id = $1', [uid]),
  ])
  res.json({
    liked: swipes.filter((s) => s.decision === 'like').map((s) => s.opportunity_id),
    skipped: swipes.filter((s) => s.decision === 'skip').map((s) => s.opportunity_id),
    saved: saves.map((s) => s.opportunity_id),
    groupsJoined: groups.map((g) => g.group_id),
  })
})

r.put('/profile', async (req, res) => {
  const p = parse(profileSchema, req.body, res)
  if (!p) return
  const { displayName, ...profile } = p
  await db.query('UPDATE users SET display_name = $2, profile = $3::jsonb, onboarded = TRUE WHERE id = $1', [req.user.id, displayName, JSON.stringify(profile)])
  res.json({ user: meJson(await meRow(req.user.id)) })
})

r.patch('/settings', async (req, res) => {
  const s = parse(settingsSchema, req.body, res)
  if (!s) return
  if (s.progressVisibility) await db.query('UPDATE users SET progress_visibility = $2 WHERE id = $1', [req.user.id, s.progressVisibility])
  if (s.shareAttendanceWithFriends !== undefined) await db.query('UPDATE users SET share_attendance_with_friends = $2 WHERE id = $1', [req.user.id, s.shareAttendanceWithFriends])
  res.json({ user: meJson(await meRow(req.user.id)) })
})

// Saved "home" location: rounded to ~1 km and only ever used for this user's own results.
r.put('/location', async (req, res) => {
  const l = parse(locationSchema, req.body, res)
  if (!l) return
  await db.query('UPDATE users SET home_label = $2, home_lat = $3, home_lng = $4 WHERE id = $1', [req.user.id, l.label, coarse(l.lat), coarse(l.lng)])
  res.json({ user: meJson(await meRow(req.user.id)) })
})
r.delete('/location', async (req, res) => {
  await db.query('UPDATE users SET home_label = NULL, home_lat = NULL, home_lng = NULL WHERE id = $1', [req.user.id])
  res.json({ user: meJson(await meRow(req.user.id)) })
})

/* swipes & saves */
r.put('/swipes/:oppId', async (req, res) => {
  const decision = req.body?.decision
  if (!['like', 'skip'].includes(decision)) return res.status(400).json({ error: 'Invalid decision.' })
  const exists = await db.one('SELECT 1 FROM opportunities WHERE id = $1', [req.params.oppId])
  if (!exists) return res.status(404).json({ error: 'Not found.' })
  await db.query(
    `INSERT INTO swipes (user_id, opportunity_id, decision, created_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, opportunity_id) DO UPDATE SET decision = EXCLUDED.decision`,
    [req.user.id, req.params.oppId, decision, Date.now()],
  )
  res.json({ ok: true })
})
r.delete('/swipes', async (req, res) => {
  // "see skipped again"
  await db.query(`DELETE FROM swipes WHERE user_id = $1 AND decision = 'skip'`, [req.user.id])
  res.json({ ok: true })
})
r.delete('/swipes/:oppId', async (req, res) => {
  await db.query('DELETE FROM swipes WHERE user_id = $1 AND opportunity_id = $2', [req.user.id, req.params.oppId])
  res.json({ ok: true })
})
r.put('/saves/:oppId', async (req, res) => {
  const exists = await db.one('SELECT 1 FROM opportunities WHERE id = $1', [req.params.oppId])
  if (!exists) return res.status(404).json({ error: 'Not found.' })
  await db.query('INSERT INTO saves (user_id, opportunity_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.user.id, req.params.oppId, Date.now()])
  res.json({ ok: true })
})
r.delete('/saves/:oppId', async (req, res) => {
  await db.query('DELETE FROM saves WHERE user_id = $1 AND opportunity_id = $2', [req.user.id, req.params.oppId])
  res.json({ ok: true })
})

export default r
