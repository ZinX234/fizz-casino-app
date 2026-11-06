'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LoaderCircle, Save } from 'lucide-react'

type Profile = {
  username: string
  paypalFirstName: string
  paypalLastName: string
  paypalEmail: string
}

const inputClass = 'min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/10'

export function ProfileSettingsForm({ initialProfile, fizzEmail }: { initialProfile: Profile | null; fizzEmail: string }) {
  const router = useRouter()
  const [username, setUsername] = useState(initialProfile?.username ?? '')
  const [paypalFirstName, setPaypalFirstName] = useState(initialProfile?.paypalFirstName ?? '')
  const [paypalLastName, setPaypalLastName] = useState(initialProfile?.paypalLastName ?? '')
  const [paypalEmail, setPaypalEmail] = useState(initialProfile?.paypalEmail ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    setSaved(false)
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, paypalFirstName, paypalLastName, paypalEmail }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Your profile could not be saved.')
      const profile = payload.profile as Profile
      setUsername(profile.username)
      setPaypalFirstName(profile.paypalFirstName)
      setPaypalLastName(profile.paypalLastName)
      setPaypalEmail(profile.paypalEmail)
      setSaved(true)
      router.refresh()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Your profile could not be saved.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
        <label htmlFor="fizz-email" className="text-xs font-semibold text-white/60">Fizz email</label>
        <input id="fizz-email" type="email" value={fizzEmail} readOnly aria-describedby="fizz-email-help" className={`${inputClass} mt-2 cursor-not-allowed text-white/50`} />
        <p id="fizz-email-help" className="mt-2 text-xs leading-5 text-white/40">This is the email on your Fizz sign-in account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor="fizz-username" className="text-xs font-semibold text-white/60">Fizz username<input id="fizz-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoComplete="username" aria-describedby="username-help" className={`${inputClass} mt-2`} /></label>
        <p id="username-help" className="self-end text-xs leading-5 text-white/40 sm:pb-3">3–20 letters, numbers, or underscores. Your username is public and must be unique.</p>
        <label htmlFor="paypal-first-name" className="text-xs font-semibold text-white/60">PayPal account first name<input id="paypal-first-name" name="paypalFirstName" value={paypalFirstName} onChange={(event) => setPaypalFirstName(event.target.value)} required maxLength={80} autoComplete="given-name" className={`${inputClass} mt-2`} /></label>
        <label htmlFor="paypal-last-name" className="text-xs font-semibold text-white/60">PayPal account last name<input id="paypal-last-name" name="paypalLastName" value={paypalLastName} onChange={(event) => setPaypalLastName(event.target.value)} required maxLength={80} autoComplete="family-name" className={`${inputClass} mt-2`} /></label>
        <label htmlFor="paypal-email" className="text-xs font-semibold text-white/60 sm:col-span-2">PayPal email<input id="paypal-email" name="paypalEmail" value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} type="email" required maxLength={254} autoComplete="email" className={`${inputClass} mt-2`} /></label>
      </div>

      <p className="text-xs leading-5 text-white/40">Your PayPal name and email are used to identify manual deposits and process withdrawal requests. Keep them up to date.</p>
      {error && <p role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-100/85">{error}</p>}
      {saved && <p role="status" className="inline-flex items-center gap-2 text-sm text-emerald-200"><Check aria-hidden="true" className="size-4" /> Profile saved.</p>}
      <button type="submit" disabled={pending || !fizzEmail} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-wait disabled:opacity-60">
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
        {pending ? 'Saving profile…' : initialProfile ? 'Save profile' : 'Complete profile'}
      </button>
    </form>
  )
}
