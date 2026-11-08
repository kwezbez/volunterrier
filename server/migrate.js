// Applies the database schema (idempotent: CREATE ... IF NOT EXISTS) and exits.
// The server also runs this automatically on every start, so this is optional.
// Usage:  npm run migrate      (uses DATABASE_URL if set, otherwise the local embedded DB)
import { initDb } from './db.js'

await initDb()
console.log('Database schema is up to date.')
process.exit(0)
