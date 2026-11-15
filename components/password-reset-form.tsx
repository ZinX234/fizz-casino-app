'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { authClient } from '@/lib/auth/client'

export function PasswordResetForm({ token, invalidToken }: { token: string; invalidToken: boolean }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!token || invalidToken) {
      setError('This reset link is invalid or expired. Ask the administrator to send a new one.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setPending(true)
    try {
      const result = await authClient.resetPassword({ token, newPassword: password })
      if (result.error) throw new Error(result.error.message || 'Password could not be reset.')
      window.history.replaceState(window.history.state, '', '/auth/reset-password')
      setComplete(true)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Password could not be reset.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100svh-68px)] items-center justify-center px-4 py-12">
      <section className="w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-[#111318] p-6 shadow-2xl sm:p-9">
        <p className="eyebrow">Fizz Casino</p>
        {complete ? (
          <>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Password updated</h1>
            <p className="mt-2 text-sm leading-6 text-white/45">You can now sign in with your new password.</p>
            <Link href="/auth/sign-in" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d]">Continue to sign in</Link>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create a new password</h1>
            <p className="mt-2 text-sm leading-6 text-white/45">Choose a new password for your Fizz Casino account. No OTP or 2FA code is needed.</p>
            <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="new-password" className="text-xs font-semibold text-white/70">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} className="form-input" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-new-password" className="text-xs font-semibold text-white/70">Confirm new password</label>
                <input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={128} className="form-input" />
              </div>
              {error && <p role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-100/85">{error}</p>}
              <button type="submit" disabled={pending || !token || invalidToken} className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-wait disabled:opacity-60">{pending ? 'Updating…' : 'Set new password'}</button>
            </form>
            {(!token || invalidToken) && <p role="alert" className="mt-4 text-sm text-rose-100/80">This reset link is invalid or expired. Ask the administrator to send a new one.</p>}
          </>
        )}
      </section>
    </main>
  )
}
