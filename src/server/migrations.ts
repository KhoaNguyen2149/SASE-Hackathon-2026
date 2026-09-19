import type { DatabaseSync } from 'node:sqlite';
export function migrateSocial(db: DatabaseSync) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const add=(table:string, name:string, definition:string)=>{
      const columns=db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[];
      if(!columns.some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    };
    add('users','password_enabled','INTEGER NOT NULL DEFAULT 1');
    add('auth_sessions','google_authenticated_at','INTEGER NOT NULL DEFAULT 0');
    add('follows','created_at','INTEGER NOT NULL DEFAULT 0');
    add('spots','city',"TEXT NOT NULL DEFAULT ''");
    add('spots','photo_url',"TEXT NOT NULL DEFAULT ''");
    add('spots','photo_credit',"TEXT NOT NULL DEFAULT ''");
    add('spots','photo_source',"TEXT NOT NULL DEFAULT ''");
    add('spots','imported_at','INTEGER');
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, bio TEXT NOT NULL DEFAULT '', theme TEXT NOT NULL DEFAULT 'forest', banner TEXT NOT NULL DEFAULT 'mountains', avatar TEXT NOT NULL DEFAULT 'seedling', stickers TEXT NOT NULL DEFAULT '[]', pinned_spots TEXT NOT NULL DEFAULT '[]', interests TEXT NOT NULL DEFAULT '[]', leaderboard INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_accounts(provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(provider,subject),UNIQUE(provider,user_id));
      CREATE TABLE IF NOT EXISTS oauth_states(state_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, next_path TEXT NOT NULL, link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS first_follows(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,target_id));
      CREATE TABLE IF NOT EXISTS first_reviews(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,spot_id));
      INSERT OR IGNORE INTO first_follows SELECT user_id,target_id,created_at FROM follows;
      INSERT OR IGNORE INTO first_reviews SELECT user_id,spot_id,created_at FROM reviews;
      CREATE INDEX IF NOT EXISTS reviews_period ON reviews(created_at,spot_id);
      CREATE INDEX IF NOT EXISTS follows_period ON first_follows(created_at,target_id);
      INSERT OR IGNORE INTO schema_migrations VALUES(3,unixepoch()*1000);
    `);
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
}
