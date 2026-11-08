// Runtime configuration — everything secret comes from environment variables.
import crypto from 'node:crypto'
import fs from 'node:fs'

// Minimal .env loader (no dependency). Real environment variables always win.
try {
  for (const line of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch {
  /* no .env file — fine */
}

const isProd = process.env.NODE_ENV === 'production'

let secret = process.env.SESSION_SECRET
if (!secret || secret.length < 32) {
  if (isProd) {
    console.error('FATAL: SESSION_SECRET must be set to a random string of at least 32 characters in production.')
    process.exit(1)
  }
  // Dev only: ephemeral random secret (sessions reset when the server restarts).
  secret = crypto.randomBytes(48).toString('hex')
  console.warn('[dev] SESSION_SECRET not set — using a temporary random secret. Set it in .env to keep sessions across restarts.')
}

const appUrl = (process.env.APP_URL || (isProd ? '' : 'http://localhost:5173')).replace(/\/$/, '')
if (isProd && !appUrl) {
  console.error('FATAL: APP_URL must be set in production (e.g. https://volunterrier.onrender.com).')
  process.exit(1)
}

if (isProd && !process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set — using the embedded database on local disk. Most hosts wipe the disk on redeploy, so data will be lost. Set DATABASE_URL to a managed Postgres for production.')
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 3001),
  secret,
  appUrl,
  // Extra origins allowed to call the API with credentials (comma separated). Same-origin needs nothing.
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  seedSamples: process.env.SEED_SAMPLE_DATA ? process.env.SEED_SAMPLE_DATA === 'true' : true,
  geocoder: process.env.GEOCODER || 'nominatim', // 'nominatim' | 'off'
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  sessionDays: 14,
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : isProd ? 1 : 0,
}
