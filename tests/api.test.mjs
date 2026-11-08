// End-to-end API tests: node tests/api.test.mjs  (server must be running; BASE defaults to http://localhost:3001)
const BASE = process.env.BASE || 'http://localhost:3001'
let pass = 0, fail = 0
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗'} ${msg}`) }

class Client {
  constructor() { this.jar = {} }
  cookieHeader() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') }
  async req(method, path, body, { csrf = true, origin, ip } = {}) {
    const headers = { cookie: this.cookieHeader() }
    if (ip) headers['x-forwarded-for'] = ip
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (csrf && this.jar.vt_csrf) headers['x-csrf-token'] = this.jar.vt_csrf
    if (origin) headers.origin = origin
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';'); const i = kv.indexOf('=')
      this.jar[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1))
    }
    let json = null; try { json = await res.json() } catch {}
    return { status: res.status, json, headers: res.headers }
  }
  get(p, o) { return this.req('GET', p, undefined, o) }
  post(p, b = {}, o) { return this.req('POST', p, b, o) }
  put(p, b = {}, o) { return this.req('PUT', p, b, o) }
  patch(p, b = {}, o) { return this.req('PATCH', p, b, o) }
  del(p, o) { return this.req('DELETE', p, undefined, o) }
}

const uniq = Date.now().toString(36).slice(-5)
const A = new Client(), B = new Client(), C = new Client()
for (const c of [A, B, C]) await c.get('/api/auth/session')

// ---------- auth ----------
let r = await A.post('/api/auth/register', { username: `alice_${uniq}`, password: 'short', displayName: 'Alice' })
ok(r.status === 400, 'rejects weak password')
r = await A.post('/api/auth/register', { username: `alice_${uniq}`, password: 'password123', displayName: 'Alice' })
ok(r.status === 400, 'rejects common password')
r = await A.post('/api/auth/register', { username: `alice_${uniq}`, password: 'correct horse battery', displayName: 'Alice' }, { csrf: false })
ok(r.status === 403, 'CSRF: rejects POST without token')
r = await A.post('/api/auth/register', { username: `alice_${uniq}`, password: 'correct horse battery', displayName: 'Alice' }, { origin: 'https://evil.example' })
ok(r.status === 403, 'CSRF: rejects foreign Origin')
r = await A.post('/api/auth/register', { username: `Alice_${uniq}`, password: 'correct horse battery', displayName: 'Alice <b>' })
ok(r.status === 201 && r.json.recoveryCode && !JSON.stringify(r.json).includes('hash'), 'registers, returns recovery code, no hashes')
const aliceCode = r.json.recoveryCode
ok(r.headers.get('set-cookie')?.includes('HttpOnly') && r.headers.get('set-cookie')?.includes('SameSite=Lax'), 'session cookie is HttpOnly + SameSite')
r = await B.post('/api/auth/register', { username: `alice_${uniq}`, password: 'another good pass', displayName: 'Imposter' })
ok(r.status === 409, 'usernames are unique (case-insensitive)')
r = await B.post('/api/auth/register', { username: `bob_${uniq}`, password: 'bob likes volunteering', displayName: 'Bob' })
ok(r.status === 201, 'second user registers')
r = await C.post('/api/auth/register', { username: `cara_${uniq}`, password: 'cara is a stranger', displayName: 'Cara' })
ok(r.status === 201, 'third user registers')

const anon = new Client(); await anon.get('/api/auth/session')
r = await anon.get('/api/opportunities')
ok(r.status === 401, 'protected route requires login')
r = await anon.post('/api/auth/login', { username: `alice_${uniq}`, password: 'wrong password!!' })
ok(r.status === 401 && r.json.error === 'Incorrect username or password.', 'wrong password -> generic error')
r = await anon.post('/api/auth/login', { username: `nobody_${uniq}`, password: 'wrong password!!' })
ok(r.status === 401 && r.json.error === 'Incorrect username or password.', 'unknown user -> same generic error')
for (let i = 0; i < 5; i++) r = await anon.post('/api/auth/login', { username: `alice_${uniq}`, password: 'wrong password!!' })
ok(r.status === 429, 'repeated failures lock the account temporarily')

// password reset with recovery code
const D = new Client(); await D.get('/api/auth/session')
r = await D.post('/api/auth/reset', { username: `bob_${uniq}`, recoveryCode: 'AAAAA-BBBBB-CCCCC-DDDDD', newPassword: 'new bob password 1' })
ok(r.status === 400, 'reset with wrong recovery code fails')

// ---------- profile ----------
r = await A.put('/api/me/profile', { displayName: 'Alice', avatar: { kind: 'emoji', value: '🐶', color: 1 }, interests: ['animals'], activities: ['Dog walking'], area: 'bu', maxDistance: 5 })
ok(r.status === 200 && r.json.user.onboarded, 'profile saves')
r = await A.put('/api/me/profile', { displayName: 'Alice', avatar: { kind: 'image', value: 'javascript:alert(1)', color: 1 } })
ok(r.status === 400, 'rejects non-image avatar data')
r = await A.put('/api/me/location', { label: 'Home', lat: 42.351234, lng: -71.105678 })
ok(r.json.user.home.lat === 42.35 && r.json.user.home.lng === -71.11, 'saved location is coarsened (~1 km)')

// ---------- search ----------
r = await A.get('/api/opportunities/search?q=02215&radius=5')
ok(r.status === 200 && r.json.results.length > 0 && r.json.results.every((o) => o.distance === null || o.distance <= 5), `ZIP search within 5 mi (${r.json.results?.length} results)`)
const n5 = r.json.results.length
r = await A.get('/api/opportunities/search?q=02215&radius=50')
ok(r.json.results.length >= n5, 'larger radius returns at least as many')
r = await A.get('/api/opportunities/search?q=Cambridge&radius=5&category=education')
ok(r.status === 200 && r.json.results.every((o) => o.category === 'education'), 'category filter')
r = await A.get('/api/opportunities/search?lat=42.35&lng=-71.1&radius=10&includeRemote=false')
ok(r.status === 200 && r.json.results.every((o) => o.distance !== null), 'browser-location search, remote excluded')
r = await A.get("/api/opportunities/search?q=' OR 1=1 --&radius=5")
ok([200, 404].includes(r.status), 'SQL-ish input handled safely')

// ---------- create events (Alice organizes) ----------
const today = new Date(Date.now() + 86400_000 * 3).toISOString().slice(0, 10)
const mk = (title, startTime, endTime, extra = {}) => A.post('/api/opportunities', { title, description: 'A test event with plenty of description text.', category: 'community', org: 'Test Org', area: 'bu', address: '775 Commonwealth Ave', city: 'Boston', date: today, startTime, endTime, timeZone: 'America/New_York', maxParticipants: 2, ...extra })
const e1 = (await mk('Evening Event One', '18:00', '20:00')).json.opportunity
const e2 = (await mk('Overlapping Event Two', '19:30', '21:00')).json.opportunity
const e3 = (await mk('Back To Back Three', '20:00', '21:00')).json.opportunity
const late = await mk('Late Night Shift', '23:00', '02:00')
ok(late.status === 201 && late.json.opportunity.endAt - late.json.opportunity.startAt === 3 * 3600_000, 'event crossing midnight stored with correct 3h duration')
const after = (await mk('After Midnight', '01:00', '03:00', { date: new Date(Date.now() + 86400_000 * 4).toISOString().slice(0, 10) })).json.opportunity
const tokyo = (await mk('Tokyo-time Event', '08:30', '10:00', { timeZone: 'Asia/Tokyo', date: new Date(Date.now() + 86400_000 * 4).toISOString().slice(0, 10) })).json.opportunity
r = await mk('<script>alert(1)</script> event', '10:00', '11:00', { image: 'javascript:alert(1)' })
ok(r.status === 400, 'rejects javascript: image URL')
r = await mk('Past event', '10:00', '11:00', { date: '2020-01-01' })
ok(r.status === 400, 'rejects events in the past')

// ---------- signups & conflicts (Bob) ----------
r = await B.post(`/api/opportunities/${e1.id}/signup`)
ok(r.status === 201, 'Bob signs up for event 1')
r = await B.post(`/api/opportunities/${e1.id}/signup`)
ok(r.status === 409 && r.json.code === 'DUPLICATE', 'duplicate signup prevented')
r = await B.post(`/api/opportunities/${e2.id}/signup`)
ok(r.status === 409 && r.json.code === 'SCHEDULE_CONFLICT' && r.json.error === 'You already have something planned during this time.', 'overlapping signup blocked with exact message')
r = await B.post(`/api/opportunities/${e3.id}/signup`)
ok(r.status === 201, 'back-to-back event (ends 20:00 / starts 20:00) is allowed')
r = await B.post(`/api/opportunities/${late.json.opportunity.id}/signup`)
ok(r.status === 201, 'late-night event signup ok')
r = await B.post(`/api/opportunities/${after.id}/signup`)
ok(r.status === 409 && r.json.code === 'SCHEDULE_CONFLICT', 'conflict detected across midnight (23:00–02:00 vs 01:00–03:00)')
// Tokyo 08:30 JST is the previous evening in Boston — overlap must be computed on absolute time
const bobEvents = (await B.get('/api/opportunities/schedule/mine')).json.events
const tokyoOverlap = bobEvents.some((e) => tokyo.startAt < e.endAt && e.startAt < tokyo.endAt)
r = await B.post(`/api/opportunities/${tokyo.id}/signup`)
ok(tokyoOverlap ? r.json.code === 'SCHEDULE_CONFLICT' : r.status === 201, `time-zone aware check (Tokyo event ${tokyoOverlap ? 'overlaps a Boston evening event → blocked' : 'free → allowed'})`)
r = await A.post(`/api/opportunities/${e1.id}/signup`)
ok(r.status === 409 && r.json.code === 'ORGANIZER', 'organizer can’t sign up to own event')

// concurrency: two simultaneous overlapping signups -> only one succeeds
const e4 = (await mk('Race A', '12:00', '13:00', { maxParticipants: 10 })).json.opportunity
const e5 = (await mk('Race B', '12:30', '13:30', { maxParticipants: 10 })).json.opportunity
const [x, y] = await Promise.all([C.post(`/api/opportunities/${e4.id}/signup`), C.post(`/api/opportunities/${e5.id}/signup`)])
ok([x.status, y.status].sort().join() === '201,409', `concurrent overlapping signups: only one succeeds (${x.status}, ${y.status})`)
// capacity: e1 max 2 -> Bob + Cara fills it
await C.del(`/api/opportunities/${e4.id}/signup`); await C.del(`/api/opportunities/${e5.id}/signup`)
r = await C.post(`/api/opportunities/${e1.id}/signup`)
ok(r.status === 201, 'Cara joins event 1')
const E = new Client(); await E.get('/api/auth/session'); await E.post('/api/auth/register', { username: `eve_${uniq}`, password: 'eve wants in too', displayName: 'Eve' })
r = await E.post(`/api/opportunities/${e1.id}/signup`)
ok(r.status === 409 && r.json.code === 'FULL', 'capacity enforced')

// schedule
r = await B.get('/api/opportunities/schedule/mine')
ok(r.status === 200 && r.json.events.some((e) => e.id === e1.id), 'schedule lists signups')

// ---------- verified hours ----------
r = await B.post(`/api/opportunities/${e1.id}/attendees/x/verify`)
ok(r.status === 403, 'non-organizer cannot verify hours')
r = await A.post(`/api/opportunities/${e1.id}/complete`)
ok(r.status === 400, 'cannot complete before start')
const now1 = new Date(); const pad = (n) => String(n).padStart(2, '0')
const nyNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + 60_000))
const P = Object.fromEntries(nyNow.map((p) => [p.type, p.value]))
const nowEvent = (await A.post('/api/opportunities', { title: 'Happening Right Now', description: 'An event that starts in about a minute.', category: 'community', org: 'Test Org', area: 'remote', date: `${P.year}-${P.month}-${P.day}`, startTime: `${P.hour}:${P.minute}`, endTime: `${pad((+P.hour + 2) % 24)}:${P.minute}`, timeZone: 'America/New_York', maxParticipants: 5 })).json.opportunity
ok(!!nowEvent, 'organizer creates an event starting now')
r = await B.post(`/api/opportunities/${nowEvent.id}/signup`)
ok(r.status === 201 || r.json?.code === 'SCHEDULE_CONFLICT', `Bob joins live event (${r.status})`)
r = await C.post(`/api/opportunities/${nowEvent.id}/signup`)
ok(r.status === 201, 'Cara joins live event')
const detailA = (await A.get(`/api/opportunities/${nowEvent.id}`)).json.opportunity
ok(detailA.manage && detailA.manage.checkinCode && detailA.manage.attendees.length >= 1, 'organizer sees check-in code and attendees')
const detailB = (await B.get(`/api/opportunities/${nowEvent.id}`)).json.opportunity
ok(!detailB.manage && !JSON.stringify(detailB).includes(detailA.manage.checkinCode), 'volunteers cannot see check-in code')
r = await C.post(`/api/opportunities/${nowEvent.id}/checkin`, { code: 'WRONG1' })
ok(r.status === 400, 'wrong check-in code rejected')
r = await C.post(`/api/opportunities/${nowEvent.id}/checkin`, { code: detailA.manage.checkinCode })
ok(r.status === 200, 'correct check-in code verifies attendance')
let pc = (await C.get('/api/progress')).json.progress
ok(pc.totalHours === 0, 'hours not counted until event is completed')
await new Promise((res) => setTimeout(res, 61_000))
r = await A.post(`/api/opportunities/${nowEvent.id}/complete`)
ok(r.status === 200, 'organizer marks event completed')
pc = (await C.get('/api/progress')).json.progress
ok(pc.totalHours === 2 && pc.eventsAttended === 1, `verified hours credited after completion (${pc.totalHours}h)`)
const caraId = detailA.manage.attendees.find((a) => a.username === `cara_${uniq}`)?.id
r = await A.post(`/api/opportunities/${nowEvent.id}/attendees/${caraId}/verify`, { verified: false })
ok(r.status === 200, 'organizer can revoke verification')
ok((await C.get('/api/progress')).json.progress.totalHours === 0, 'revoked -> hours removed')
await A.post(`/api/opportunities/${nowEvent.id}/attendees/${caraId}/verify`, { verified: true })
r = await C.put('/api/me/profile', { displayName: 'Cara', avatar: { kind: 'emoji', value: '🐶', color: 1 }, totalHours: 999, hours: 999 })
ok((await C.get('/api/progress')).json.progress.totalHours === 2, 'extra fields cannot inflate hours')
r = await C.post(`/api/opportunities/${nowEvent.id}/attendees/${caraId}/verify`)
ok(r.status === 403, 'volunteer cannot verify own hours')
r = await C.del(`/api/opportunities/${nowEvent.id}/signup`)
ok(r.status === 409, 'verified attendance cannot be cancelled')

// ---------- privacy: progress private by default ----------
r = await B.get(`/api/users/cara_${uniq}`)
ok(r.status === 200 && r.json.profile.progress === null, 'progress is PRIVATE by default (server returns none)')
ok(!JSON.stringify(r.json).match(/password|hash|home|access|availability/), 'public profile leaks no sensitive fields')
r = await C.patch('/api/me/settings', { progressVisibility: 'public' })
ok(r.json.user.settings.progressVisibility === 'public', 'Cara makes progress public')
r = await B.get(`/api/users/cara_${uniq}`)
ok(r.json.profile.progress?.totalHours === 2, 'public progress visible to other users')
await C.patch('/api/me/settings', { progressVisibility: 'private' })
r = await B.get(`/api/users/cara_${uniq}`)
ok(r.json.profile.progress === null, 'switching back to private hides it again')

// ---------- invitations & friends ----------
r = await A.post('/api/invites', { opportunityId: e3.id })
ok(r.status === 201 && /#\/invite\/[A-Za-z0-9_-]{43}$/.test(r.json.url), 'invite link uses 256-bit random token')
const inviteUrl = r.json.url
ok(!inviteUrl.includes(`alice_${uniq}`) && !inviteUrl.toLowerCase().includes('alice'), 'invite link reveals no username')
const token = inviteUrl.split('/invite/')[1]
r = await anon.post('/api/invites/lookup', { token })
ok(r.status === 200 && r.json.invite.inviterName === 'Alice' && !JSON.stringify(r.json).includes(`alice_${uniq}`), 'invite preview shows display name only')
r = await anon.post('/api/invites/lookup', { token: `${token.slice(0, -2)}xx` })
ok(r.status === 404, 'tampered token rejected')
r = await A.post('/api/invites/accept', { token })
ok(r.status === 400, 'cannot accept own invite')
r = await B.post('/api/invites/accept', { token })
ok(r.status === 200 && r.json.opportunityId === e3.id, 'Bob accepts invite')
r = await A.get('/api/invites')
ok(r.json.invites[0].accepted.some((u) => u.username === `bob_${uniq}`), 'inviter sees who accepted')
r = await A.get('/api/friends')
ok(r.json.friends.some((f) => f.username === `bob_${uniq}`), 'accepting makes them friends')
r = await A.get(`/api/opportunities/${e1.id}`)
ok(r.json.opportunity.friendsGoing.some((f) => f.username === `bob_${uniq}`) && !r.json.opportunity.friendsGoing.some((f) => f.username === `cara_${uniq}`), 'friends attending shown; non-friends hidden')
await B.patch('/api/me/settings', { shareAttendanceWithFriends: false })
r = await A.get(`/api/opportunities/${e1.id}`)
ok(!r.json.opportunity.friendsGoing.length, 'attendance sharing can be turned off')
await B.patch('/api/me/settings', { shareAttendanceWithFriends: true })
r = await A.del(`/api/invites/${(await A.get('/api/invites')).json.invites[0].id}`)
r = await anon.post('/api/invites/lookup', { token })
ok(r.status === 404, 'revoked invite no longer works')
// friend request flow
r = await A.post('/api/friends/request', { username: `cara_${uniq}` })
ok(r.status === 201, 'friend request sent')
r = await C.post(`/api/friends/alice_${uniq}/accept`)
ok(r.json.status === 'friends', 'friend request accepted')
// feed respects privacy
r = await A.get('/api/feed')
ok(!r.json.feed.some((f) => f.user.username === `cara_${uniq}`), 'feed hides private friend activity')
await C.patch('/api/me/settings', { progressVisibility: 'public' })
r = await A.get('/api/feed')
ok(r.json.feed.some((f) => f.user.username === `cara_${uniq}`), 'feed shows public friend activity')

// ---------- access control ----------
r = await B.del(`/api/opportunities/${e1.id}`)
ok(r.status === 404, 'cannot delete someone else’s event')
r = await B.patch('/api/me/settings', { progressVisibility: 'everyone' })
ok(r.status === 400, 'invalid privacy value rejected')

// password reset with real code
const F = new Client(); await F.get('/api/auth/session')
r = await F.post('/api/auth/reset', { username: `alice_${uniq}`, recoveryCode: aliceCode.toLowerCase(), newPassword: 'brand new alice pass' })
ok(r.status === 200 && r.json.recoveryCode && r.json.recoveryCode !== aliceCode, 'reset with recovery code works and issues a new code')
r = await A.get('/api/me')
ok(r.status === 401, 'reset signs out other sessions')
r = await F.post('/api/auth/reset', { username: `alice_${uniq}`, recoveryCode: aliceCode, newPassword: 'another alice pass' })
ok(r.status === 400, 'recovery code is single-use')
r = await F.post('/api/auth/logout')
r = await F.get('/api/me')
ok(r.status === 401, 'logout ends session')


// ---------- SQL injection (safe, non-destructive payloads) ----------
const sqli = ["' OR '1'='1", "alice' --", "'; DROP TABLE users; --", "\\' OR 1=1 /*", "admin'/*"]
const G = new Client(); await G.get('/api/auth/session')
let sqliOk = true
for (const u of sqli) {
  r = await G.post('/api/auth/login', { username: u, password: "' OR '1'='1" }, { ip: '198.51.100.7' })
  if (r.status === 200) sqliOk = false
}
ok(sqliOk, 'SQL injection payloads in login never authenticate')
r = await G.post('/api/auth/register', { username: "x' OR '1'='1", password: 'a perfectly fine password', displayName: 'X' }, { ip: '198.51.100.8' })
ok(r.status === 400, 'SQL injection payload rejected as username at registration')
r = await B.get(`/api/users/${encodeURIComponent("alice' OR '1'='1")}`)
ok(r.status === 404, 'SQL injection in profile lookup returns not found')
r = await B.get(`/api/opportunities/${encodeURIComponent("x' OR '1'='1")}`)
ok(r.status === 404, 'SQL injection in opportunity id returns not found')
r = await B.get(`/api/opportunities/search?q=${encodeURIComponent("Boston'; DELETE FROM opportunities; --")}&radius=10`)
const stillThere = (await B.get('/api/opportunities')).json.opportunities.length > 0
ok(stillThere, 'SQL injection in search text leaves data intact')

// ---------- stored XSS is stored as inert text ----------
const xss = '<img src=x onerror=alert(1)><script>alert(1)</script>'
r = await B.put('/api/me/profile', { displayName: xss.slice(0, 40), avatar: { kind: 'emoji', value: '🐶', color: 1 }, bio: xss })
ok(r.status === 200 && r.json.user.profile.bio === xss, 'XSS payload stored verbatim as text (React renders it escaped)')
await B.put('/api/me/profile', { displayName: 'Bob', avatar: { kind: 'emoji', value: '🐶', color: 1 }, bio: 'Hi' })

// ---------- lockout is per username + IP ----------
const H = new Client(); await H.get('/api/auth/session')
await H.post('/api/auth/register', { username: `hank_${uniq}`, password: 'hank has a good password', displayName: 'Hank' }, { ip: '198.51.100.20' })
for (let i = 0; i < 6; i++) r = await anon.post('/api/auth/login', { username: `hank_${uniq}`, password: 'wrong password!!' }, { ip: '203.0.113.66' })
ok(r.status === 429, 'attacker IP gets locked out after repeated failures')
const H2 = new Client(); await H2.get('/api/auth/session')
r = await H2.post('/api/auth/login', { username: `hank_${uniq}`, password: 'hank has a good password' }, { ip: '198.51.100.21' })
ok(r.status === 200, 'real owner on another network can still log in (no lockout DoS)')

// ---------- profile details private to non-friends ----------
await E.put('/api/me/profile', { displayName: 'Eve', avatar: { kind: 'emoji', value: '🐱', color: 2 }, bio: 'secret bio', interests: ['arts'] })
r = await H2.get(`/api/users/eve_${uniq}`)
ok(r.json.profile.bio === '' && r.json.profile.interests.length === 0 && r.json.profile.limited === true, 'private user: non-friends see only name and avatar')
r = await E.get(`/api/users/eve_${uniq}`)
ok(r.json.profile.bio === 'secret bio', 'user sees own full profile')

// ---------- access control: cannot act on other users' data ----------
r = await H2.del(`/api/opportunities/${e3.id}/signup`)
ok(r.status === 404, 'cannot cancel a signup you do not own')
r = await H2.get(`/api/opportunities/${e1.id}`)
ok(!r.json.opportunity.manage, 'non-organizer gets no attendee list or check-in code')
r = await H2.post(`/api/opportunities/${e1.id}/complete`)
ok(r.status === 403, 'non-organizer cannot complete an event')

// ---------- health ----------
r = await anon.get('/healthz')
ok(r.status === 200 && r.json.ok === true && Object.keys(r.json).length === 1, 'health check verifies DB and reveals nothing else')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
