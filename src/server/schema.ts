export const schema = `
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
 sharing INTEGER NOT NULL DEFAULT 1 CHECK(sharing IN (0,1)), notify INTEGER NOT NULL DEFAULT 0 CHECK(notify IN (0,1)),
 suspended INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_tokens(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS spots (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, address TEXT NOT NULL,
 lat REAL NOT NULL, lng REAL NOT NULL, timezone TEXT NOT NULL DEFAULT 'America/Denver',
 power TEXT NOT NULL DEFAULT 'unknown', wifi TEXT NOT NULL DEFAULT 'unknown', coffee TEXT NOT NULL DEFAULT 'unknown',
 noise INTEGER NOT NULL DEFAULT 3, access TEXT NOT NULL, access_note TEXT NOT NULL, hours TEXT NOT NULL DEFAULT '{}',
 website TEXT NOT NULL DEFAULT '', accessibility TEXT NOT NULL DEFAULT 'Not yet verified', image TEXT NOT NULL DEFAULT 'library',
 demo INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL DEFAULT 1, verified_at INTEGER,
 source TEXT NOT NULL DEFAULT '', group_size INTEGER, booking_url TEXT NOT NULL DEFAULT '', mapped INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS closures(spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE, local_date TEXT NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(spot_id,local_date));
CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, spot_id TEXT NOT NULL REFERENCES spots(id), name TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity>0), demo INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1, policy_version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, room_id TEXT NOT NULL REFERENCES rooms(id),
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, party_size INTEGER NOT NULL CHECK(party_size>0),
 status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled')), policy_version INTEGER NOT NULL, created_at INTEGER NOT NULL,
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS booking_room ON bookings(room_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS booking_user ON bookings(user_id,starts_at);
CREATE TRIGGER IF NOT EXISTS booking_conflict_insert BEFORE INSERT ON bookings WHEN NEW.status='confirmed' BEGIN
 SELECT RAISE(ABORT,'BOOKING_CONFLICT') WHERE EXISTS(SELECT 1 FROM bookings WHERE status='confirmed' AND (room_id=NEW.room_id OR user_id=NEW.user_id) AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at);
END;
CREATE TRIGGER IF NOT EXISTS booking_conflict_update BEFORE UPDATE ON bookings WHEN NEW.status='confirmed' BEGIN
 SELECT RAISE(ABORT,'BOOKING_CONFLICT') WHERE EXISTS(SELECT 1 FROM bookings WHERE id!=NEW.id AND status='confirmed' AND (room_id=NEW.room_id OR user_id=NEW.user_id) AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at);
END;
CREATE TABLE IF NOT EXISTS study_sessions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, spot_id TEXT REFERENCES spots(id),
 state TEXT NOT NULL CHECK(state IN ('running','paused','awaiting_confirmation','completed','cancelled','abandoned')),
 visibility TEXT NOT NULL CHECK(visibility IN ('private','friends_status','friends_status_and_venue')),
 target_seconds INTEGER NOT NULL CHECK(target_seconds BETWEEN 900 AND 10800), focus_seconds INTEGER NOT NULL DEFAULT 0,
 started_at INTEGER NOT NULL, segment_started_at INTEGER, last_heartbeat_at INTEGER NOT NULL, ended_at INTEGER, revision INTEGER NOT NULL DEFAULT 1,
 share_completion INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_session ON study_sessions(user_id) WHERE state IN ('running','paused','awaiting_confirmation');
CREATE TABLE IF NOT EXISTS availability(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, mode TEXT CHECK(mode IN ('available','open_to_join','busy','dnd')), session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL, expires_at INTEGER, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS friendships (a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, state TEXT NOT NULL CHECK(state IN ('pending','accepted')), created_at INTEGER NOT NULL, PRIMARY KEY(a,b), CHECK(a<b));
CREATE TABLE IF NOT EXISTS blocks(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(user_id,target_id), CHECK(user_id!=target_id));
CREATE TABLE IF NOT EXISTS follows(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(user_id,target_id), CHECK(user_id!=target_id));
CREATE TABLE IF NOT EXISTS hops (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, spot_id TEXT NOT NULL REFERENCES spots(id),
 target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN ('on_way','arrived','cancelled','expired')), eta_at INTEGER, expires_at INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, ended_at INTEGER,
 CHECK(user_id!=target_user_id), CHECK(expires_at<=created_at+7200000),
 CHECK((state='on_way' AND ended_at IS NULL) OR (state!='on_way' AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_hop ON hops(user_id) WHERE state='on_way';
CREATE TRIGGER IF NOT EXISTS session_hop_guard BEFORE INSERT ON study_sessions WHEN NEW.state IN ('running','paused','awaiting_confirmation') BEGIN
 SELECT RAISE(ABORT,'HOP_ACTIVE') WHERE EXISTS(SELECT 1 FROM hops WHERE user_id=NEW.user_id AND state='on_way');
END;
CREATE TRIGGER IF NOT EXISTS hop_session_guard BEFORE INSERT ON hops WHEN NEW.state='on_way' BEGIN
 SELECT RAISE(ABORT,'SESSION_ACTIVE') WHERE EXISTS(SELECT 1 FROM study_sessions WHERE user_id=NEW.user_id AND state IN ('running','paused','awaiting_confirmation'));
END;
CREATE TABLE IF NOT EXISTS saved(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE, PRIMARY KEY(user_id,spot_id));
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, spot_id TEXT NOT NULL REFERENCES spots(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), noise INTEGER NOT NULL CHECK(noise BETWEEN 1 AND 5), crowd INTEGER NOT NULL CHECK(crowd BETWEEN 1 AND 5), notes TEXT NOT NULL, visit_date TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,spot_id));
CREATE TABLE IF NOT EXISTS review_likes(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE, PRIMARY KEY(user_id,review_id));
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, spot_id TEXT NOT NULL REFERENCES spots(id), crowd INTEGER NOT NULL CHECK(crowd BETWEEN 1 AND 5), noise INTEGER NOT NULL CHECK(noise BETWEEN 1 AND 5), created_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,spot_id));
CREATE TABLE IF NOT EXISTS flags(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE, spot_id TEXT REFERENCES spots(id), reason TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, kind TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, entity_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id TEXT REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, entity_id TEXT NOT NULL, read_at INTEGER, created_at INTEGER NOT NULL, UNIQUE(user_id,kind,entity_id));
CREATE TABLE IF NOT EXISTS idempotency(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation TEXT NOT NULL, key TEXT NOT NULL, digest TEXT NOT NULL, response TEXT, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,operation,key));
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES(1,unixepoch()*1000);
`;
