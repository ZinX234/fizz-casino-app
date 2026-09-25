'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SupportForm() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Your message could not be sent.')
      setSubject('')
      setMessage('')
      setSaved(true)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your message could not be sent.')
    } finally {
      setPending(false)
    }
  }

  return <form onSubmit={submit} className="flex flex-col gap-4"><div className="flex flex-col gap-2"><label htmlFor="subject" className="text-xs font-semibold text-white/70">Subject</label><input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={160} className="form-input" /></div><div className="flex flex-col gap-2"><label htmlFor="message" className="text-xs font-semibold text-white/70">How can we help?</label><textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={5} maxLength={8000} rows={5} className="form-input resize-y" /></div>{error && <p role="alert" className="text-sm text-rose-100/80">{error}</p>}{saved && <p role="status" className="text-sm text-emerald-100/80">Your support request was saved.</p>}<button type="submit" disabled={pending} className="min-h-11 self-start rounded-full bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:opacity-50">{pending ? 'Sending…' : 'Create support ticket'}</button></form>
}
