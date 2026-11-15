'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'

export function AdminPasswordReset() {
  const [username, setUsername] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)

  async function sendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Password reset link could not be sent.')

      setFeedback({ message: 'A password reset link was sent to the email address on the account.', error: false })
    } catch (issue) {
      setFeedback({
        message: issue instanceof Error ? issue.message : 'Password reset link could not be sent.',
        error: true,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6" aria-labelledby="admin-password-reset-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-100/[0.06] text-amber-100"><KeyRound aria-hidden="true" className="size-4" /></span>
        <div>
          <h2 id="admin-password-reset-heading" className="text-base font-bold">Player password reset</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">
            Send a secure password-reset link to the email on the player&apos;s account. They can choose a new password from the link; no OTP or 2FA code is required.
          </p>
        </div>
      </div>
      <form onSubmit={sendResetLink} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-password-reset-username" className="text-[11px] font-semibold text-white/65">Fizz username</label>
          <input
            id="admin-password-reset-username"
            type="text"
            autoComplete="off"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter the player username"
            className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-amber-200/50"
          />
        </div>
        <button type="submit" disabled={pending || !username.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-200 px-4 text-xs font-bold text-[#21190c] transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60">
          <KeyRound aria-hidden="true" className="size-4" />
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      {feedback && (
        <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-3 py-2 text-xs ${feedback.error ? 'border-rose-200/15 bg-rose-100/[0.04] text-rose-100/80' : 'border-emerald-200/15 bg-emerald-100/[0.04] text-emerald-100/80'}`}>
          {feedback.message}
        </p>
      )}
    </section>
  )
}
