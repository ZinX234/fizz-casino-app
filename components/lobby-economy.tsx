'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { CloudRain, Coins, LoaderCircle, Timer, Users } from 'lucide-react'

type LobbyEconomySnapshot = {
  activeRain: null | {
    id: string
    amount: string
    currency: string
    hostName: string
    closesAt: string
    durationSeconds: number
    participantCount: string
    isJoined: boolean
  }
}

async function economyFetcher(url: string): Promise<LobbyEconomySnapshot> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Lobby wallet features are unavailable.')
  const data = await response.json() as LobbyEconomySnapshot
  if (data.activeRain && new Date(data.activeRain.closesAt).getTime() <= Date.now()) {
    await fetch('/api/chat/economy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settle_rains' }),
    })
    const refreshed = await fetch(url, { cache: 'no-store' })
    if (refreshed.ok) return refreshed.json() as Promise<LobbyEconomySnapshot>
  }
  return data
}

export function LobbyEconomy({ signedIn }: { signedIn: boolean }) {
  const [showRainForm, setShowRainForm] = useState(false)
  const [showTipForm, setShowTipForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [duration, setDuration] = useState(60)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { data, error: loadError, mutate } = useSWR<LobbyEconomySnapshot>('/api/chat/economy', economyFetcher, { refreshInterval: 5000, revalidateOnFocus: true })

  async function perform(action: string, details: Record<string, string | number | boolean> = {}) {
    setBusyAction(action)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/chat/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...details }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'The wallet action could not be completed.')
      await mutate()
      return payload
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The wallet action could not be completed.')
      return null
    } finally {
      setBusyAction(null)
    }
  }

  async function startRain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await perform('create_rain', { amount, durationSeconds: duration, requestId: crypto.randomUUID() })
    if (result) {
      setAmount('')
      setShowRainForm(false)
      setSuccess('Your rain pool is live. Your contribution is reserved until it pays out.')
    }
  }

  async function sendTip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await perform('send_tip', { amount, recipientName, requestId: crypto.randomUUID() })
    if (result) {
      setAmount('')
      setRecipientName('')
      setShowTipForm(false)
      setSuccess('Your tip was transferred to the player.')
    }
  }

  const rain = data?.activeRain
  const remainingSeconds = rain ? Math.max(0, Math.ceil((new Date(rain.closesAt).getTime() - Date.now()) / 1000)) : 0

  return (
    <div className="border-b border-white/[0.07] bg-black/10 px-3 py-3">
      {rain && <div className="mb-2 rounded-lg border border-sky-200/10 bg-sky-200/[0.04] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2"><p className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-sky-100"><CloudRain aria-hidden="true" className="size-3.5 shrink-0" /> ${Number(rain.amount).toFixed(2)} rain by {rain.hostName}</p><span className="inline-flex shrink-0 items-center gap-1 text-[10px] tabular-nums text-white/50"><Timer aria-hidden="true" className="size-3" />{remainingSeconds}s</span></div>
        <div className="mt-1.5 flex items-center justify-between gap-2"><p className="inline-flex items-center gap-1 text-[10px] text-white/40"><Users aria-hidden="true" className="size-3" />{rain.participantCount} participants · equal shares</p>{signedIn ? <button type="button" disabled={Boolean(busyAction) || rain.isJoined || remainingSeconds <= 0} onClick={() => void perform('join_rain', { rainId: rain.id })} className="min-h-7 rounded-md bg-sky-100/15 px-2.5 text-[10px] font-bold text-sky-100 hover:bg-sky-100/25 disabled:opacity-50">{rain.isJoined ? 'Joined' : busyAction === 'join_rain' ? 'Joining…' : 'Join'}</button> : <Link href="/auth/sign-in" className="text-[10px] font-semibold text-sky-100">Sign in to join</Link>}</div>
      </div>}
      {loadError && <p role="alert" className="mb-2 text-[10px] text-rose-200/80">Live rain status could not be loaded.</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!signedIn || Boolean(busyAction) || Boolean(rain)} onClick={() => { setShowRainForm((value) => !value); setShowTipForm(false); setError(''); setSuccess('') }} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-sky-200/10 bg-sky-200/[0.04] text-[10px] font-semibold text-sky-100/80 hover:bg-sky-200/[0.08] disabled:opacity-45"><CloudRain aria-hidden="true" className="size-3.5" />Start rain</button>
        <button type="button" disabled={!signedIn || Boolean(busyAction)} onClick={() => { setShowTipForm((value) => !value); setShowRainForm(false); setError(''); setSuccess('') }} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-100/10 bg-amber-100/[0.035] text-[10px] font-semibold text-amber-100/80 hover:bg-amber-100/[0.07] disabled:opacity-45"><Coins aria-hidden="true" className="size-3.5" />Send tip</button>
      </div>
      {!signedIn && <p className="mt-2 text-center text-[9px] text-white/35">Sign in to start a rain pool or send a tip.</p>}
      {showRainForm && <form onSubmit={startRain} className="mt-2 grid grid-cols-[1fr_92px_auto] gap-1.5">
        <label className="sr-only" htmlFor="rain-pool-amount">Rain pool contribution in USD</label><input id="rain-pool-amount" value={amount} onChange={(event) => setAmount(event.target.value)} type="text" inputMode="decimal" maxLength={8} pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="$5.00" required className="h-8 min-w-0 rounded-md border border-white/10 bg-black/25 px-2 text-[10px] text-white outline-none placeholder:text-white/35 focus:border-sky-100/35" />
        <label className="sr-only" htmlFor="rain-duration">Rain pool duration</label><select id="rain-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-8 min-w-0 rounded-md border border-white/10 bg-[#16171c] px-1.5 text-[10px] text-white/75 outline-none"><option value={60}>60 seconds</option><option value={90}>90 seconds</option><option value={120}>120 seconds</option></select>
        <button type="submit" disabled={Boolean(busyAction) || !amount.trim()} aria-label="Start rain pool" className="flex size-8 items-center justify-center rounded-md bg-sky-100/15 text-sky-100 hover:bg-sky-100/25 disabled:opacity-45">{busyAction === 'create_rain' ? <LoaderCircle className="size-3.5 animate-spin" /> : <CloudRain className="size-3.5" />}</button>
      </form>}
      {showTipForm && <form onSubmit={sendTip} className="mt-2 grid grid-cols-[1fr_84px_auto] gap-1.5">
        <label className="sr-only" htmlFor="tip-recipient-name">Player display name</label><input id="tip-recipient-name" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} maxLength={80} placeholder="Player name" required className="h-8 min-w-0 rounded-md border border-white/10 bg-black/25 px-2 text-[10px] text-white outline-none placeholder:text-white/35 focus:border-amber-100/35" />
        <label className="sr-only" htmlFor="tip-amount">Tip amount in USD</label><input id="tip-amount" value={amount} onChange={(event) => setAmount(event.target.value)} type="text" inputMode="decimal" maxLength={7} pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="$1.00" required className="h-8 min-w-0 rounded-md border border-white/10 bg-black/25 px-2 text-[10px] text-white outline-none placeholder:text-white/35 focus:border-amber-100/35" />
        <button type="submit" disabled={Boolean(busyAction) || !amount.trim() || !recipientName.trim()} aria-label="Send tip" className="flex size-8 items-center justify-center rounded-md bg-amber-100/15 text-amber-100 hover:bg-amber-100/25 disabled:opacity-45">{busyAction === 'send_tip' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Coins className="size-3.5" />}</button>
      </form>}
      <p aria-live="polite" role={error ? 'alert' : success ? 'status' : undefined} className={error ? 'mt-2 text-[10px] text-rose-200/80' : success ? 'mt-2 text-[10px] text-emerald-200/80' : 'sr-only'}>{error || success}</p>
    </div>
  )
}
