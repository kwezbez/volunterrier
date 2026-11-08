// Shapes database rows into API responses. Only whitelisted, non-sensitive fields leave the server.

export const hoursOf = (o) => Math.min(12, Math.round(((o.end_at - o.start_at) / 3_600_000) * 4) / 4)
export const isCompleted = (o, now = Date.now()) => o.completed_at != null || o.end_at <= now

export const publicUser = (u) => ({
  username: u.username,
  displayName: u.display_name,
  avatar: u.avatar ?? u.profile?.avatar ?? null,
})

export function opportunity(row, extra = {}) {
  const now = Date.now()
  return {
    id: row.id,
    title: row.title,
    org: row.org_name,
    groupId: row.group_id,
    image: row.image,
    summary: row.summary,
    description: row.description,
    expect: row.expect,
    vibe: row.vibe,
    category: row.category,
    activities: row.activities,
    causes: row.causes,
    skills: row.skills,
    access: row.access,
    social: row.social,
    area: row.area,
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    transit: row.transit,
    startAt: row.start_at,
    endAt: row.end_at,
    timeZone: row.time_zone,
    date: new Date(row.start_at).toISOString(),
    durationHours: hoursOf(row),
    maxParticipants: row.max_participants,
    isSample: row.is_sample,
    organizerName: row.organizer_name ?? null,
    isMine: !!extra.viewerId && row.organizer_id === extra.viewerId,
    goingCount: row.going_count ?? 0,
    iAmGoing: !!row.i_am_going,
    myBuddy: !!row.my_buddy,
    myVerified: row.my_verified_at != null,
    completed: isCompleted(row, now),
    started: row.start_at <= now,
    friendsGoing: extra.friendsGoing ?? [],
    distance: extra.distance ?? null,
  }
}

/** SELECT fragment used by every opportunity list ($1 = viewer id) */
export const OPP_SELECT = `
  SELECT o.*, u.display_name AS organizer_name,
    (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id) AS going_count,
    (me.user_id IS NOT NULL) AS i_am_going, me.buddy AS my_buddy, me.verified_at AS my_verified_at
  FROM opportunities o
  LEFT JOIN users u ON u.id = o.organizer_id
  LEFT JOIN signups me ON me.opportunity_id = o.id AND me.user_id = $1`

/** friends (who share attendance) going to events. Returns Map<oppId, user[]> */
export async function friendsGoingMap(db, viewerId, oppId = null) {
  const rows = await db.query(
    `SELECT s.opportunity_id, u.username, u.display_name, u.profile->'avatar' AS avatar
       FROM signups s
       JOIN users u ON u.id = s.user_id
       JOIN friendships f ON f.status = 'accepted'
        AND ((f.user_a = $1 AND f.user_b = u.id) OR (f.user_b = $1 AND f.user_a = u.id))
      WHERE u.share_attendance_with_friends = TRUE
        AND ($2::text IS NULL OR s.opportunity_id = $2)`,
    [viewerId, oppId],
  )
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.opportunity_id)) map.set(r.opportunity_id, [])
    map.get(r.opportunity_id).push(publicUser(r))
  }
  return map
}
