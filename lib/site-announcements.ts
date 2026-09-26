import 'server-only'

import { databasePool } from '@/lib/db'

export type AnnouncementCategory = 'new-game' | 'game-update' | 'site-news'
export type AnnouncementStatus = 'draft' | 'published'

export type SiteAnnouncement = {
  id: string
  title: string
  body: string
  category: AnnouncementCategory
  status: AnnouncementStatus
  linkUrl: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

type AnnouncementStore = { announcements: SiteAnnouncement[] }

function parseStore(value: unknown): AnnouncementStore {
  let parsed = value
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return { announcements: [] }
    }
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { announcements?: unknown }).announcements)) {
    return { announcements: [] }
  }

  const announcements = (parsed as { announcements: unknown[] }).announcements.filter((item): item is SiteAnnouncement => {
    if (!item || typeof item !== 'object') return false
    const entry = item as Partial<SiteAnnouncement>
    return typeof entry.id === 'string'
      && typeof entry.title === 'string'
      && typeof entry.body === 'string'
      && (entry.category === 'new-game' || entry.category === 'game-update' || entry.category === 'site-news')
      && (entry.status === 'draft' || entry.status === 'published')
      && typeof entry.createdAt === 'string'
      && typeof entry.updatedAt === 'string'
  })

  return { announcements }
}

export async function getSiteAnnouncements(): Promise<SiteAnnouncement[]> {
  const { rows } = await databasePool.query<{ setting_value: unknown }>(
    `SELECT setting_value FROM public.site_settings WHERE setting_key = 'site_announcements' LIMIT 1`,
  )
  return parseStore(rows[0]?.setting_value).announcements.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getPublishedSiteAnnouncements(): Promise<SiteAnnouncement[]> {
  return (await getSiteAnnouncements()).filter((announcement) => announcement.status === 'published').slice(0, 4)
}

export function parseAnnouncementStore(value: unknown): AnnouncementStore {
  return parseStore(value)
}

export function serializeAnnouncementStore(announcements: SiteAnnouncement[]) {
  return JSON.stringify({ announcements })
}

export function isAnnouncementCategory(value: unknown): value is AnnouncementCategory {
  return value === 'new-game' || value === 'game-update' || value === 'site-news'
}

export function isAnnouncementStatus(value: unknown): value is AnnouncementStatus {
  return value === 'draft' || value === 'published'
}

export function isSafeAnnouncementLink(value: string | null) {
  if (value === null || value === '') return true
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function normalizeAnnouncementLink(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return normalized.length ? normalized : null
}

export const announcementCategoryLabels: Record<AnnouncementCategory, string> = {
  'new-game': 'New game',
  'game-update': 'Game update',
  'site-news': 'Site news',
}

export function isSiteAnnouncement(value: unknown): value is SiteAnnouncement {
  if (!value || typeof value !== 'object') return false
  const parsed = value as Partial<SiteAnnouncement>
  return typeof parsed.id === 'string'
    && typeof parsed.title === 'string'
    && typeof parsed.body === 'string'
    && isAnnouncementCategory(parsed.category)
    && isAnnouncementStatus(parsed.status)
    && typeof parsed.createdAt === 'string'
    && typeof parsed.updatedAt === 'string'
}

export function createAnnouncementRecord(input: Omit<SiteAnnouncement, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>, now = new Date()): SiteAnnouncement {
  const timestamp = now.toISOString()
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: input.status === 'published' ? timestamp : null,
  }
}

export function updateAnnouncementRecord(announcement: SiteAnnouncement, changes: Partial<Pick<SiteAnnouncement, 'title' | 'body' | 'category' | 'linkUrl' | 'status'>>, now = new Date()): SiteAnnouncement {
  const timestamp = now.toISOString()
  const status = changes.status ?? announcement.status
  return {
    ...announcement,
    ...changes,
    status,
    updatedAt: timestamp,
    publishedAt: status === 'published' ? (announcement.status === 'published' ? announcement.publishedAt : timestamp) : null,
  }
}

export function getAnnouncementById(announcements: SiteAnnouncement[], id: string) {
  return announcements.find((announcement) => announcement.id === id) ?? null
}

export function updateStoredAnnouncement(announcements: SiteAnnouncement[], id: string, changes: Partial<Pick<SiteAnnouncement, 'title' | 'body' | 'category' | 'linkUrl' | 'status'>>) {
  const index = announcements.findIndex((announcement) => announcement.id === id)
  if (index < 0) return null
  const updated = updateAnnouncementRecord(announcements[index], changes)
  const next = [...announcements]
  next[index] = updated
  return next
}

export function removeStoredAnnouncement(announcements: SiteAnnouncement[], id: string) {
  return announcements.filter((announcement) => announcement.id !== id)
}

export function addStoredAnnouncement(announcements: SiteAnnouncement[], announcement: SiteAnnouncement) {
  return [announcement, ...announcements]
}

export function sortAnnouncements(announcements: SiteAnnouncement[]) {
  return [...announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function announcementFeedLimit(announcements: SiteAnnouncement[], limit = 4) {
  return sortAnnouncements(announcements.filter((announcement) => announcement.status === 'published')).slice(0, limit)
}
