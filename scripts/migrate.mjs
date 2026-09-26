import { readFile, readdir } from 'node:fs/promises'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required to apply migrations')

const migrationsDirectory = new URL('../db/migrations/', import.meta.url)
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/.test(file))
  .sort((left, right) => left.localeCompare(right))

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
const client = await pool.connect()
let transactionOpen = false

try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)

  for (const file of migrationFiles) {
    const version = file.replace(/\.sql$/, '')
    const { rows } = await client.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', [version])
    if (rows.length) continue

    await client.query('BEGIN')
    transactionOpen = true
    await client.query(await readFile(new URL(file, migrationsDirectory), 'utf8'))
    await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [version])
    await client.query('COMMIT')
    transactionOpen = false
    process.stdout.write(`Applied ${version}\n`)
  }
} catch (error) {
  if (transactionOpen) await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
