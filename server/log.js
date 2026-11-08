// Minimal structured logger: one JSON line per event in production (Render's log viewer
// shows these), readable lines in development. Never log cookies, passwords or tokens.
import { config } from './config.js'

export function log(level, msg, fields = {}) {
  if (config.isProd) console[level === 'error' ? 'error' : 'log'](JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }))
  else console[level === 'error' ? 'error' : 'log'](`[${level}] ${msg}`, Object.keys(fields).length ? fields : '')
}

/** coarse client network (IPv4 /16, IPv6 /32) — enough to confirm proxy/IP handling without logging full IPs */
function ipPrefix(ip = '') {
  const v4 = ip.replace(/^::ffff:/, '')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.') + '.x.x'
  return ip.split(':').slice(0, 2).join(':') + '::'
}

/** request log: method, path (no query string), status, duration */
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint()
  const path = req.originalUrl.split('?')[0] // full path, never the query string
  res.on('finish', () => {
    if (path === '/healthz') return
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    if (!config.isProd && !path.startsWith('/api')) return
    log(res.statusCode >= 500 ? 'error' : 'info', 'request', { method: req.method, path, status: res.statusCode, ms: Math.round(ms), net: ipPrefix(req.ip) })
  })
  next()
}
