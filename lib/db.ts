import { Pool, type PoolClient } from 'pg'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for casino database access')
}

const globalForDatabase = globalThis as typeof globalThis & {
  databasePool?: Pool
}

export const databasePool =
  globalForDatabase.databasePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 5_000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.databasePool = databasePool
}

export async function consumeUserRateLimit(userId: string, route: string, maxRequests: number, windowSeconds: number) {
  const key = `${userId}:${route}`
  const { rows } = await databasePool.query<{ request_count: number }>(
    `INSERT INTO public.api_rate_limits (rate_key, window_started_at, request_count)
     VALUES ($1, now(), 1)
     ON CONFLICT (rate_key) DO UPDATE SET
       request_count = CASE
         WHEN public.api_rate_limits.window_started_at <= now() - ($2 * interval '1 second') THEN 1
         ELSE public.api_rate_limits.request_count + 1
       END,
       window_started_at = CASE
         WHEN public.api_rate_limits.window_started_at <= now() - ($2 * interval '1 second') THEN now()
         ELSE public.api_rate_limits.window_started_at
       END
     RETURNING request_count`,
    [key, windowSeconds],
  )
  return rows[0].request_count <= maxRequests
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await databasePool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
