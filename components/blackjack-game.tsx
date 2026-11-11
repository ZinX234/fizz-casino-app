'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, CircleHelp, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { BlackjackCard, GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'
import { formatFizzcoins } from '@/lib/format-money'

type Props = {
  setting: GameRtpSetting
  initialRound: GameRoundView | null
  initialBalance: string
  currency: string
  playerName: string
}

const suitSymbols: Record<string, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

function PlayingCard({ card, hidden = false, cardKey, side, index }: { card?: BlackjackCard; hidden?: boolean; cardKey: string; side: 'player' | 'dealer'; index: number }) {
  const dealOrder = index > 1 ? index + (side === 'dealer' ? 3 : 2) : index * 2 + (side === 'dealer' ? 1 : 0)
  if (hidden || !card) {
    return <div data-card-key={cardKey} data-card-hidden="true" data-deal-order={dealOrder} aria-label="Face-down card" className="blackjack-card relative flex aspect-[0.7] w-[68px] items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-[repeating-linear-gradient(45deg,#262b39,#262b39_5px,#1c202b_5px,#1c202b_10px)] shadow-lg sm:w-[82px]"><img src="/fizzlogo.png" alt="" className="w-[72%] object-contain opacity-75" /></div>
  }
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <div data-card-key={cardKey} data-card-hidden="false" data-deal-order={dealOrder} aria-label={`${card.rank} of ${card.suit}`} className={`blackjack-card relative flex aspect-[0.7] w-[68px] flex-col justify-between rounded-lg border border-black/10 bg-[#f7f4ed] p-1.5 shadow-lg sm:w-[82px] sm:p-2 ${red ? 'text-[#c14447]' : 'text-[#20252e]'}`}>
      <span className="text-sm font-bold leading-none sm:text-base">{card.rank}<span className="block text-xs">{suitSymbols[card.suit]}</span></span>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-3xl opacity-75 sm:text-4xl">{suitSymbols[card.suit]}</span>
      <span aria-hidden="true" className="rotate-180 self-end text-sm font-bold leading-none sm:text-base">{card.rank}<span className="block text-xs">{suitSymbols[card.suit]}</span></span>
    </div>
  )
}

export function BlackjackGame({ setting, initialRound, initialBalance, currency, playerName }: Props) {
  const [round, setRound] = useState(initialRound)
  const [balance, setBalance] = useState(initialBalance)
  const [wager, setWager] = useState('400')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState('')
  const cardStates = useRef(new Map<string, boolean>())
  const deckRef = useRef<HTMLDivElement>(null)
  const hand = round?.blackjack
  const active = round?.status === 'active'

  useLayoutEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.blackjack-card[data-card-key]'))
      .sort((left, right) => Number(left.dataset.dealOrder) - Number(right.dataset.dealOrder))
    const deck = deckRef.current
    const deckBounds = deck?.getBoundingClientRect()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let dealIndex = 0

    for (const card of cards) {
      const key = card.dataset.cardKey
      if (!key) continue
      const isHidden = card.dataset.cardHidden === 'true'
      const previousState = cardStates.current.get(key)
      if (previousState === isHidden) continue
      cardStates.current.set(key, isHidden)

      if (previousState === true && !isHidden) {
        card.animate(
          [{ transform: 'perspective(700px) rotateY(180deg)', filter: 'brightness(.7)' }, { transform: 'perspective(700px) rotateY(-12deg)', filter: 'brightness(1.1)', offset: 0.68 }, { transform: 'perspective(700px) rotateY(0)', filter: 'brightness(1)' }],
          { duration: reduceMotion ? 1 : 480, easing: 'cubic-bezier(.2,.72,.24,1)' },
        )
        continue
      }

      if (!deckBounds || !card.animate) {
        card.style.opacity = '1'
        cardStates.current.set(key, isHidden)
        continue
      }

      const cardBounds = card.getBoundingClientRect()
      const startX = deckBounds.left + deckBounds.width / 2 - (cardBounds.left + cardBounds.width / 2)
      const startY = deckBounds.top + deckBounds.height / 2 - (cardBounds.top + cardBounds.height / 2)
      const order = dealIndex++
      const animation = card.animate(
        [
          { opacity: 1, transform: `translate3d(${startX}px, ${startY}px, 0) rotateZ(9deg) scale(.76)`, filter: 'brightness(1.15)' },
          { opacity: 1, transform: `translate3d(${startX * 0.48}px, ${startY * 0.48 - 34}px, 0) rotateZ(-4deg) scale(1.04)`, filter: 'brightness(1.08)', offset: 0.68 },
          { opacity: 1, transform: 'translate3d(0, 0, 0) rotateZ(0) scale(1)', filter: 'brightness(1)' },
        ],
        { duration: reduceMotion ? 1 : 760, delay: reduceMotion ? 0 : order * 180, easing: 'cubic-bezier(.18,.72,.24,1)', fill: 'both' },
      )
      animation.onfinish = () => {
        card.style.opacity = '1'
        card.style.transform = 'none'
        card.style.filter = 'none'
        animation.cancel()
      }
    }
  })

  async function sendAction(action: 'start' | 'hit' | 'stand' | 'double') {
    if (pending) return
    setPending(true)
    setError('')
    setVerified('')
    try {
      const payload = action === 'start'
        ? { action, requestId: crypto.randomUUID(), wagerCents: Number(wager) / 4, expectedRtpBps: setting.rtpBps }
        : { action, sessionId: round!.sessionId, requestId: crypto.randomUUID() }
      const response = await fetch('/api/games/blackjack/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'The game request could not be completed.')
      setRound(result.round ?? null)
      if (result.wallet?.balance) setBalance(result.wallet.balance)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The game request could not be completed.')
    } finally {
      setPending(false)
    }
  }

  async function verifyCommitment() {
    if (!round?.fairness) return
    const bytes = new TextEncoder().encode(round.fairness.serverSeed)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const calculated = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    setVerified(calculated === round.fairness.commitment ? 'Verified: the revealed seed matches the published commitment.' : 'Verification failed: the seed does not match the published commitment.')
  }

  function startRound() {
    const amount = Number(wager)
    if (!Number.isSafeInteger(amount) || amount < 400 || amount > 40_000 || amount % 4 !== 0) {
      setError('Choose a wager from 400 to 40,000 Fizzcoins in increments of 4.')
      return
    }
    if (amount > Math.floor(Number(balance) * 400)) {
      setError('Your Fizzcoin balance is too low for that wager.')
      return
    }
    void sendAction('start')
  }

  const settlementMessage = hand?.settlement === 'push'
    ? 'Push — your wager has been returned.'
    : hand?.settlement === 'win'
      ? 'You beat the dealer.'
      : hand?.settlement === 'loss'
        ? hand.playerTotal > 21 ? 'Bust — that hand is over 21.' : 'Dealer wins this hand.'
        : ''

  return (
    <main className="min-h-screen bg-[#0b0e12] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/casino" className="inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"><ArrowLeft aria-hidden="true" className="size-4" /> Back to lobby</Link>
        <div className="mt-7 flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">Fizz Originals · {playerName}</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Blackjack</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/45">A considered classic. Get closer to 21 than the dealer without going over.</p></div>
          <div className="flex items-center gap-3 self-start rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 sm:self-auto"><ShieldCheck aria-hidden="true" className="size-4 text-emerald-200/75" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/35">Configured draw odds</p><p className="mt-1 text-xs font-semibold text-white/80">RTP control {((round?.rtpBps ?? setting.rtpBps) / 100).toFixed(2)}% <span className="px-1 text-white/25">·</span> House edge {((round?.houseEdgeBps ?? setting.houseEdgeBps) / 100).toFixed(2)}%</p></div></div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Blackjack table" className="rounded-[24px] border border-white/[0.08] bg-[#12151a] p-3 sm:p-5">
            <div className="relative flex min-h-[440px] flex-col overflow-hidden rounded-[20px] border border-[#d6b674]/20 bg-[radial-gradient(ellipse_at_50%_42%,#20634d_0%,#124632_48%,#0d3027_100%)] px-4 py-7 shadow-inner sm:min-h-[500px] sm:px-8">
              <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[44%] border border-[#d6b674]/15 sm:inset-5" />
              <img src="/fizzlogo.png" alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-48 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.09] sm:w-64" />
              <div ref={deckRef} aria-hidden="true" className="pointer-events-none absolute bottom-5 right-4 h-[82px] w-[58px] -rotate-[12deg] sm:bottom-7 sm:right-7">
                <div className="absolute -left-2 -top-2 h-full w-full rounded-md border border-white/10 bg-[#252b38] shadow-lg" />
                <div className="absolute -left-1 -top-1 h-full w-full rounded-md border border-white/15 bg-[#202633] shadow-lg" />
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-white/20 bg-[repeating-linear-gradient(45deg,#262b39,#262b39_4px,#1c202b_4px,#1c202b_8px)] shadow-lg"><img src="/fizzlogo.png" alt="" className="w-[72%] opacity-75" /></div>
              </div>
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">Dealer{hand?.dealerTotal !== null && hand?.dealerTotal !== undefined ? ` · ${hand.dealerTotal}` : ''}</p>
                  <div className="mt-3 flex min-h-[100px] items-center justify-center">
                    {hand ? <div className="flex -space-x-4 sm:-space-x-5">{hand.dealerCards.map((card, index) => {
                      const cardKey = `${round!.sessionId}-dealer-${index}`
                      return <PlayingCard key={cardKey} cardKey={cardKey} side="dealer" index={index} card={card} />
                    })}{active && (() => {
                      const cardKey = `${round!.sessionId}-dealer-1`
                      return <PlayingCard key={cardKey} cardKey={cardKey} side="dealer" index={1} hidden />
                    })()}</div> : <p className="text-sm text-white/45">The table is ready when you are.</p>}
                  </div>
                </div>
                <div className="my-2 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35"><span className="h-px w-8 bg-white/15" />Dealer stands on 17<span className="h-px w-8 bg-white/15" /></div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">Your hand{hand ? ` · ${hand.playerTotal}` : ''}</p>
                  <div className="mt-3 flex min-h-[100px] items-center justify-center">
                    {hand ? <div className="flex -space-x-4 sm:-space-x-5">{hand.playerCards.map((card, index) => {
                      const cardKey = `${round!.sessionId}-player-${index}`
                      return <PlayingCard key={cardKey} cardKey={cardKey} side="player" index={index} card={card} />
                    })}</div> : <div className="flex h-[100px] items-center text-5xl font-light text-white/15">21</div>}
                  </div>
                  {active && hand?.nextHitBustProbabilityBps !== undefined && <p className="mt-2 text-[10px] font-medium text-white/55">Next hit bust chance <span className="font-bold text-amber-100">{(hand.nextHitBustProbabilityBps / 100).toFixed(2)}%</span></p>}
                </div>
              </div>
              {active && <p className="relative mt-2 text-center text-xs text-white/60">Wager {formatFizzcoins(round!.wager, currency)}</p>}
            </div>

            {active ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <button type="button" disabled={pending} onClick={() => void sendAction('hit')} className="min-h-12 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold transition hover:bg-white/[0.09] disabled:opacity-50">{pending ? 'Working…' : 'Hit'}</button>
                <button type="button" disabled={pending} onClick={() => void sendAction('stand')} className="min-h-12 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold transition hover:bg-white/[0.09] disabled:opacity-50">Stand</button>
                <button type="button" disabled={pending || !hand?.canDouble || Number(balance) < Number(round!.wager)} onClick={() => void sendAction('double')} className="min-h-12 rounded-xl bg-[#e8bd73] px-3 text-sm font-bold text-[#17130d] transition hover:bg-[#f1cd8d] disabled:cursor-not-allowed disabled:opacity-45">Double</button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-white/55">Wager in Fizzcoins
                  <span className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0b0c10] px-3"><span className="text-white/35">FC</span><input aria-label="Wager in Fizzcoins" type="number" min="400" max="40000" step="4" value={wager} onChange={(event) => setWager(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none" /></span>
                </label>
                <button type="button" disabled={pending || Math.floor(Number(balance) * 400) < 400} onClick={startRound} className="min-h-11 rounded-xl bg-[#e8bd73] px-6 text-sm font-bold text-[#17130d] transition hover:bg-[#f1cd8d] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Dealing…' : 'Deal hand'}</button>
              </div>
            )}
            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200/15 bg-rose-100/[0.04] px-4 py-3 text-sm text-rose-100/80">{error}</p>}
            {round?.status === 'settled' && <div role="status" className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${hand?.settlement === 'win' || hand?.settlement === 'push' ? 'border-emerald-200/15 bg-emerald-100/[0.04]' : 'border-rose-200/15 bg-rose-100/[0.04]'}`}><span className="mt-0.5">{hand?.settlement === 'win' || hand?.settlement === 'push' ? <Check aria-hidden="true" className="size-4 text-emerald-200" /> : <TriangleAlert aria-hidden="true" className="size-4 text-rose-200" />}</span><div><p className="text-sm font-semibold">{settlementMessage}</p><p className="mt-1 text-xs text-white/45">{Number(round.payout) > 0 ? `Paid ${formatFizzcoins(round.payout, currency)}` : 'No payout'} · Wallet {formatFizzcoins(balance, currency)}</p></div></div>}
            {round && <details className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3"><summary className="cursor-pointer text-xs font-semibold text-white/65">Fairness record · {active ? 'seed commitment published' : 'seed revealed'}</summary><dl className="mt-3 grid gap-2 break-all text-[11px] text-white/45"><div><dt className="font-semibold text-white/65">Odds model</dt><dd className="mt-1 font-mono">{hand?.oddsModel ?? 'unavailable'} · RTP {((round.rtpBps) / 100).toFixed(2)}%</dd></div><div><dt className="font-semibold text-white/65">SHA-256 commitment</dt><dd className="mt-1 font-mono">{round.commitment}</dd></div><div><dt className="font-semibold text-white/65">Client seed</dt><dd className="mt-1 font-mono">{round.clientSeed}</dd></div>{round.fairness && <div><dt className="font-semibold text-white/65">Revealed server seed</dt><dd className="mt-1 font-mono">{round.fairness.serverSeed}</dd></div>}</dl>{round.fairness && <button type="button" onClick={verifyCommitment} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white">Verify seed commitment</button>}{verified && <p role="status" className="mt-2 text-xs text-emerald-200/80">{verified}</p>}</details>}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[20px] border border-white/[0.08] bg-[#12141a] p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Wallet balance</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatFizzcoins(balance, currency)}</p><p className="mt-2 text-xs leading-5 text-white/40">Wagers and payouts are recorded in your wallet ledger. Double down adds an equal wager to your current hand.</p></section>
            <section className="rounded-[20px] border border-amber-100/10 bg-amber-100/[0.025] p-5"><div className="flex items-center gap-2 text-xs font-bold text-amber-100/75"><CircleHelp aria-hidden="true" className="size-4" /> Table rules &amp; odds</div><ul className="mt-3 space-y-2 text-xs leading-5 text-white/45"><li>Dealer stands on 17. Aces count as 1 or 11. Blackjack pays 3:2; a tie returns your wager.</li><li>On your hit, each busting card has weight 10,000 and each safe card has weight equal to the configured RTP in basis points. On dealer draws, dealer-safe cards have weight 10,000 and dealer-busting cards have weight equal to RTP.</li><li>Weights are normalized across the remaining deck and draws are seed-driven. The live next-hit bust chance is shown above.</li><li>This disclosed odds adjustment is not an exact long-run return guarantee. Results depend on player decisions and vary over time. Double is available on your first two cards.</li></ul></section>
            <p className="px-1 text-[11px] leading-5 text-white/35">Only play where legal and if you meet the legal age. Set limits and never wager more than you can afford to lose.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}
