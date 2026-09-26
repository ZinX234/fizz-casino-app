'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { BellRing, Pencil, Send, Trash2, X } from 'lucide-react'
import type { AnnouncementCategory, AnnouncementStatus, SiteAnnouncement } from '@/lib/site-announcements'

type Draft = {
  title: string
  body: string
  category: AnnouncementCategory
  status: AnnouncementStatus
  linkUrl: string
}

const emptyDraft: Draft = {
  title: '',
  body: '',
  category: 'site-news',
  status: 'draft',
  linkUrl: '',
}

const categoryLabels: Record<AnnouncementCategory, string> = {
  'new-game': 'New game',
  'game-update': 'Game update',
  'site-news': 'Site news',
}

export function AdminAnnouncements({ initialAnnouncements }: { initialAnnouncements: SiteAnnouncement[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  function resetForm() {
    setDraft(emptyDraft)
    setEditingId(null)
  }

  function editAnnouncement(announcement: SiteAnnouncement) {
    setEditingId(announcement.id)
    setDraft({
      title: announcement.title,
      body: announcement.body,
      category: announcement.category,
      status: announcement.status,
      linkUrl: announcement.linkUrl ?? '',
    })
    setMessage(null)
  }

  async function saveAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/announcements', {
        method: editingId ? 'PATCH' : 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...draft, linkUrl: draft.linkUrl.trim() || null, ...(editingId ? { id: editingId } : {}) }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Announcements could not be saved.')
      setAnnouncements(result.announcements as SiteAnnouncement[])
      setMessage({ text: editingId ? 'Announcement updated.' : 'Announcement created.', error: false })
      resetForm()
    } catch (issue) {
      setMessage({ text: issue instanceof Error ? issue.message : 'Announcements could not be saved.', error: true })
    } finally {
      setSaving(false)
    }
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm('Delete this announcement permanently?')) return
    setDeletingId(id)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'DELETE',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Announcement could not be deleted.')
      setAnnouncements(result.announcements as SiteAnnouncement[])
      if (editingId === id) resetForm()
      setMessage({ text: 'Announcement deleted.', error: false })
    } catch (issue) {
      setMessage({ text: issue instanceof Error ? issue.message : 'Announcement could not be deleted.', error: true })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-violet-200/10 bg-[#12141a] p-5 sm:p-6" aria-labelledby="announcements-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-200/15 bg-violet-200/[0.06] text-violet-100"><BellRing aria-hidden="true" className="size-4" /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/75">Site updates</p>
          <h2 id="announcements-heading" className="mt-1 text-base font-bold">Announcements</h2>
          <p className="mt-1 text-sm text-white/45">Create a draft or publish news, game releases, and updates to the casino lobby.</p>
        </div>
      </div>

      <form onSubmit={saveAnnouncement} className="mt-6 grid gap-4 rounded-xl border border-white/[0.07] bg-black/10 p-4 sm:grid-cols-2 sm:p-5">
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Announcement title
          <input required minLength={3} maxLength={80} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-11 rounded-lg border border-white/10 bg-[#0b0c10] px-3 text-sm text-white outline-none focus:border-violet-200/40" />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Category
          <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as AnnouncementCategory }))} className="h-11 rounded-lg border border-white/10 bg-[#0b0c10] px-3 text-sm text-white outline-none focus:border-violet-200/40">
            <option value="new-game">New game</option><option value="game-update">Game update</option><option value="site-news">Site news</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65 sm:col-span-2">Message
          <textarea required minLength={10} maxLength={600} rows={4} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} className="resize-y rounded-lg border border-white/10 bg-[#0b0c10] px-3 py-3 text-sm leading-5 text-white outline-none focus:border-violet-200/40" />
          <span className="text-[10px] font-normal text-white/35">{draft.body.length}/600 characters</span>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Link (optional)
          <input maxLength={500} value={draft.linkUrl} onChange={(event) => setDraft((current) => ({ ...current, linkUrl: event.target.value }))} placeholder="/games/vault-heist or https://…" className="h-11 rounded-lg border border-white/10 bg-[#0b0c10] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-200/40" />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Visibility
          <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AnnouncementStatus }))} className="h-11 rounded-lg border border-white/10 bg-[#0b0c10] px-3 text-sm text-white outline-none focus:border-violet-200/40">
            <option value="draft">Save as draft</option><option value="published">Publish to lobby</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-300 px-4 text-xs font-bold text-[#1b1229] transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-55"><Send aria-hidden="true" className="size-3.5" />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save announcement'}</button>
          {editingId && <button type="button" onClick={resetForm} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-white/70 hover:text-white"><X aria-hidden="true" className="size-3.5" />Cancel edit</button>}
        </div>
      </form>

      {message && <p role={message.error ? 'alert' : 'status'} className={`mt-4 text-xs ${message.error ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>{message.text}</p>}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Announcement archive</h3><span className="text-[10px] text-white/40">{announcements.length}/100</span></div>
        {announcements.length ? <ul className="mt-3 divide-y divide-white/[0.06]">
          {announcements.map((announcement) => <li key={announcement.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-white/90">{announcement.title}</h4><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-white/50">{categoryLabels[announcement.category]}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${announcement.status === 'published' ? 'bg-emerald-200/10 text-emerald-100/80' : 'bg-amber-100/10 text-amber-100/70'}`}>{announcement.status}</span></div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/50">{announcement.body}</p>
              <time dateTime={announcement.updatedAt} className="mt-2 block text-[10px] text-white/30">Updated {new Date(announcement.updatedAt).toLocaleString()}</time>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => editAnnouncement(announcement)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/70 hover:text-white"><Pencil aria-hidden="true" className="size-3.5" />Edit</button>
              <button type="button" disabled={deletingId === announcement.id} onClick={() => void deleteAnnouncement(announcement.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200/10 px-3 text-xs font-semibold text-rose-100/70 hover:bg-rose-200/[0.06] disabled:opacity-50"><Trash2 aria-hidden="true" className="size-3.5" />{deletingId === announcement.id ? 'Deleting…' : 'Delete'}</button>
            </div>
          </li>)}
        </ul> : <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/40">No announcements yet. Create a draft or publish your first update.</p>}
      </div>
    </section>
  )
}
