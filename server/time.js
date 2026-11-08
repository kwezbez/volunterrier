// Time-zone helpers. Events are stored as absolute UTC instants (start_at/end_at in ms)
// plus the IANA zone they were entered in, so overlap checks are exact across zones,
// DST changes and midnight.

const ZONES = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])
ZONES.add('UTC')
export const isValidTimeZone = (tz) => typeof tz === 'string' && (ZONES.size > 1 ? ZONES.has(tz) : !!tryZone(tz))
function tryZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** offset (ms) of `tz` from UTC at instant `utcMs` */
function offsetAt(utcMs, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** wall-clock date ('YYYY-MM-DD') + time ('HH:MM') in `tz` -> UTC epoch ms */
export function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let utc = guess - offsetAt(guess, tz)
  utc = guess - offsetAt(utc, tz) // second pass handles DST boundaries
  return utc
}

/**
 * Build [start, end] from a start date/time and an end time on the same or next day.
 * If the end time is earlier than (or equal to) the start time, the event crosses midnight.
 */
export function eventWindow(date, startTime, endTime, tz) {
  const start = zonedToUtc(date, startTime, tz)
  let end = zonedToUtc(date, endTime, tz)
  if (end <= start) {
    const next = new Date(Date.UTC(...date.split('-').map((n, i) => (i === 1 ? +n - 1 : +n))) + 86400_000).toISOString().slice(0, 10)
    end = zonedToUtc(next, endTime, tz)
  }
  return { start, end }
}

/** today's date (YYYY-MM-DD) as seen in tz, offset by `days` */
export function localDate(tz, days = 0) {
  const d = new Date(Date.now() + days * 86400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** half-open interval overlap: [aS,aE) vs [bS,bE) */
export const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE
