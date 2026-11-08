-- VolunTerrier schema (PostgreSQL; also runs on embedded PGlite for local dev)

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,          -- stored lowercase
  display_name    TEXT NOT NULL,
  password_hash   TEXT NOT NULL,                 -- bcrypt
  recovery_hash   TEXT NOT NULL,                 -- bcrypt hash of one-time recovery code
  profile         JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarded       BOOLEAN NOT NULL DEFAULT FALSE,
  progress_visibility TEXT NOT NULL DEFAULT 'private' CHECK (progress_visibility IN ('private','public')),
  share_attendance_with_friends BOOLEAN NOT NULL DEFAULT TRUE,
  home_label      TEXT,
  home_lat        DOUBLE PRECISION,              -- rounded to ~1 km, never shown to others
  home_lng        DOUBLE PRECISION,
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    BIGINT NOT NULL DEFAULT 0,
  created_at      BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                  -- HMAC-SHA256 of the cookie token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  cover       TEXT NOT NULL,
  tagline     TEXT NOT NULL,
  description TEXT NOT NULL,
  categories  JSONB NOT NULL,
  meets       TEXT NOT NULL,
  area        TEXT NOT NULL,
  access      JSONB NOT NULL,
  social      JSONB NOT NULL,
  is_sample   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS opportunities (
  id            TEXT PRIMARY KEY,
  organizer_id  TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL for sample listings
  group_id      TEXT REFERENCES groups(id) ON DELETE SET NULL,
  org_name      TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  description   TEXT NOT NULL,
  expect        JSONB NOT NULL,
  vibe          TEXT NOT NULL,
  category      TEXT NOT NULL,
  activities    JSONB NOT NULL,
  causes        JSONB NOT NULL,
  skills        JSONB NOT NULL,
  access        JSONB NOT NULL,
  social        JSONB NOT NULL,
  image         TEXT NOT NULL,
  area          TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  transit       TEXT,
  start_at      BIGINT NOT NULL,     -- UTC epoch ms
  end_at        BIGINT NOT NULL,     -- UTC epoch ms (may be next calendar day)
  time_zone     TEXT NOT NULL,       -- IANA zone the organizer entered times in
  max_participants INTEGER NOT NULL,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  BIGINT,
  checkin_code  TEXT,
  created_at    BIGINT NOT NULL,
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS opp_start ON opportunities(start_at);

CREATE TABLE IF NOT EXISTS signups (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  buddy          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     BIGINT NOT NULL,
  verified_at    BIGINT,
  verified_via   TEXT,               -- 'organizer' | 'checkin'
  hours          DOUBLE PRECISION,   -- set only by verification, never by the volunteer
  PRIMARY KEY (user_id, opportunity_id)   -- prevents duplicate signups
);
CREATE INDEX IF NOT EXISTS signups_opp ON signups(opportunity_id);

CREATE TABLE IF NOT EXISTS swipes (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  decision       TEXT NOT NULL CHECK (decision IN ('like','skip')),
  created_at     BIGINT NOT NULL,
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS saves (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at     BIGINT NOT NULL,
  PRIMARY KEY (user_id, opportunity_id)
);

-- user_a < user_b (sorted) so each pair has exactly one row
CREATE TABLE IF NOT EXISTS friendships (
  user_a       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  requested_by TEXT NOT NULL,
  created_at   BIGINT NOT NULL,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS invites (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,  -- HMAC of the random token; raw token is never stored
  inviter_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at     BIGINT NOT NULL,
  expires_at     BIGINT NOT NULL,
  revoked        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS invite_acceptances (
  invite_id   TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at BIGINT NOT NULL,
  PRIMARY KEY (invite_id, user_id)
);
