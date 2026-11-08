# VolunTerrier Security Review

**Scope:** the full codebase (`server/`, `src/`, configuration, dependencies), reviewed manually and tested with an automated suite (`tests/api.test.mjs`, 94 checks) plus multi-account browser tests.

**Important:** this review lowers risk; it doesn't prove the app is secure. No application can be guaranteed unhackable. Several items below could not be verified until the app actually runs on Render. They're listed under *Not verifiable yet*.

## Summary

| Severity | Open | Fixed in this review |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 2 (accepted, documented) | 4 |
| Low | 5 (accepted, documented) | 3 |

**Deployment gate:** there are no open Critical or High findings. The two open Medium items are product-design risks with stated mitigations, not exploitable code defects.

## Fixed in this review

| ID | Severity | Finding | Fix | Verified by |
|---|---|---|---|---|
| F1 | Medium | Login lockout was per username, so an attacker could lock any user out by repeatedly entering wrong passwords (denial of service). | Lockout is keyed on username + client IP. A separate account-wide limit (50 per 15 minutes) still slows distributed guessing. | Test: attacker IP locked out; the real user on another network can still log in. |
| F2 | Medium | Invite tokens were sent in API URL paths, where they could be recorded in proxy or request logs. | Tokens are now sent in the POST request body. Links keep the token in the URL `#fragment`, which browsers never send to servers. | Tests for invite lookup and accept; logs record only paths. |
| F3 | Medium | Bio, pronouns, interests and causes were visible to every logged-in user even when the user's profile was private. | The server now returns only name and avatar to non-friends unless the user chose a public profile. | Test: a non-friend sees a limited profile; the owner sees the full one. |
| F4 | Medium | IP-based limits (10 registrations an hour) would block students sharing one campus network. | Raised the IP limits (30 registrations an hour, 100 login attempts per 15 minutes). The per-account and per-account+IP limits do the real protecting. | Code review; existing rate-limit tests. |
| F5 | Low | Logging in didn't revoke a session cookie the browser already held, and expired sessions were never cleaned up. | The old session is deleted on login. Expired sessions are purged at startup and every 6 hours. | Code review; logout and reset tests. |
| F6 | Low | No app-level HTTPS enforcement if the host misconfigured TLS. | In production, plain-HTTP `GET`/`HEAD` requests redirect to HTTPS and other methods are refused (`/healthz` exempt). HSTS stays on. | Production-mode header check. |
| F7 | Low | Geocoding requests could queue without limit behind the 1-request/second throttle. | Requests that would wait more than 5 seconds are refused. | Code review. |

## Checks performed and results

| Area | What was checked | Result |
|---|---|---|
| SQL injection | Every query reviewed: all use `$1…` parameters, and the only dynamic SQL is fixed fragments in server code. Tested payloads such as `' OR '1'='1`, `'; DROP TABLE users; --` and `admin'/*` against login, registration, profile lookup, opportunity IDs and search. | Pass: no authentication bypass, no errors leaked, data intact. |
| XSS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval`. React escapes all output. CSP `script-src 'self'`. Image URLs must be `https:` or validated `data:image/*`. A stored script/`onerror` payload is returned as inert text. | Pass |
| CSRF | Every state-changing request needs a double-submit token header plus an allowed `Origin`. In production the cookie uses the `__Host-` prefix. | Pass: requests without the token, or from a foreign Origin, are rejected. |
| Authentication | bcrypt (cost 12). Passwords are 10–72 bytes and can't be common or contain the username. Error messages are generic. Unknown users take the same time to check as wrong passwords. Recovery codes are bcrypt-hashed and single-use. | Pass |
| Sessions and cookies | 256-bit random tokens; only an HMAC of each token is stored. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` + `__Host-` in production. 14-day expiry. Password change or reset signs out all other sessions. Logout deletes the session. | Pass |
| Brute force | Limits on login (per account+IP, per account, per IP), registration, reset, check-in codes (8 per 15 minutes), invites, search and geocoding. | Pass |
| Authorization | Users can only change their own profile, settings, matches and events. Only organizers see check-in codes and attendee lists, complete events, or verify hours, and they can't verify themselves. | Pass: tested with multiple accounts. |
| Privacy | Progress is private by default, enforced in SQL. Public profiles exclude schedules, location, accessibility needs and account data. "Friends attending" shows only consenting, accepted friends. Saved location is rounded to about 1 km. | Pass: tested with multiple accounts. |
| Hours integrity | No endpoint accepts hours. Hours come only from organizer verification or a valid check-in code, and count only after completion, capped at 12 per event. Extra request fields are discarded by validation. | Pass |
| Schedule integrity | Conflict check runs in a transaction with a row lock; overlaps use absolute UTC times (midnight, time zones, DST). A primary key prevents duplicates. Capacity is enforced. | Pass, including two simultaneous requests. |
| Secrets | No keys or credentials in code. `.env` is git-ignored. Production refuses to start without `SESSION_SECRET` and `APP_URL`. Nothing secret in `VITE_*`. | Pass |
| Error handling | Generic 500 responses; stack traces stay in server logs (development only). Logs exclude cookies, bodies, query strings and full IPs. | Pass |
| Dependencies | `npm audit` (all dependencies). | 0 known vulnerabilities at review time. Re-run regularly. |
| Production config | CSP, HSTS, `X-Frame-Options`/`frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy, same-origin only (no CORS), DB-aware health check, HTTPS redirect. | Pass, in local production mode. |

## Open findings (accepted, documented)

| ID | Severity | Finding | Mitigation / recommendation |
|---|---|---|---|
| O1 | Medium | **Organizer collusion:** any user can create an event and verify its attendees, so friends could log hours for a fake event. | History shows how each hour was verified. Before hours are used for anything official (e.g. school credit), add verified-organization accounts or an admin review step. |
| O2 | Medium | **Rate limits are kept in memory.** They reset on restart and aren't shared between multiple server instances. | Fine on one instance (the Render setup described here). If you scale out, move them to a shared store such as Redis. |
| O3 | Low | Usernames can be discovered (registration says "taken", and friend requests confirm existence). | Rate-limited. Inherent to username-based friend search. |
| O4 | Low | CSP allows images from any `https:` host, because organizers can paste image URLs. Viewers' IPs reach that host. | Restrict to known hosts, or proxy and upload images, if this matters to you. |
| O5 | Low | CSP allows inline styles (`'unsafe-inline'` for styles only; scripts are not affected). | Needed for React style attributes; low risk. |
| O6 | Low | Email-free recovery: an account can't be recovered if the recovery code is lost. | A deliberate trade-off to avoid storing emails. Add email reset only with a provider and a verified domain. |
| O7 | Low | Sessions have a fixed 14-day lifetime with no idle timeout. | Shorten it or add idle expiry if needed. |

## Not verifiable yet (check after deploying)

1. **`TRUST_PROXY=1` on Render.** Confirm in the logs that different networks show different `net` prefixes. If they don't, IP rate limits would be shared by everyone or could be bypassed.
2. **Database TLS on Render's internal URL.** Certificate verification is on by default. See the README for the fallback if the connection fails.
3. **Render's own HTTPS redirect and certificate.** The app adds its own redirect and HSTS regardless.
4. **Third-party services** (OpenStreetMap tiles and Nominatim). Their availability and usage limits are outside this app's control.
5. **Load and denial of service** at the network level. That's handled by the host, not tested here.

## Re-running the checks
1. Start the server with `PGLITE_DIR=memory:// TRUST_PROXY=1 node server/index.js`.
2. In another terminal, run `npm test`.
3. Run `npm audit`.
