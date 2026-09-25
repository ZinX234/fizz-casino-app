import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required to apply migrations')

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const { rows } = await client.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', ['001_casino_core'])
  if (rows.length) {
    await client.query('COMMIT')
    process.stdout.write('001_casino_core is already applied\n')
  } else {
    const migration = await readFile('db/migrations/001_casino_core.sql', 'utf8')
    await client.query(migration)
    await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', ['001_casino_core'])
    await client.query('COMMIT')
    process.stdout.write('Applied 001_casino_core\n')
  }
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
