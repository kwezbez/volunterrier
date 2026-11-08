import { Router } from 'express'
import { db } from '../db.js'
import { config } from '../config.js'
import { hmac, newId, randomToken, rateLimit, requireAuth } from '../security.js'
import { username as usernameSchema } from '../validate.js'
import { MILESTONES } from '../taxonomy.js'
import { publicUser } from '../serialize.js'

const r = Router()
const pair = (a, b) => (a < b ? [a, b] : [b, a])
const INVITE_DAYS = 14

async function friendship(a, b) {
  const [x, y] = pair(a, b)
  return db.one('SELECT status, requested_by FROM friendships WHERE user_a = $1 AND user_b = $2', [x, y])
}
async function makeFriends(a, b, by, t = db) {
  const [x, y] = pair(a, b)
  await t.query(
    `INSERT INTO friendships (user_a, user_b, status, requested_by, created_at) VALUES ($1,$2,'accepted',$3,$4)
     ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'accepted'`,
    [x, y, by, Date.now()],
  )
}

/* ---------------- progress (verified hours only) ---------------- */
// Hours exist only on signups an organizer verified (or a correct check-in code), and only count
// once the event is completed. No endpoint lets a volunteer set or edit hours.
export async function progressFor(userId) {
  const now = Date.now()
  const rows = await db.query(
    `SELECT o.id, o.title, o.org_name, o.category, o.start_at, o.end_at, o.time_zone, s.hours, s.verified_at, s.verified_via
       FROM signups s JOIN opportunities o ON o.id = s.opportunity_id
      WHERE s.user_id = $1 AND s.verified_at IS NOT NULL AND (o.completed_at IS NOT NULL OR o.end_at <= $2)
      ORDER BY o.start_at DESC`,
    [userId, now],
  )
  const total = Math.round(rows.reduce((s, r) => s + (r.hours || 0), 0) * 100) / 100
  const next = MILESTONES.find((m) => m > total) ?? null
  const prev = [...MILESTONES].reverse().find((m) => m <= total) ?? 0
  // last 6 months, for the activity chart
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - i)
    const key = d.toISOString().slice(0, 7)
    months.push({ month: key, hours: Math.round(rows.filter((r) => new Date(r.start_at).toISOString().slice(0, 7) === key).reduce((s, r) => s + r.hours, 0) * 100) / 100 })
  }
  const categories = {}
  for (const r of rows) categories[r.category] = Math.round(((categories[r.category] || 0) + r.hours) * 100) / 100
  return {
    totalHours: total,
    eventsAttended: rows.length,
    milestones: MILESTONES.map((m) => ({ hours: m, reached: total >= m })),
    nextMilestone: next,
    previousMilestone: prev,
    months,
    categories,
    history: rows.map((r) => ({ id: r.id, title: r.title, org: r.org_name, category: r.category, startAt: r.start_at, endAt: r.end_at, timeZone: r.time_zone, hours: r.hours, verifiedVia: r.verified_via })),
  }
}

/* ---------------- public invite lookup (no login needed) ---------------- */
// Tokens travel in the request BODY (not the URL) so they never land in access logs.
const tokenOf = (req) => String(req.body?.token ?? '').slice(0, 100)
r.post('/invites/lookup', rateLimit({ name: 'invite-view', limit: 60, windowMs: 60_000 }), async (req, res) => {
  const inv = await db.one(
    `SELECT i.id, i.expires_at, i.revoked, i.opportunity_id, u.display_name, u.profile->'avatar' AS avatar,
            o.title, o.org_name, o.start_at, o.end_at, o.time_zone, o.city, o.area, o.image, o.category, o.is_sample
       FROM invites i JOIN users u ON u.id = i.inviter_id LEFT JOIN opportunities o ON o.id = i.opportunity_id
      WHERE i.token_hash = $1`,
    [hmac(tokenOf(req))],
  )
  if (!inv || inv.revoked || inv.expires_at < Date.now()) return res.status(404).json({ error: 'This invitation is invalid or has expired.' })
  // Only the inviter's chosen display name is shown — never their username or any account details.
  res.json({
    invite: {
      inviterName: inv.display_name,
      inviterAvatar: inv.avatar,
      expiresAt: inv.expires_at,
      opportunity: inv.opportunity_id
        ? { id: inv.opportunity_id, title: inv.title, org: inv.org_name, startAt: inv.start_at, endAt: inv.end_at, timeZone: inv.time_zone, city: inv.city, area: inv.area, image: inv.image, category: inv.category, isSample: inv.is_sample }
        : null,
    },
  })
})

r.use(requireAuth)

r.get('/progress', async (req, res) => {
  const p = await progressFor(req.user.id)
  const pending = await db.one(
    `SELECT COUNT(*)::int AS n FROM signups s JOIN opportunities o ON o.id = s.opportunity_id
      WHERE s.user_id = $1 AND s.verified_at IS NULL AND (o.completed_at IS NOT NULL OR o.end_at <= $2)`,
    [req.user.id, Date.now()],
  )
  res.json({ progress: { ...p, awaitingVerification: pending.n } })
})

/* ---------------- public profiles (privacy enforced here, not in the UI) ---------------- */
r.get('/users/:username', async (req, res) => {
  const u = await db.one(
    `SELECT id, username, display_name, profile, progress_visibility, created_at FROM users WHERE username = $1`,
    [String(req.params.username).toLowerCase().slice(0, 40)],
  )
  if (!u) return res.status(404).json({ error: 'User not found.' })
  const isMe = u.id === req.user.id
  const f = isMe ? null : await friendship(req.user.id, u.id)
  const status = isMe ? 'me' : !f ? 'none' : f.status === 'accepted' ? 'friends' : f.requested_by === req.user.id ? 'pending-out' : 'pending-in'
  const isPublic = u.progress_visibility === 'public'
  const canSeeProgress = isMe || isPublic
  // Bio and interests are shown to friends, or to everyone only if the user chose a public profile.
  const canSeeDetails = isMe || isPublic || status === 'friends'
  res.json({
    profile: {
      username: u.username,
      displayName: u.display_name,
      avatar: u.profile.avatar,
      bio: canSeeDetails ? u.profile.bio || '' : '',
      pronouns: canSeeDetails ? u.profile.pronouns || '' : '',
      interests: canSeeDetails ? u.profile.interests || [] : [],
      causes: canSeeDetails ? u.profile.causes || [] : [],
      limited: !canSeeDetails,
      memberSince: u.created_at,
      friendship: status,
      progressVisibility: isMe ? u.progress_visibility : undefined,
      progress: canSeeProgress ? await progressFor(u.id) : null,
    },
  })
})

/* ---------------- friends ---------------- */
r.get('/friends', async (req, res) => {
  const uid = req.user.id
  const rows = await db.query(
    `SELECT f.status, f.requested_by, u.id, u.username, u.display_name, u.profile->'avatar' AS avatar, u.progress_visibility
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
      WHERE f.user_a = $1 OR f.user_b = $1 ORDER BY u.display_name`,
    [uid],
  )
  const friends = []
  for (const r of rows.filter((x) => x.status === 'accepted')) {
    let hours = null
    if (r.progress_visibility === 'public') hours = (await progressFor(r.id)).totalHours
    friends.push({ ...publicUser(r), publicProgress: r.progress_visibility === 'public', totalHours: hours })
  }
  res.json({
    friends,
    incoming: rows.filter((x) => x.status === 'pending' && x.requested_by !== uid).map(publicUser),
    outgoing: rows.filter((x) => x.status === 'pending' && x.requested_by === uid).map(publicUser),
  })
})

r.post('/friends/request', rateLimit({ name: 'friend-req', limit: 30, windowMs: 60 * 60_000, key: (req) => req.user.id }), async (req, res) => {
  const parsed = usernameSchema.safeParse(req.body?.username)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid username.' })
  const target = await db.one('SELECT id FROM users WHERE username = $1', [parsed.data])
  if (!target) return res.status(404).json({ error: 'No user with that username.' })
  if (target.id === req.user.id) return res.status(400).json({ error: 'That’s you!' })
  const f = await friendship(req.user.id, target.id)
  if (f?.status === 'accepted') return res.json({ status: 'friends' })
  if (f && f.requested_by !== req.user.id) {
    await makeFriends(req.user.id, target.id, f.requested_by)
    return res.json({ status: 'friends' })
  }
  if (f) return res.json({ status: 'pending-out' })
  const [a, b] = pair(req.user.id, target.id)
  await db.query(`INSERT INTO friendships (user_a, user_b, status, requested_by, created_at) VALUES ($1,$2,'pending',$3,$4) ON CONFLICT DO NOTHING`, [a, b, req.user.id, Date.now()])
  res.status(201).json({ status: 'pending-out' })
})

r.post('/friends/:username/accept', async (req, res) => {
  const other = await db.one('SELECT id FROM users WHERE username = $1', [String(req.params.username).toLowerCase()])
  const f = other && (await friendship(req.user.id, other.id))
  if (!f || f.status !== 'pending' || f.requested_by === req.user.id) return res.status(404).json({ error: 'No pending request from that user.' })
  await makeFriends(req.user.id, other.id, f.requested_by)
  res.json({ status: 'friends' })
})

r.delete('/friends/:username', async (req, res) => {
  const other = await db.one('SELECT id FROM users WHERE username = $1', [String(req.params.username).toLowerCase()])
  if (!other) return res.status(404).json({ error: 'User not found.' })
  const [a, b] = pair(req.user.id, other.id)
  await db.query('DELETE FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b])
  res.json({ ok: true })
})

/** friends' recent verified activity — only from friends whose progress is public */
r.get('/feed', async (req, res) => {
  const rows = await db.query(
    `SELECT u.username, u.display_name, u.profile->'avatar' AS avatar, o.id, o.title, o.org_name, o.category, o.start_at, o.time_zone, s.hours, s.verified_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
       JOIN signups s ON s.user_id = u.id AND s.verified_at IS NOT NULL
       JOIN opportunities o ON o.id = s.opportunity_id AND (o.completed_at IS NOT NULL OR o.end_at <= $2)
      WHERE (f.user_a = $1 OR f.user_b = $1) AND f.status = 'accepted' AND u.progress_visibility = 'public'
      ORDER BY s.verified_at DESC LIMIT 20`,
    [req.user.id, Date.now()],
  )
  res.json({ feed: rows.map((r) => ({ user: publicUser(r), opportunityId: r.id, title: r.title, org: r.org_name, category: r.category, startAt: r.start_at, timeZone: r.time_zone, hours: r.hours, verifiedAt: r.verified_at })) })
})

/* ---------------- invitations ---------------- */
r.post('/invites', rateLimit({ name: 'invite-create', limit: 30, windowMs: 60 * 60_000, key: (req) => req.user.id }), async (req, res) => {
  const oppId = req.body?.opportunityId ? String(req.body.opportunityId) : null
  if (oppId && !(await db.one('SELECT 1 FROM opportunities WHERE id = $1', [oppId]))) return res.status(404).json({ error: 'Opportunity not found.' })
  const token = randomToken(32) // 256 bits of randomness; only its HMAC is stored
  const id = newId()
  const expires = Date.now() + INVITE_DAYS * 86400_000
  await db.query('INSERT INTO invites (id, token_hash, inviter_id, opportunity_id, created_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6)', [id, hmac(token), req.user.id, oppId, Date.now(), expires])
  // token lives in the URL fragment (#), so it isn't sent to servers or logged in access logs
  res.status(201).json({ id, url: `${config.appUrl || ''}/#/invite/${token}`, expiresAt: expires })
})

r.get('/invites', async (req, res) => {
  const rows = await db.query(
    `SELECT i.id, i.created_at, i.expires_at, i.revoked, o.id AS opp_id, o.title,
            a.accepted_at, u.username, u.display_name, u.profile->'avatar' AS avatar
       FROM invites i LEFT JOIN opportunities o ON o.id = i.opportunity_id
       LEFT JOIN invite_acceptances a ON a.invite_id = i.id LEFT JOIN users u ON u.id = a.user_id
      WHERE i.inviter_id = $1 ORDER BY i.created_at DESC LIMIT 50`,
    [req.user.id],
  )
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.id)) map.set(r.id, { id: r.id, createdAt: r.created_at, expiresAt: r.expires_at, revoked: r.revoked, opportunity: r.opp_id ? { id: r.opp_id, title: r.title } : null, accepted: [] })
    if (r.username) map.get(r.id).accepted.push({ ...publicUser(r), acceptedAt: r.accepted_at })
  }
  res.json({ invites: [...map.values()] })
})

r.delete('/invites/:id', async (req, res) => {
  await db.query('UPDATE invites SET revoked = TRUE WHERE id = $1 AND inviter_id = $2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

r.post('/invites/accept', rateLimit({ name: 'invite-accept', limit: 20, windowMs: 15 * 60_000, key: (req) => req.user.id }), async (req, res) => {
  const inv = await db.one('SELECT id, inviter_id, opportunity_id, expires_at, revoked FROM invites WHERE token_hash = $1', [hmac(tokenOf(req))])
  if (!inv || inv.revoked || inv.expires_at < Date.now()) return res.status(404).json({ error: 'This invitation is invalid or has expired.' })
  if (inv.inviter_id === req.user.id) return res.status(400).json({ error: 'This is your own invitation — share it with a friend!' })
  await db.tx(async (t) => {
    await makeFriends(req.user.id, inv.inviter_id, inv.inviter_id, t)
    await t.query('INSERT INTO invite_acceptances (invite_id, user_id, accepted_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [inv.id, req.user.id, Date.now()])
  })
  res.json({ ok: true, opportunityId: inv.opportunity_id })
})

/* ---------------- groups ---------------- */
r.get('/groups', async (req, res) => {
  const rows = await db.query(
    `SELECT g.*, (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS member_count,
            EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = $1) AS joined
       FROM groups g ORDER BY g.name`,
    [req.user.id],
  )
  const friendRows = await db.query(
    `SELECT m.group_id, u.username, u.display_name, u.profile->'avatar' AS avatar FROM group_members m JOIN users u ON u.id = m.user_id
       JOIN friendships f ON f.status = 'accepted' AND ((f.user_a = $1 AND f.user_b = u.id) OR (f.user_b = $1 AND f.user_a = u.id))`,
    [req.user.id],
  )
  res.json({
    groups: rows.map((g) => ({
      id: g.id, name: g.name, emoji: g.emoji, cover: g.cover, tagline: g.tagline, description: g.description, categories: g.categories,
      meets: g.meets, area: g.area, access: g.access, social: g.social, isSample: g.is_sample, members: g.member_count, joined: g.joined,
      friends: friendRows.filter((f) => f.group_id === g.id).map(publicUser),
    })),
  })
})
r.put('/groups/:id/membership', async (req, res) => {
  if (!(await db.one('SELECT 1 FROM groups WHERE id = $1', [req.params.id]))) return res.status(404).json({ error: 'Group not found.' })
  await db.query('INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, req.user.id, Date.now()])
  res.json({ ok: true })
})
r.delete('/groups/:id/membership', async (req, res) => {
  await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

export default r
