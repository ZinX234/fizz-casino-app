You are integrating an already-finished game, FIZZ: SHATTERPOINT, into the Fizz Casino
website. The game is in this repository and is complete — art, animation, audio and
gameplay are approved and must not be redesigned. Your job is to put it on the casino
floor and make it real money under Fizz's existing systems.

## THE GAME AS IT EXISTS TODAY

Stack: React 19 + TanStack Start + Three.js r171 + Tailwind. Single route `src/routes/index.jsx`
renders `src/components/game/ShatterpointGame.jsx`, which orchestrates everything.

A round: a glass bridge of N panes (default 12, allowed 3–24). Each stage has two panes and
exactly one holds. The player picks a pane; a safe pane advances the stage, an unsafe one ends
the run. Clearing every stage wins. No cash-out, no stake input, no side bets exist yet.

Outcome logic lives in `src/game/engine.js`:
- `createSession({ mode, stages })` builds `{ id, mode, stages, arrangement, stage, status,
  locked, startedAt }`, where `arrangement` is one `"left" | "right"` per stage.
- `stableSide()` returns `Math.random() < 0.5 ? "left" : "right"` — a fair coin, no weighting,
  no RTP, no house edge.
- `isSafePanel(session, stage, side)` compares the pick to `arrangement[stage]`.
- The whole answer key sits in the client session object.

The only casino-facing code is `src/game/fizzBridge.js`, a placeholder host seam reading
`window.FizzShatterpoint = { getBalance, beginRealPlay, completeRealPlay }`. With no host it
returns a zero balance and locks Real Play. `completeRealPlay` moves no money. Replace it.

Other relevant files: `src/components/game/GameCanvas.jsx` (WebGL lifecycle), `GameHUD.jsx`,
`MainMenu.jsx`, `ResultsScreen.jsx`, `src/game/settings.js` (defaults, themes, localStorage:
`fizz.shatterpoint.settings|stats|intro|dev.v1`), `src/game/audio.js` (synthesised Web Audio).
The scene (`src/game/scene/`) exposes `startRun`, `resolveSafe`, `breakPanel`, `playVictory`,
`enableStage`, `enterMenu`, `setTheme`, `setSettings`, `dispose`. Leave it alone.

## NON-NEGOTIABLE CONSTRAINT: THE MATH IS FIZZ'S

The real Fizz Casino site already runs an RTP and house-edge system, controlled from its admin
dashboard. That system is the single source of truth for every number in this game.

DO NOT build a math model. DO NOT invent multipliers, a paytable, an RTP calculation, an
alternative weighting scheme, a parallel admin screen, or a simulation harness. DO NOT compute
anything probabilistic in the browser for real play. If any of those seem necessary, stop and
ask for the existing Fizz endpoint instead.

## YOUR WORK

1. FLOOR PRESENCE
   - Add an `embedded` prop to `ShatterpointGame.jsx`: fill the container (`h-full`, not
     `h-[100svh]`) and hide the in-game Fizz wordmark and build footer, since the casino shell
     already shows them. Keep the in-game sound/settings/pause controls.
   - Mount it at `/games/shatterpoint` inside the casino shell (header, balance chip, cashier
     stay visible). Deep link `?mode=demo|real`, defaulting to real when signed in with balance.
   - Register it in the lobby catalogue: slug `shatterpoint`, title `FIZZ: Shatterpoint`,
     category, thumbnail, stake limits, launch URL, jurisdiction tags, ordering, enabled flag.
   - Fire launch/run events into the casino's existing analytics pipeline.
   - Verify the WebGL context is disposed on every exit and re-entry.

2. SERVER-AUTHORITATIVE ROUNDS
   - Remove outcome generation from the client. Delete `stableSide()`/`arrangement` as the
     authority and never send the arrangement, the seed or the weighting to the browser before
     the round ends.
   - Add: create session (stake debited atomically, integer minor units), submit a step
     (stage + side → safe | unsafe, next multiplier, canCashOut, balance), cash out.
   - Server enforces: session belongs to the caller, one active session per player, expiry,
     stage must be the current stage, idempotency keys (a retried step returns the original
     result, never a re-roll), stake within configured limits.
   - The existing animations already tolerate a round trip — `handlePick` awaits
     `scene.resolveSafe()` / `scene.breakPanel()` and the pane stays `selected`. Add 100–200 ms
     of cover if latency demands; never reveal the result before the response.
   - Demo mode stays free and local, but uses the same client shape so the UI does not fork.

3. WALLET
   - Stake input driven by the configured min/max, in FC.
   - Debit on session create, credit on victory or cash-out, live balance in the HUD.
   - Cash-out control in the HUD when allowed, showing the ladder from the engine.
   - Insufficient-balance and session-expired states.
   - The client must never be the thing that credits a player.

4. RTP / HOUSE EDGE — CONNECT, DON'T BUILD
   Map these needs onto the existing Fizz endpoints (these are requirements, not new APIs):
   - The game registered in the existing game/math config: stage count and range, base
     safe-pane probability, multiplier or edge model, bet limits, max win, currency,
     jurisdictions, enabled/maintenance flags.
   - A server-side profile read at session open, returning the effective config plus a
     `configVersion` stamped on the round record (cache it briefly; never read it client-side).
   - Either a per-stage weighted decision from the engine, or a static probability + ladder the
     game applies locally — whichever the engine already supports.
   - The payout multiplier per cleared stage, including the max-win cap.
   - Round results written into the existing telemetry, so the dashboard's live RTP, turnover
     and GGR reporting covers Shatterpoint with no separate reporting path.
   Confirm with the Fizz backend owner, before coding: the config endpoint and auth, whether
   the engine returns per-stage decisions or a static profile, which side the edge sits on,
   how promo/segment overrides resolve, and the p95 latency of the decision call.

5. FAIRNESS AND SECURITY
   - Outcomes committed before the pick; commit–reveal with a verifiable seed is preferred.
   - Atomic, idempotent money movement; rate-limit steps; sessions bound to the player.
   - Immutable round log: player, config version, stake, seed, arrangement, decisions, payout.
   - Respect the casino's existing responsible-gaming and jurisdiction services; do not build
     parallel ones.

## DEFINITION OF DONE

The game opens from a lobby tile inside the casino shell; a staked run debits once, each step is
decided server-side, a win or cash-out credits once; Shatterpoint appears in Fizz's existing RTP
reporting and settles to the RTP configured for it in the admin dashboard; no network response
before a step reveals that stage's outcome; and the art, timings and feel are untouched.