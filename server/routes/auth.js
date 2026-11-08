import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { SESSION_COOKIE, createSession, destroySession, ensureCsrfCookie, hit, hmac, newId, rateLimit, requireAuth } from '../security.js'
import { changePasswordSchema, loginSchema, parse, passwordOnlySchema, passwordProblem, registerSchema, resetSchema } from '../validate.js'

const r = Router()
const COST = 12
// constant-time-ish dummy hash so unknown usernames take as long as wrong passwords
const DUMMY = bcrypt.hashSync('dummy-password-for-timing', COST)

function recoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
  const bytes = crypto.randomBytes(20)
  let s = ''
  for (let i = 0; i < 20; i++) s += alphabet[bytes[i] % alphabet.length] + (i % 5 === 4 && i < 19 ? '-' : '')
  return s
}
const normCode = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{5})(?=.)/g, '$1-')

export async function meRow(userId) {
  return db.one(
    `SELECT id, username, display_name, profile, onboarded, progress_visibility, share_attendance_with_friends,
            home_label, home_lat, home_lng, created_at FROM users WHERE id = $1`,
    [userId],
  )
}
export function meJson(u) {
  return {
    username: u.username,
    displayName: u.display_name,
    profile: u.profile,
    onboarded: u.onboarded,
    settings: { progressVisibility: u.progress_visibility, shareAttendanceWithFriends: u.share_attendance_with_friends },
    home: u.home_label ? { label: u.home_label, lat: u.home_lat, lng: u.home_lng } : null,
    memberSince: u.created_at,
  }
}

r.get('/session', async (req, res) => {
  ensureCsrfCookie(req, res)
  res.setHeader('Cache-Control', 'no-store')
  if (!req.user) return res.json({ user: null })
  res.json({ user: meJson(await meRow(req.user.id)) })
})

r.post('/register', rateLimit({ name: 'register', limit: 30, windowMs: 60 * 60_000 }), async (req, res) => {
  const body = parse(registerSchema, req.body, res)
  if (!body) return
  const problem = passwordProblem(body.password, body.username)
  if (problem) return res.status(400).json({ error: problem, field: 'password' })
  const exists = await db.one('SELECT 1 FROM users WHERE username = $1', [body.username])
  if (exists) return res.status(409).json({ error: 'That username is taken.', field: 'username' })
  const code = recoveryCode()
  const id = newId()
  const [pw, rc] = await Promise.all([bcrypt.hash(body.password, COST), bcrypt.hash(code, COST)])
  const profile = { avatar: { kind: 'initials', value: '', color: crypto.randomInt(8) }, bio: '', interests: [], causes: [], skills: [], activities: [], availability: [], area: 'bu', maxDistance: 5, access: [], social: [] }
  try {
    await db.query(
      `INSERT INTO users (id, username, display_name, password_hash, recovery_hash, profile, created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [id, body.username, body.displayName, pw, rc, JSON.stringify(profile), Date.now()],
    )
  } catch (e) {
    if (String(e.code) === '23505') return res.status(409).json({ error: 'That username is taken.', field: 'username' })
    throw e
  }
  await createSession(res, id)
  res.status(201).json({ user: meJson(await meRow(id)), recoveryCode: code })
})

// Lockout is keyed on username + client IP so an attacker can't lock someone else out from
// a different network. A higher account-wide threshold still slows distributed guessing.
const failures = new Map() // `${username}|${ip}` -> { n, until }
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of failures) if (v.until < now && v.seen < now - 3_600_000) failures.delete(k)
}, 600_000).unref()

r.post(
  '/login',
  rateLimit({ name: 'login-ip', limit: 100, windowMs: 15 * 60_000 }),
  async (req, res) => {
    const body = parse(loginSchema, req.body, res)
    if (!body) return
    const key = `${body.username}|${req.ip}`
    const f = failures.get(key)
    const now = Date.now()
    if (f && f.until > now) {
      return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil((f.until - now) / 1000)} seconds.` })
    }
    if (!hit(`login-user-ip:${key}`, 10, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })
    if (!hit(`login-user:${body.username}`, 50, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts for this account right now. Try again later.' })
    const u = await db.one('SELECT id, password_hash FROM users WHERE username = $1', [body.username])
    const ok = await bcrypt.compare(body.password, u ? u.password_hash : DUMMY)
    if (!u || !ok) {
      const n = (f?.n ?? 0) + 1
      failures.set(key, { n, seen: now, until: n >= 5 ? now + Math.min(15 * 60_000, 30_000 * 2 ** (n - 5)) : 0 })
      return res.status(401).json({ error: 'Incorrect username or password.' })
    }
    failures.delete(key)
    // drop any session this browser already had (prevents session fixation) and expired ones
    const old = req.cookies[SESSION_COOKIE]
    if (old) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hmac(old)])
    await db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at < $2', [u.id, now])
    await createSession(res, u.id)
    res.json({ user: meJson(await meRow(u.id)) })
  },
)

r.post('/logout', async (req, res) => {
  await destroySession(req, res)
  res.json({ ok: true })
})

// Password reset with the one-time recovery code shown at sign-up (no email service required).
r.post('/reset', rateLimit({ name: 'reset-ip', limit: 30, windowMs: 15 * 60_000 }), async (req, res) => {
  const body = parse(resetSchema, req.body, res)
  if (!body) return
  if (!hit(`reset-user:${body.username}`, 5, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })
  const problem = passwordProblem(body.newPassword, body.username)
  if (problem) return res.status(400).json({ error: problem, field: 'newPassword' })
  const u = await db.one('SELECT id, recovery_hash FROM users WHERE username = $1', [body.username])
  const ok = await bcrypt.compare(normCode(body.recoveryCode), u ? u.recovery_hash : DUMMY)
  if (!u || !ok) return res.status(400).json({ error: 'That username and recovery code don’t match.' })
  const code = recoveryCode()
  const [pw, rc] = await Promise.all([bcrypt.hash(body.newPassword, COST), bcrypt.hash(code, COST)])
  await db.query('UPDATE users SET password_hash = $2, recovery_hash = $3 WHERE id = $1', [u.id, pw, rc])
  await db.query('DELETE FROM sessions WHERE user_id = $1', [u.id]) // sign out everywhere
  await createSession(res, u.id)
  res.json({ user: meJson(await meRow(u.id)), recoveryCode: code })
})

r.post('/change-password', requireAuth, rateLimit({ name: 'chpw', limit: 10, windowMs: 15 * 60_000 }), async (req, res) => {
  const body = parse(changePasswordSchema, req.body, res)
  if (!body) return
  const u = await db.one('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  if (!(await bcrypt.compare(body.currentPassword, u.password_hash))) return res.status(400).json({ error: 'Current password is incorrect.', field: 'currentPassword' })
  const problem = passwordProblem(body.newPassword, req.user.username)
  if (problem) return res.status(400).json({ error: problem, field: 'newPassword' })
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, await bcrypt.hash(body.newPassword, COST)])
  await db.query('DELETE FROM sessions WHERE user_id = $1', [req.user.id])
  await createSession(res, req.user.id)
  res.json({ ok: true })
})

r.post('/recovery-code', requireAuth, rateLimit({ name: 'rc', limit: 5, windowMs: 15 * 60_000 }), async (req, res) => {
  const body = parse(passwordOnlySchema, req.body, res)
  if (!body) return
  const u = await db.one('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  if (!(await bcrypt.compare(body.password, u.password_hash))) return res.status(400).json({ error: 'Password is incorrect.', field: 'password' })
  const code = recoveryCode()
  await db.query('UPDATE users SET recovery_hash = $2 WHERE id = $1', [req.user.id, await bcrypt.hash(code, COST)])
  res.json({ recoveryCode: code })
})

r.post('/delete-account', requireAuth, rateLimit({ name: 'del', limit: 5, windowMs: 15 * 60_000 }), async (req, res) => {
  const body = parse(passwordOnlySchema, req.body, res)
  if (!body) return
  const u = await db.one('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  if (!(await bcrypt.compare(body.password, u.password_hash))) return res.status(400).json({ error: 'Password is incorrect.', field: 'password' })
  await destroySession(req, res)
  await db.query('DELETE FROM users WHERE id = $1', [req.user.id])
  res.json({ ok: true })
})

export default r
