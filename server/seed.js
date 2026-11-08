// Loads clearly-labelled SAMPLE listings on first run (disable with SEED_SAMPLE_DATA=false).
import { db } from './db.js'
import { COORDS, CITY, GROUPS, SAMPLE_TZ, seedOpportunities } from './seed-data.js'

export async function seed() {
  const { n } = await db.one('SELECT COUNT(*)::int AS n FROM groups')
  if (n === 0) {
    for (const g of GROUPS) {
      await db.query(
        `INSERT INTO groups (id, name, emoji, cover, tagline, description, categories, meets, area, access, social, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,TRUE) ON CONFLICT DO NOTHING`,
        [g.id, g.name, g.emoji, g.cover, g.tagline, g.description, JSON.stringify(g.categories), g.meets, g.area, JSON.stringify(g.access), JSON.stringify(g.social)],
      )
    }
  }
  const { m } = await db.one('SELECT COUNT(*)::int AS m FROM opportunities WHERE is_sample = TRUE')
  if (m === 0) {
    for (const o of seedOpportunities()) {
      const [lat, lng] = COORDS[o.id] ?? [null, null]
      const start = o.date
      const end = start + o.durationHours * 3_600_000
      await db.query(
        `INSERT INTO opportunities (id, organizer_id, group_id, org_name, title, summary, description, expect, vibe, category, activities, causes, skills,
           access, social, image, area, address, city, lat, lng, transit, start_at, end_at, time_zone, max_participants, is_sample, created_at)
         VALUES ($1,NULL,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,TRUE,$26)
         ON CONFLICT DO NOTHING`,
        [o.id, o.groupId ?? null, o.org, o.title, o.summary, o.description, JSON.stringify(o.expect), o.vibe, o.category, JSON.stringify(o.activities),
          JSON.stringify(o.causes), JSON.stringify(o.skills), JSON.stringify(o.access), JSON.stringify(o.social), o.image, o.area, o.address,
          CITY[o.area] ?? 'Boston, MA', lat, lng, o.transit ?? null, start, end, SAMPLE_TZ, o.maxParticipants, Date.now()],
      )
    }
    console.log('Loaded sample listings (labelled "Sample" in the UI).')
  }
  // keep sample listings in the future: roll past ones (with no signups) forward by whole weeks
  const now = Date.now()
  const week = 7 * 86400_000
  const stale = await db.query(
    `SELECT id, start_at, end_at FROM opportunities o WHERE is_sample = TRUE AND end_at <= $1
       AND NOT EXISTS (SELECT 1 FROM signups s WHERE s.opportunity_id = o.id)`,
    [now],
  )
  for (const s of stale) {
    const shift = Math.ceil((now - s.end_at) / week) * week + week
    await db.query('UPDATE opportunities SET start_at = start_at + $2, end_at = end_at + $2 WHERE id = $1', [s.id, shift])
  }
}
