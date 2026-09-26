'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { MailCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth/client'

type VerificationStatus = 'sent' | 'failed' | null

export function EmailVerificationCard({
  email,
  initialStatus,
}: {
  email: string
  initialStatus: VerificationStatus
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pendingAction, setPendingAction] = useState<'send' | 'verify' | null>(null)
  const [notice, setNotice] = useState(
    initialStatus === 'sent' ? 'A verification code was sent. Check your inbox and spam folder.' : null,
  )
  const [error, setError] = useState(
    initialStatus === 'failed' ? 'We could not send a code automatically. Request one below.' : null,
  )

  async function sendCode() {
    if (pendingAction) return
    setPendingAction('send')
    setNotice(null)
    setError(null)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      })
      if (result.error) {
        setError(result.error.message || 'We could not send a verification code. Try again shortly.')
      } else {
        setNotice('A new verification code was sent. Check your inbox and spam folder.')
      }
    } catch {
      setError('We could not send a verification code. Try again shortly.')
    } finally {
      setPendingAction(null)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingAction || !code.trim()) return

    setPendingAction('verify')
    setNotice(null)
    setError(null)
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: code.trim() })
      if (result.error) {
        setError(result.error.message || 'That code could not be verified. Check it and try again.')
        return
      }
      setNotice('Your email is verified. Deposits and games are now unlocked.')
      setCode('')
      router.refresh()
    } catch {
      setError('That code could not be verified. Check it and try again.')
    } finally {
      setPendingAction(null)
    }
  }

  function handleCodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) {
      event.preventDefault()
    }
  }

  return (
    <section aria-labelledby="email-verification-title" className="mb-6 rounded-2xl border border-amber-100/15 bg-amber-100/[0.035] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-100/10 bg-amber-100/[0.06]">
          <ShieldCheck aria-hidden="true" className="size-5 text-amber-100/75" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/65">One more step</p>
          <h2 id="email-verification-title" className="mt-1 text-base font-bold text-white">Verify your email to unlock deposits</h2>
          <p className="mt-2 break-words text-sm leading-6 text-white/55">
            We haven&apos;t confirmed <span className="font-medium text-white/75">{email}</span> yet. Send a six-digit code, then enter it below. Check your spam folder if it doesn&apos;t arrive.
          </p>
        </div>
      </div>

      <form onSubmit={verifyCode} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="email-verification-code" className="sr-only">Email verification code</label>
        <input
          id="email-verification-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={4}
          maxLength={12}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 12))}
          onKeyDown={handleCodeKeyDown}
          placeholder="Enter verification code"
          aria-describedby="verification-help verification-feedback"
          aria-invalid={Boolean(error)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm tracking-[0.14em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30 focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/10"
        />
        <button
          type="submit"
          disabled={pendingAction !== null || code.trim().length < 4}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === 'verify' ? <RefreshCw aria-hidden="true" className="size-4 animate-spin" /> : <MailCheck aria-hidden="true" className="size-4" />}
          {pendingAction === 'verify' ? 'Checking…' : 'Verify email'}
        </button>
      </form>
      <p id="verification-help" className="mt-2 text-xs text-white/35">Verification is required before deposits and wagers.</p>
      <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="verification-feedback" aria-live="polite" role={error ? 'alert' : 'status'} className={error ? 'text-xs leading-5 text-rose-200' : 'text-xs leading-5 text-emerald-100/75'}>
          {error ?? notice ?? ''}
        </p>
        <button
          type="button"
          onClick={sendCode}
          disabled={pendingAction !== null}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/10 px-3 text-xs font-semibold text-white/70 transition hover:border-amber-100/25 hover:text-amber-50 disabled:cursor-wait disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw aria-hidden="true" className={`size-3.5 ${pendingAction === 'send' ? 'animate-spin' : ''}`} />
          {pendingAction === 'send' ? 'Sending…' : 'Send / resend code'}
        </button>
      </div>
    </section>
  )
}

export default EmailVerificationCard
