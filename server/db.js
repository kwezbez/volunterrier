// Database access. Uses real PostgreSQL when DATABASE_URL is set (production),
// otherwise an embedded PostgreSQL (PGlite) stored on disk for zero-setup local dev.
// All queries are parameterized ($1, $2 …) — never build SQL from user input.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let impl = null

export async function initDb() {
  const url = process.env.DATABASE_URL
  if (url) {
    const pg = (await import('pg')).default
    pg.types.setTypeParser(20, (v) => Number(v)) // BIGINT -> number (epoch ms fits safely)
    const ssl = process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: process.env.DATABASE_SSL !== 'no-verify' }
    const pool = new pg.Pool({ connectionString: url, ssl, max: 10 })
    impl = {
      kind: 'postgres',
      query: async (sql, params = []) => (await pool.query(sql, params)).rows,
      exec: async (sql) => pool.query(sql),
      tx: async (fn) => {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const out = await fn({ query: async (s, p = []) => (await client.query(s, p)).rows })
          await client.query('COMMIT')
          return out
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {})
          throw e
        } finally {
          client.release()
        }
      },
    }
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const dir = process.env.PGLITE_DIR || path.join(here, '..', '.data', 'pglite')
    if (dir !== 'memory://') fs.mkdirSync(dir, { recursive: true })
    const pgl = new PGlite(dir, { parsers: { 20: (v) => Number(v) } })
    await pgl.waitReady
    impl = {
      kind: 'pglite',
      query: async (sql, params = []) => (await pgl.query(sql, params)).rows,
      exec: async (sql) => pgl.exec(sql),
      // PGlite runs transactions exclusively, so concurrent signups are serialized.
      tx: async (fn) => pgl.transaction(async (t) => fn({ query: async (s, p = []) => (await t.query(s, p)).rows })),
    }
  }
  await impl.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'))
  return impl
}

export const db = {
  get kind() {
    return impl?.kind
  },
  query: (sql, params) => impl.query(sql, params),
  one: async (sql, params) => (await impl.query(sql, params))[0] ?? null,
  tx: (fn) => impl.tx(fn),
}
