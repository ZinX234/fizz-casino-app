import { databasePool } from '@/lib/db'

export async function getKickLiveStatus() {
  const { rows } = await databasePool.query<{ is_live: boolean }>(
    `SELECT COALESCE((setting_value ->> 'isLive')::boolean, false) AS is_live
     FROM public.site_settings
     WHERE setting_key = 'kick_live'
     LIMIT 1`,
  )

  return rows[0]?.is_live === true
}
