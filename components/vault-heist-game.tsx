'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Check, KeyRound, LockKeyhole, ShieldAlert, ShieldCheck, Sparkles, Vault, Wallet } from 'lucide-react'
import type { GameRoundView } from '@/lib/casino-game-types'
import { formatFizzcoins } from '@/lib/format-money'
import { VAULT_HEIST_OUTCOME_LABELS, type VaultHeistOutcome, type VaultHeistProfile } from '@/lib/vault-heist-config'

type LeaderboardEntry = { name: string; payout: string; multiplier: number }
type VaultHeistLeaderboard = {
  today: LeaderboardEntry | null
  all_time: LeaderboardEntry | null
  highest_multiplier: LeaderboardEntry | null
  longest_streak: { name: string; streak: number } | null
  recent: Array<LeaderboardEntry & { createdAt: string }>
}

type Props = {
  profiles: VaultHeistProfile[]
  initialProfileId: string
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
  leaderboard: VaultHeistLeaderboard
}

const outcomeDescriptions: Record<VaultHeistOutcome, string> = {
  cash_bundle: 'Cash bundle secured. A small boost to your getaway.',
  gold_cache: 'Gold cache secured. Your multiplier climbs.',
  diamond_briefcase: 'Diamond briefcase secured. A major payout boost.',
  security_alert: 'Security alert! The alarm level rises.',
  guard_patrol: 'Guard patrol spotted. Security rises sharply.',
  inside_informant: 'Your informant clears one level of security.',
  master_key: 'Master key acquired. The next door is bypassed quietly.',
  golden_vault: 'Golden vault! A rare, major multiplier boost.',
  caught: 'Security caught you before the escape.',
}

export function VaultHeistGame({ profiles, initialProfileId, initialRound, initialBalance, currency, playerName, leaderboard }: Props) {
  const [round, setRound] = useState(initialRound)
  const [balance, setBalance] = useState(initialBalance)
  const [wager, setWager] = useState('400')
  const [profileId, setProfileId] = useState(initialRound?.vaultHeist?.profileId ?? initialProfileId)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState('')
  const [revealedPosition, setRevealedPosition] = useState<number | null>(null)

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0]
  const vault = round?.vaultHeist
  const roundActive = round?.status === 'active'
  const wagerAmount = Number(wager)
  const insufficientBalance = Math.floor(Number(balance) * 400) < 400
  const securityPercent = vault ? Math.min(100, Math.round((vault.security / vault.securityMax) * 100)) : 0
  const latestDoor = vault?.revealedDoors.at(-1)
  const lastRevealedPosition = latestDoor?.position ?? null

  async function sendAction(payload: Record<string, unknown>) {
    setPending(true)
    setError('')
    setVerified('')
    try {
      const response = await fetch('/api/games/vault-heist/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'The game request could not be completed.')
      setRound(result.round ?? null)
      setRevealedPosition(payload.action === 'pick' && typeof payload.position === 'number' ? payload.position : null)
      if (result.wallet?.balance) setBalance(result.wallet.balance)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The game request could not be completed.')
    } finally {
      setPending(false)
    }
  }

  function startRound() {
    if (!Number.isSafeInteger(wagerAmount) || wagerAmount < 400 || wagerAmount > 40_000 || wagerAmount % 4 !== 0) {
      setError('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
      return
    }
    if (wagerAmount > Math.floor(Number(balance) * 400)) {
      setError('Your Fizzcoin balance is too low for that wager.')
      return
    }
    void sendAction({
      action: 'start',
      requestId: crypto.randomUUID(),
      wagerCents: wagerAmount / 4,
      expectedRtpBps: profile.rtpBps,
      profileId: profile.id,
    })
  }

  function openDoor(position: number) {
    if (!round || !roundActive || pending || round.picks.includes(position)) return
    setRevealedPosition(position)
    void sendAction({ action: 'pick', sessionId: round.sessionId, position })
  }

  function cashOut() {
    if (!round || !roundActive || pending || !round.picks.length) return
    void sendAction({ action: 'cashout', sessionId: round.sessionId })
  }

  async function verifyCommitment() {
    if (!round?.fairness) return
    const bytes = new TextEncoder().encode(round.fairness.serverSeed)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const calculated = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    setVerified(calculated === round.fairness.commitment ? 'Verified: the revealed seed matches the published commitment.' : 'Verification failed: the seed does not match the published commitment.')
  }

  function formatEntry(entry: LeaderboardEntry | null) {
    return entry ? `${entry.name} · ${formatFizzcoins(entry.payout, currency)} · ${entry.multiplier.toFixed(2)}×` : 'No escapes recorded yet'
  }

  return (
    <main className="min-h-screen bg-[#090b12] px-4 py-5 text-white sm:px-7 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/casino" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft aria-hidden="true" className="size-4" /> Back to lobby</Link>
        <header className="mt-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200/70">Fizz original · {playerName}</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl"><Vault aria-hidden="true" className="size-8 text-amber-200" /> Vault Heist</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">Choose a door, manage the security level, then make your escape before the vault locks down.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Published odds</p><p className="mt-1 text-xs font-semibold text-white/80">RTP {((round?.rtpBps ?? profile.rtpBps) / 100).toFixed(2)}% <span className="px-1 text-white/25">·</span> House edge {((round?.houseEdgeBps ?? (10_000 - profile.rtpBps)) / 100).toFixed(2)}%</p></div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <Wallet aria-hidden="true" className="size-5 text-emerald-200" />
              <div><p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Wallet</p><p className="text-sm font-bold">{formatFizzcoins(balance, currency)}</p></div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Vault Heist game" className="overflow-hidden rounded-3xl border border-white/10 bg-[#11131a]">
            <div className="relative isolate min-h-[330px] overflow-hidden bg-cover bg-center p-4 sm:min-h-[430px] sm:p-7" style={{ backgroundImage: "linear-gradient(180deg,rgba(7,9,16,.62),rgba(7,9,16,.88)),url('/games/vault-heist-bg.png')" }}>
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(130,90,230,.18),transparent_60%)]" />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Current multiplier</p><p className="mt-1 text-2xl font-black tabular-nums text-amber-100">{vault?.currentMultiplier.toFixed(2) ?? '1.00'}×</p></div>
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Vault security</p><div className="mt-2 flex items-center gap-2"><div className="h-2 w-32 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-all duration-500 ${securityPercent >= 70 ? 'bg-rose-400' : securityPercent >= 40 ? 'bg-amber-300' : 'bg-emerald-300'}`} style={{ width: `${securityPercent}%` }} /></div><span className="text-xs font-bold tabular-nums">{vault?.security ?? 0}/{vault?.securityMax ?? profile.securityMax}</span></div></div>
              </div>

              <div className="relative mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-5 sm:gap-4" aria-label="Ten vault doors">
                {Array.from({ length: 10 }, (_, position) => {
                  const revealedDoor = vault?.revealedDoors.find((door) => door.position === position)
                  const finalOutcome = vault?.allDoorOutcomes?.[position]
                  const shownOutcome = revealedDoor?.outcome ?? finalOutcome
                  const isOpen = Boolean(revealedDoor || (round?.status === 'settled' && finalOutcome))
                  const isLast = revealedPosition === position || lastRevealedPosition === position
                  return <button key={position} type="button" aria-label={`Vault door ${position + 1}${shownOutcome ? `, ${VAULT_HEIST_OUTCOME_LABELS[shownOutcome]}` : ''}`} disabled={!roundActive || pending || Boolean(revealedDoor)} onClick={() => openDoor(position)} className={`group relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border p-3 text-center transition duration-300 sm:min-h-28 ${isOpen ? shownOutcome === 'caught' ? 'border-rose-300/50 bg-rose-950/70 text-rose-100' : 'border-emerald-200/35 bg-emerald-950/65 text-emerald-100' : 'border-white/15 bg-[#12141b]/85 text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] hover:-translate-y-0.5 hover:border-amber-200/55 hover:bg-[#24212a]/90 disabled:cursor-default disabled:hover:translate-y-0'}`}>
                    <span className="flex size-9 items-center justify-center rounded-full border border-current/20 bg-black/20">{isOpen ? shownOutcome === 'caught' ? <ShieldAlert aria-hidden="true" className="size-5" /> : shownOutcome === 'master_key' ? <KeyRound aria-hidden="true" className="size-5" /> : <Sparkles aria-hidden="true" className="size-5" /> : <LockKeyhole aria-hidden="true" className="size-5 text-amber-100/80" />}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Door {String(position + 1).padStart(2, '0')}</span>
                    {shownOutcome && <span className={`text-[10px] leading-tight ${isLast ? 'font-bold' : 'opacity-75'}`}>{VAULT_HEIST_OUTCOME_LABELS[shownOutcome]}</span>}
                  </button>
                })}
              </div>
              <p className="relative mt-4 text-center text-xs text-white/45" aria-live="polite">{latestDoor ? outcomeDescriptions[latestDoor.outcome] : roundActive ? 'Choose any unopened door. Your next result is generated securely on the server.' : 'Choose a profile and wager, then start the heist.'}</p>
            </div>

            <div className="flex flex-col gap-4 border-t border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              {roundActive ? <>
                <div className="text-xs text-white/50">Wager <span className="font-bold text-white">{formatFizzcoins(round.wager, currency)}</span><span className="ml-2">· {round.picks.length}/10 doors opened</span></div>
                <button type="button" disabled={pending || !round.picks.length} onClick={cashOut} className="min-h-11 rounded-xl bg-amber-300 px-6 text-sm font-black text-[#211807] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45">{pending ? 'Processing…' : `Escape with ${formatFizzcoins((Number(round.wager) * vault!.currentMultiplier).toFixed(2), currency)}`}</button>
              </> : <>
                <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/60">Difficulty profile
                  <select aria-label="Difficulty profile" disabled={pending} value={profileId} onChange={(event) => setProfileId(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm text-white outline-none focus:border-amber-200/50">{profiles.map((item) => <option key={item.id} value={item.id}>{item.name} · {(item.rtpBps / 100).toFixed(2)}% RTP · {((10_000 - item.rtpBps) / 100).toFixed(2)}% edge</option>)}</select>
                </label>
                <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/60">Wager in Fizzcoins
                  <input aria-label="Wager in Fizzcoins" type="number" min="400" max="40000" step="4" value={wager} onChange={(event) => setWager(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#0b0d14] px-3 text-sm font-bold text-white outline-none focus:border-amber-200/50" />
                </label>
                <button type="button" disabled={pending || insufficientBalance} onClick={startRound} className="min-h-11 rounded-xl bg-amber-300 px-7 text-sm font-black text-[#211807] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45">{pending ? 'Preparing…' : insufficientBalance ? 'Need 400 Fizzcoins' : round?.status === 'settled' ? 'Play again' : 'Start heist'}</button>
              </>}
            </div>
            {error && <p role="alert" className="mx-4 mb-4 rounded-xl border border-rose-200/15 bg-rose-100/[0.04] px-4 py-3 text-sm text-rose-100/85 sm:mx-6">{error}</p>}
            {round?.status === 'settled' && <div className={`mx-4 mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 sm:mx-6 ${round.result === 'win' ? 'border-emerald-200/20 bg-emerald-100/[0.04]' : 'border-rose-200/20 bg-rose-100/[0.04]'}`}><span>{round.result === 'win' ? <Check aria-hidden="true" className="size-4 text-emerald-200" /> : <ShieldAlert aria-hidden="true" className="size-4 text-rose-200" />}</span><div><p className="text-sm font-bold">{round.result === 'win' ? `Escape successful · ${formatFizzcoins(round.payout, currency)} paid` : 'Heist ended · no payout'}</p><p className="mt-1 text-xs text-white/50">Wallet balance: {formatFizzcoins(balance, currency)}</p></div></div>}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-2xl border border-white/10 bg-[#11131a] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50"><ShieldCheck aria-hidden="true" className="size-4 text-emerald-200" /> Fair play</div><p className="mt-3 text-xs leading-5 text-white/55">RTP scales reward growth, but a successful escape always returns at least your original wager. Captures end the round without a payout. Door outcomes are generated server-side from a committed seed, and active rounds keep their original profile and outcome sequence.</p>{round && <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-semibold text-white/70">Round fairness record</summary><dl className="mt-3 grid gap-2 break-all text-[10px] text-white/45"><div><dt className="font-semibold text-white/65">SHA-256 commitment</dt><dd className="mt-1 font-mono">{round.commitment}</dd></div><div><dt className="font-semibold text-white/65">Client seed</dt><dd className="mt-1 font-mono">{round.clientSeed}</dd></div>{round.fairness && <div><dt className="font-semibold text-white/65">Revealed server seed</dt><dd className="mt-1 font-mono">{round.fairness.serverSeed}</dd></div>}</dl>{round.fairness && <button type="button" onClick={verifyCommitment} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white">Verify commitment</button>}{verified && <p role="status" className="mt-2 text-xs text-emerald-200/80">{verified}</p>}</details>}</section>
            <section className="rounded-2xl border border-white/10 bg-[#11131a] p-5"><h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Top escapes</h2><dl className="mt-4 grid gap-4 text-xs"><div><dt className="text-white/40">Today's biggest</dt><dd className="mt-1 font-semibold text-white/85">{formatEntry(leaderboard.today)}</dd></div><div><dt className="text-white/40">All-time payout</dt><dd className="mt-1 font-semibold text-white/85">{formatEntry(leaderboard.all_time)}</dd></div><div><dt className="text-white/40">Highest multiplier</dt><dd className="mt-1 font-semibold text-white/85">{formatEntry(leaderboard.highest_multiplier)}</dd></div><div><dt className="text-white/40">Longest win streak</dt><dd className="mt-1 font-semibold text-white/85">{leaderboard.longest_streak ? `${leaderboard.longest_streak.name} · ${leaderboard.longest_streak.streak} rounds` : 'No streaks recorded yet'}</dd></div></dl></section>
            <p className="px-1 text-[11px] leading-5 text-white/35">Wagers and payouts use your verified Fizz wallet. Only play where legal and never wager more than you can afford to lose.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}
