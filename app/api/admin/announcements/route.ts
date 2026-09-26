import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'
import {
  addStoredAnnouncement,
  createAnnouncementRecord,
  getAnnouncementById,
  isAnnouncementCategory,
  isAnnouncementStatus,
  isSafeAnnouncementLink,
  normalizeAnnouncementLink,
  parseAnnouncementStore,
  removeStoredAnnouncement,
  serializeAnnouncementStore,
  sortAnnouncements,
  updateStoredAnnouncement,
  type SiteAnnouncement,
} from '@/lib/site-announcements'

const announcementFields = {
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(10).max(600),
  category: z.enum(['new-game', 'game-update', 'site-news']),
  status: z.enum(['draft', 'published']),
  linkUrl: z.string().trim().max(500).nullable().optional(),
}
const createSchema = z.object(announcementFields).strict()
const updateSchema = z.object({ id: z.string().uuid(), ...announcementFields }).strict()
const deleteSchema = z.object({ id: z.string().uuid() }).strict()

class AnnouncementRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function getOwner() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { response: Response.json({ error: 'Sign in required.' }, { status: 401 }) }
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return { response: Response.json({ error: 'Owner access is restricted.' }, { status: 403 }) }
  return { user: session.user }
}

function validateLink(value: string | null | undefined) {
  const linkUrl = normalizeAnnouncementLink(value)
  if (!isSafeAnnouncementLink(linkUrl)) throw new AnnouncementRequestError('Use a relative site path or an HTTP(S) link.', 400)
  return linkUrl
}

async function mutateAnnouncements(
  userId: string,
  action: 'created' | 'updated' | 'deleted',
  mutate: (announcements: SiteAnnouncement[]) => SiteAnnouncement[],
  announcementId: string,
  details: Record<string, string>,
) {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO public.site_settings (setting_key, setting_value, updated_by)
       VALUES ('site_announcements', '{"announcements":[]}'::jsonb, $1::uuid)
       ON CONFLICT (setting_key) DO NOTHING`,
      [userId],
    )
    const { rows } = await client.query<{ setting_value: unknown }>(
      `SELECT setting_value FROM public.site_settings WHERE setting_key = 'site_announcements' FOR UPDATE`,
    )
    const current = parseAnnouncementStore(rows[0]?.setting_value).announcements
    const next = sortAnnouncements(mutate(current))
    await client.query(
      `UPDATE public.site_settings
       SET setting_value = $1::jsonb, updated_by = $2::uuid, updated_at = now()
       WHERE setting_key = 'site_announcements'`,
      [serializeAnnouncementStore(next), userId],
    )
    await client.query(
      `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1::uuid, $2, 'site_announcement', $3, $4::jsonb)`,
      [userId, `site.announcement.${action}`, announcementId, JSON.stringify(details)],
    )
    return next
  })
}

function jsonError(error: unknown) {
  if (error instanceof AnnouncementRequestError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error('[v0] Site announcement update failed:', error instanceof Error ? error.message : 'unknown error')
  return Response.json({ error: 'Announcements could not be saved.' }, { status: 500 })
}

function savedResponse(announcements: SiteAnnouncement[]) {
  revalidatePath('/casino')
  revalidatePath('/admin')
  return Response.json({ announcements }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const owner = await getOwner()
  if ('response' in owner) return owner.response
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Check the announcement title, message, category, and status.' }, { status: 400 })

  try {
    const linkUrl = validateLink(parsed.data.linkUrl)
    const announcement = createAnnouncementRecord({ ...parsed.data, linkUrl })
    const announcements = await mutateAnnouncements(owner.user.id, 'created', (current) => {
      if (current.length >= 100) throw new AnnouncementRequestError('The announcement archive is full. Remove an old item before adding another.', 409)
      return addStoredAnnouncement(current, announcement)
    }, announcement.id, { title: announcement.title, category: announcement.category, status: announcement.status })
    return savedResponse(announcements)
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const owner = await getOwner()
  if ('response' in owner) return owner.response
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Check the announcement ID, title, message, category, and status.' }, { status: 400 })

  try {
    const linkUrl = validateLink(parsed.data.linkUrl)
    const { id, ...changes } = parsed.data
    const announcements = await mutateAnnouncements(owner.user.id, 'updated', (current) => {
      if (!getAnnouncementById(current, id)) throw new AnnouncementRequestError('That announcement no longer exists.', 404)
      const updated = updateStoredAnnouncement(current, id, { ...changes, linkUrl })
      if (!updated) throw new AnnouncementRequestError('That announcement no longer exists.', 404)
      return updated
    }, id, { title: changes.title, category: changes.category, status: changes.status })
    return savedResponse(announcements)
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const owner = await getOwner()
  if ('response' in owner) return owner.response
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Choose a valid announcement to remove.' }, { status: 400 })

  try {
    const announcements = await mutateAnnouncements(owner.user.id, 'deleted', (current) => {
      if (!getAnnouncementById(current, parsed.data.id)) throw new AnnouncementRequestError('That announcement no longer exists.', 404)
      return removeStoredAnnouncement(current, parsed.data.id)
    }, parsed.data.id, {})
    return savedResponse(announcements)
  } catch (error) {
    return jsonError(error)
  }
}

export const dynamic = 'force-dynamic'
