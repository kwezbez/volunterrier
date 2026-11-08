// VolunTerrier API + static web server.
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { db, initDb } from './db.js'
import { log, requestLogger } from './log.js'
import { seed } from './seed.js'
import { cors, csrfProtect, loadSession } from './security.js'
import auth from './routes/auth.js'
import me from './routes/me.js'
import opportunities from './routes/opportunities.js'
import social from './routes/social.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', config.trustProxy) // correct client IPs (rate limiting) behind Render/Railway/Fly proxies

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https://images.unsplash.com', 'https://*.tile.openstreetmap.org', 'https:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    strictTransportSecurity: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()')
  next()
})

// Health check used by Render: verifies the database answers, without exposing details.
app.get('/healthz', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ ok: true })
  } catch {
    res.status(503).json({ ok: false })
  }
})

// Belt-and-braces HTTPS redirect (hosts like Render terminate TLS and set X-Forwarded-Proto).
if (config.isProd) {
  app.use((req, res, next) => {
    if (req.secure || req.path === '/healthz') return next()
    if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`)
    res.status(403).json({ error: 'HTTPS required.' })
  })
}
app.use(requestLogger)

const api = express.Router()
api.use(cors)
api.use(express.json({ limit: '600kb' }))
api.use(loadSession)
api.use(csrfProtect)
api.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})
api.use('/auth', auth)
api.use('/me', me)
api.use('/opportunities', opportunities)
api.use('/', social)
api.use((_req, res) => res.status(404).json({ error: 'Not found.' }))
// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large.' })
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' })
  log('error', 'unhandled error', { message: err?.message, stack: config.isProd ? undefined : err?.stack })
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
})
app.use('/api', api)

// Serve the built frontend (npm run build) from the same origin — no CORS needed in production.
const dist = path.join(here, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

await initDb()
if (config.seedSamples) await seed()
const cleanup = () => db.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]).catch((e) => log('error', 'session cleanup failed', { message: e.message }))
cleanup()
setInterval(cleanup, 6 * 3_600_000).unref()
app.listen(config.port, () => {
  log('info', `VolunTerrier listening on :${config.port}`, { env: config.isProd ? 'production' : 'development', db: db.kind })
})
