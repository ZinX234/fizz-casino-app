'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import useSWR from 'swr'
import { MessageCircle, Pin, PinOff, Send, X } from 'lucide-react'
import { LobbyEconomy } from '@/components/lobby-economy'

type LobbyMessage = {
  id: string
  senderName: string
  body: string
  createdAt: string
}

const chatFetcher = async (url: string): Promise<LobbyMessage[]> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Lobby chat is unavailable right now.')
  const payload = await response.json()
  return payload.messages
}

function LobbyChat({ signedIn, pinned, onClose, onTogglePin }: { signedIn: boolean; pinned: boolean; onClose: () => void; onTogglePin: () => void }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const { data: messages, error, isLoading, mutate } = useSWR('/api/chat', chatFetcher, { refreshInterval: 5000, revalidateOnFocus: true })

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || !signedIn || sending) return
    setSending(true)
    setSendError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your message could not be sent.')
      setDraft('')
      await mutate((previous = []) => [...previous, payload.message].slice(-60), { revalidate: false })
    } catch (issue) {
      setSendError(issue instanceof Error ? issue.message : 'Your message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-label="Fizz lobby chat" className="flex h-full min-h-0 flex-col overflow-hidden bg-[#121318]">
      <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
        <div><h2 className="text-sm font-bold text-white">Lobby chat</h2><p className="mt-1 text-[10px] text-white/40">Messages refresh automatically · be respectful</p></div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onTogglePin} aria-label={pinned ? 'Unpin lobby chat' : 'Pin lobby chat to side'} aria-pressed={pinned} title={pinned ? 'Unpin chat' : 'Pin chat to side'} className="flex size-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-white">{pinned ? <PinOff aria-hidden="true" className="size-4" /> : <Pin aria-hidden="true" className="size-4" />}</button>
          <button type="button" onClick={onClose} aria-label="Close lobby chat" className="flex size-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-white"><X aria-hidden="true" className="size-4" /></button>
        </div>
      </header>
      <LobbyEconomy signedIn={signedIn} />
      <div role="log" aria-label="Lobby chat messages" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {isLoading && <p role="status" className="py-4 text-center text-xs text-white/45">Loading lobby chat…</p>}
        {error && <p role="alert" className="rounded-lg border border-rose-200/10 bg-rose-100/[0.04] p-3 text-xs text-rose-100/75">Lobby chat could not be loaded. Try again in a moment.</p>}
        {!isLoading && !error && messages?.length === 0 && <p className="m-auto max-w-[230px] text-center text-xs leading-5 text-white/40">No messages yet. Start the conversation.</p>}
        {messages?.map((message) => (
          <article key={message.id} className="rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-bold text-[#c49dff]">{message.senderName}</span><time dateTime={message.createdAt} className="shrink-0 text-[9px] text-white/35">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div>
            <p className="mt-1.5 break-words whitespace-pre-wrap text-xs leading-5 text-white/80">{message.body}</p>
          </article>
        ))}
      </div>
      <div className="border-t border-white/[0.08] p-3.5">
        {signedIn ? (
          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <label className="sr-only" htmlFor="global-lobby-chat-message">Write a message</label>
            <input id="global-lobby-chat-message" value={draft} maxLength={240} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" className="h-10 min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-[#0b0c10] px-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#8a52dd]/70" />
            <button type="submit" aria-label="Send message" disabled={!draft.trim() || sending} className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#6b19f5] text-white transition hover:bg-[#792fff] disabled:cursor-not-allowed disabled:opacity-40"><Send aria-hidden="true" className="size-4" /></button>
          </form>
        ) : (
          <Link href="/auth/sign-in" className="flex min-h-10 items-center justify-center rounded-lg bg-[#6b19f5] text-xs font-bold text-white transition hover:bg-[#792fff]">Sign in to join the chat</Link>
        )}
        {sendError && <p role="alert" className="mt-2 text-[10px] text-rose-200/80">{sendError}</p>}
        {signedIn && <p className="mt-2 text-[9px] text-white/30">240 characters max. Your email is never shown.</p>}
      </div>
    </section>
  )
}

export function GlobalLobbyChat({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener('fizz:open-lobby-chat', openChat)
    return () => window.removeEventListener('fizz:open-lobby-chat', openChat)
  }, [])

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
      {open && pinned && (
        <aside aria-label="Pinned lobby chat" className="order-first flex h-[min(440px,56dvh)] w-full flex-none border-b border-white/[0.08] md:sticky md:top-0 md:order-last md:h-dvh md:w-[320px] md:border-b-0 md:border-l">
          <LobbyChat signedIn={signedIn} pinned={pinned} onClose={() => setOpen(false)} onTogglePin={() => setPinned((value) => !value)} />
        </aside>
      )}
      {open && !pinned && (
        <>
          <button type="button" aria-label="Close lobby chat" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/35 md:bg-transparent" />
          <div className="fixed bottom-20 right-3 z-50 flex h-[min(620px,calc(100dvh-7rem))] w-[min(350px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.12] shadow-[0_24px_80px_-28px_rgba(0,0,0,.9)] md:bottom-5 md:right-5">
            <LobbyChat signedIn={signedIn} pinned={pinned} onClose={() => setOpen(false)} onTogglePin={() => setPinned(true)} />
          </div>
        </>
      )}
      {!open && <button type="button" onClick={() => setOpen(true)} aria-expanded={false} aria-label={pinned ? 'Open pinned lobby chat' : 'Open lobby chat'} className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-[#6b19f5] text-white shadow-[0_10px_30px_-12px_rgba(107,25,245,.9)] transition hover:bg-[#792fff] md:bottom-5 md:right-5"><MessageCircle aria-hidden="true" className="size-5" /></button>}
    </div>
  )
}

export function openGlobalLobbyChat() {
  window.dispatchEvent(new Event('fizz:open-lobby-chat'))
}
