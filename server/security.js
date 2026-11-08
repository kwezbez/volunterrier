import crypto from 'node:crypto'
import { config } from './config.js'
import { db } from './db.js'

export const SESSION_COOKIE = config.isProd ? '__Host-vt_session' : 'vt_session'
export const CSRF_COOKIE = config.isProd ? '__Host-vt_csrf' : 'vt_csrf'

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
export const newId = () => crypto.randomUUID()
/** keyed hash so a leaked database can't be used to forge session/invite tokens */
export const hmac = (value) => crypto.createHmac('sha256', config.secret).update(value).digest('hex')

export function safeEqual(a, b) {
  const A = Buffer.from(String(a))
  const B = Buffer.from(String(b))
  return A.length === B.length && crypto.timingSafeEqual(A, B)
}

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function cookieStr(name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax']
  if (httpOnly) parts.push('HttpOnly')
  if (config.isProd) parts.push('Secure')
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge)}`)
  return parts.join('; ')
}
function appendCookie(res, c) {
  const prev = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : [c])
}

/* ---------------- sessions ---------------- */

export async function createSession(res, userId) {
  const token = randomToken(32)
  const now = Date.now()
  const expires = now + config.sessionDays * 86400_000
  await db.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)', [hmac(token), userId, now, expires])
  appendCookie(res, cookieStr(SESSION_COOKIE, token, { maxAge: config.sessionDays * 86400 }))
}

export async function destroySession(req, res) {
  const token = req.cookies[SESSION_COOKIE]
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hmac(token)])
  appendCookie(res, cookieStr(SESSION_COOKIE, '', { maxAge: 0 }))
}

/** attaches req.user (id, username, display_name) if the session cookie is valid */
export async function loadSession(req, _res, next) {
  try {
    req.cookies = parseCookies(req.headers.cookie)
    const token = req.cookies[SESSION_COOKIE]
    req.user = null
    if (token && token.length < 100) {
      const row = await db.one(
        `SELECT u.id, u.username, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > $2`,
        [hmac(token), Date.now()],
      )
      if (row) req.user = row
    }
    next()
  } catch (e) {
    next(e)
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' })
  next()
}

/* ---------------- CSRF (double-submit cookie + Origin check) ---------------- */

export function ensureCsrfCookie(req, res) {
  let t = req.cookies[CSRF_COOKIE]
  if (!t || t.length !== 43) {
    t = randomToken(32)
    // readable by our own JS so it can echo it in the X-CSRF-Token header; SameSite + Origin check do the rest
    appendCookie(res, cookieStr(CSRF_COOKIE, t, { httpOnly: false, maxAge: 30 * 86400 }))
  }
  return t
}

function allowedOrigin(origin, req) {
  if (!origin) return true // same-origin navigations / non-browser clients; cookie+header still required
  if (origin === config.appUrl || config.corsOrigins.includes(origin)) return true
  // same host as the request (e.g. preview URLs behind the same server)
  const host = req.headers['x-forwarded-host'] || req.headers.host
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function csrfProtect(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (!allowedOrigin(req.headers.origin, req)) return res.status(403).json({ error: 'Request origin not allowed.' })
  const cookie = req.cookies[CSRF_COOKIE]
  const header = req.headers['x-csrf-token']
  if (!cookie || !header || !safeEqual(cookie, header)) return res.status(403).json({ error: 'Security check failed. Refresh the page and try again.' })
  next()
}

export function cors(req, res, next) {
  const origin = req.headers.origin
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE')
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') return res.status(204).end()
  }
  next()
}

/* ---------------- rate limiting (in-memory, per instance) ---------------- */

const buckets = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k)
}, 60_000).unref()

/** returns true if allowed */
export function hit(key, limit, windowMs) {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  return b.count <= limit
}

export function rateLimit({ name, limit, windowMs, key = (req) => req.ip }) {
  return (req, res, next) => {
    if (!hit(`${name}:${key(req)}`, limit, windowMs)) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000))
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' })
    }
    next()
  }
}
