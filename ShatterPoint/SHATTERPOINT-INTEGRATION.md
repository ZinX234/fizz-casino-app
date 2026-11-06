# FIZZ: SHATTERPOINT — Integration Brief

**Audience:** the engineering agent integrating this game into the Fizz Casino website.
**Status of this build:** a complete, standalone, playable game. No authentication, no wallet, no
database, no server calls, and **no RTP or house-edge logic of any kind**. Everything below
describes exactly what exists today and what has to be built around it.

---

## 0. TL;DR

- The game is a finished front end (React 19 + TanStack Start + Three.js r171 + Tailwind).
- A round = 12 glass-pane decisions (configurable 3–24). Each stage has two panes; exactly one
  holds. One wrong pane ends the run. Survive every stage to win.
- **Today the outcome is decided in the browser** by a plain 50/50 coin flip
  (`Math.random() < 0.5` in `src/game/engine.js → stableSide()`). There is no weighting, no RTP,
  no edge. For real money this must move to the server.
- There is **no stake input and no cash-out** yet. A "real" run currently only asks the host
  whether the player has any balance, then plays.
- RTP, house edge, multipliers and limits are **not** defined in this build. The real Fizz Casino
  site already runs its RTP / house-edge system behind its admin dashboard; this game registers
  into it and reads every number from it. The client must never receive the arrangement before the
  player commits.
- Three deliverables are expected: **(1)** the game mounted on the casino floor, **(2)** a
  server-authoritative session + wallet integration, **(3)** the game registered in Fizz's existing
  RTP / house-edge system, so the admin dashboard already in place controls its math.

---

## 1. What this build is

A cinematic glass-bridge survival game, styled for Fizz Casino: near-black void, neon-lime
`#b6ff3c` and hot-pink `#ff2e9a` accents, glassmorphism panels, Chakra Petch / Outfit typography.

Player experience:

1. Main menu → **Demo Mode** (free, unlimited) or **Real Play** (gated on balance).
2. A 3D bridge builds itself out of glass panes over a deep void.
3. Each stage: hover a pane, tap it (or press `A` / `D` / arrow keys).
4. Safe pane → the character walks on, the pane flashes green, the next stage unlocks.
5. Unstable pane → cracks spread, glass shatters, the character falls, the run ends.
6. Clear all stages → the character reaches the far gate, victory sequence, results screen.

Runs are timed, results are summarised (stages cleared, duration, best-ever), and personal stats
persist locally.

---

## 2. Current behaviour — the source of truth

### 2.1 Round model (`src/game/engine.js`)

```js
createSession({ mode, stages }) // → session object
```

```js
{
  id: "sp_<base36 timestamp>",
  mode: "demo" | "real",
  stages: 12,                       // clamped 3..24
  arrangement: ["left","right",…],  // one entry per stage — THE ANSWER KEY
  stage: 0,                         // index of the current stage
  status: "playing" | "victory" | "failed",
  locked: true,                     // true while the scene is animating
  startedAt: 1762345678901          // Date.now()
}
```

- `arrangement` is generated **once, up front, in the browser** and never re-rolled, so an outcome
  cannot change after the player commits.
- `stableSide()` → `Math.random() < 0.5 ? "left" : "right"`.
  **No RTP. No house edge. No weighting. Fair coin.**
- `isSafePanel(session, stage, side)` compares the pick to `arrangement[stage]`.
- `completedStages()`, `sessionSummary()`, `mergeStats()`, `formatDuration()` are pure helpers.
- On a safe pick: `stage += 1`; when `stage >= stages` → `status = "victory"`.
- On an unstable pick: `status = "failed"` immediately. There is **no cash-out** and no partial
  payout path anywhere.

### 2.2 Modes

| | Demo | Real Play |
|---|---|---|
| Cost | none | none charged today (placeholder) |
| Gate | dev toggle only | `getBalance().available > 0` **and** `beginRealPlay()` not returning `allowed:false` |
| End of run | stats only | also calls `completeRealPlay(summary)` |
| Default | available | **locked** (no host ⇒ balance 0) |

### 2.3 Timing (all durations scale with motion settings)

- Run start: camera sweep `1250 ms`, then panes become interactive.
- Safe pick: walk `540 ms` + settle `320 ms`.
- Unsafe pick: walk `420 ms` + crack `460 ms` + shatter + drop `1500 ms` + `220 ms`.
- Victory: walk to gate `1150 ms` + celebration `1900 ms` + `520 ms` before the results screen.

### 2.4 Persistence (browser localStorage only — no server)

| Key | Contents |
|---|---|
| `fizz.shatterpoint.settings.v1` | volume, mute, graphics, animation, camera shake, reduced motion, skip intro |
| `fizz.shatterpoint.stats.v1` | `{ best, runs, wins, totalStages }` |
| `fizz.shatterpoint.intro.v1` | `{ seen }` |
| `fizz.shatterpoint.dev.v1` | stages, theme, animation quality, camera speed, demo enabled |

None of this is authoritative and none of it should be trusted for money.

### 2.5 Presentation

- Renderer: WebGL, ACES filmic tone mapping, PMREM environment reflections on the glass, capped
  pixel ratio (2 / 1.5 / 1 by graphics setting), `ResizeObserver`-driven.
- Themes: `neon` (lime/pink), `ember` (orange/pink), `frost` (cyan/violet).
- Audio: 100% synthesised with the Web Audio API (no assets), unlocked on first gesture, with an
  evolving ambient bed and per-event cues (`select`, `safe`, `crack`, `shatter`, `fall`,
  `victory`, `defeat`, `step`, `whoosh`, `ui`, `hover`).
- Keyboard: `A`/`←` left, `D`/`→` right, `Esc` pause.
- No login screen, no account, no profile — by design. The casino supplies identity.

---

## 3. Codebase map

| Path | Role |
|---|---|
| `src/routes/index.jsx` | The only route. Sets `<title>`/meta and renders the game. |
| `src/components/game/ShatterpointGame.jsx` | **The orchestrator.** Owns session state, screen state, wallet check, audio calls, keyboard, and every dialog. |
| `src/components/game/GameCanvas.jsx` | Mounts/disposes the WebGL scene, forwards settings + pick/hover/step callbacks. |
| `src/components/game/MainMenu.jsx` | Menu shell: mode cards, stats, settings/how-to buttons. |
| `src/components/game/ModeCard.jsx` | Mode card + coin/sparkle primitives. |
| `src/components/game/GameHUD.jsx` | In-run HUD: stage progress, timer, left/right buttons, sound/pause. |
| `src/components/game/PauseOverlay.jsx` | Pause menu. |
| `src/components/game/ResultsScreen.jsx` | Win/loss report + restart / menu. |
| `src/components/game/{Settings,HowToPlay,RealPlay}Dialog.jsx` | Dialogs. |
| `src/components/game/IntroOverlay.jsx` | First-run cinematic title card. |
| `src/game/engine.js` | **Outcome logic. The one place RNG lives.** |
| `src/game/fizzBridge.js` | **The host seam** (`window.FizzShatterpoint`). |
| `src/game/settings.js` | Defaults, themes, localStorage helpers, `clampStages`. |
| `src/game/audio.js` | Web Audio engine. |
| `src/game/scene/ShatterScene.js` | Scene lifecycle, camera rig, raycasting, animation sequences. |
| `src/game/scene/bridge.js` | Panel geometry, states (`untouched/hover/selected/safe/completed/unstable`), cracks, shard physics, victory burst. |
| `src/game/scene/character.js` | Low-poly character: walk, fall, celebrate. |
| `src/game/scene/environment.js` | Void, towers, gate, particles, lights. |

**The scene's public API** (all the orchestrator uses): `init()`, `startRun({stages})`,
`resolveSafe(stage, side)`, `breakPanel(stage, side, {onCrack, onShatter})`, `playVictory()`,
`enableStage(n)`, `enterMenu(stages)`, `setTheme(name)`, `setSettings(partial)`,
`setInteractive(bool)`, `dispose()`.

---

## 4. The host seam that exists today (`src/game/fizzBridge.js`)

The game looks for a global on the parent/owning page:

```js
window.FizzShatterpoint = {
  getBalance:        async () => ({ available: 1250, currency: "FC" }),
  beginRealPlay:     async ({ mode, id }) => ({ allowed: true }),
  completeRealPlay:  async (summary) => ({ ok: true }),
};
```

Behaviour:

- **No host present** ⇒ `getBalance()` returns `{ available: 0, currency: "FC", connected: false }`
  and Real Play stays locked. This is the current state.
- `beginRealPlay` is called before a real run starts; only `allowed === false` blocks it.
- `completeRealPlay(summary)` is fire-and-forget after a real run ends. Its result is ignored and
  **it moves no money**.
- `summary` = `{ mode, status, stages, stagesCompleted, durationMs, reachedStage }`.
- Balance is re-read on boot and whenever the player returns to the menu.

This is a nice escape hatch for a soft launch, but **it is not a payment integration**: the amount,
the outcome and the payout are all decided client-side. Treat it as a UI placeholder to replace.

---

## 5. What has to change

### 5.1 Casino floor presence

1. Register Shatterpoint as a game in the casino's lobby catalogue: slug `shatterpoint`, title
   `FIZZ: Shatterpoint`, category (e.g. Originals / Crash), thumbnail, minimum/maximum stake,
   launch URL, tags, ordering, enabled flag, jurisdiction allow-list.
2. Open it at a dedicated route (e.g. `/games/shatterpoint`) inside the casino shell — header,
   balance chip, and cashier stay visible. Do **not** open it in a new tab.
3. **Embed mode.** Today the game is hard-wired full-viewport: `h-[100svh]` on the root div in
   `ShatterpointGame.jsx`, and the menu duplicates Fizz logo/branding that the casino shell
   already shows. Add an `embedded` prop that:
   - fills its container (`h-full`, container-owned height) instead of `100svh`;
   - hides the in-game Fizz wordmark and the "build" footer;
   - keeps the in-game sound/settings/pause controls (they control the game, not the site).
4. Deep-link friendly: `/games/shatterpoint?mode=demo|real`. Default `real` when signed in with a
   balance, otherwise `demo`.
5. Analytics: fire `shatterpoint_launch`, `shatterpoint_run_start`, `shatterpoint_stage_clear`,
   `shatterpoint_run_end` (status, stages cleared, duration, stake, payout) into the casino's
   existing event pipeline. Keep the existing `base44` analytics pattern or swap for the casino's.
6. Floor tile click → launch. "Recently played" and favourites should follow the casino's existing
   lobby rules; the game needs no special handling beyond a stable slug.

### 5.2 Server-authoritative session + wallet

**Delete the client's authority.** Concretely:

- Move outcome generation out of `src/game/engine.js`. The client must call the server for each
  decision and be told only `safe | unsafe` **after** the pick is accepted.
- The `arrangement` array must never appear in any network response, page payload, or JS bundle
  the player can read. Today `session.arrangement` holds the entire answer key in memory.
- One server round per run, one step per stage:

```http
POST /api/casino/shatterpoint/sessions
{ stake: 500, currency: "FC", mode: "real", idempotencyKey: "<uuid>" }
→ 201 { sessionId, stages: 12, stake, paytable: [{stage:1,multiplier:1.92}, …], stakeTxId, configVersion: 7 }
```

```http
POST /api/casino/shatterpoint/sessions/{id}/steps
{ stage: 0, side: "left", idempotencyKey: "<uuid>" }
→ 200 { result: "safe",     nextStage: 1, multiplier: 1.92, canCashOut: true, balance }
→ 200 { result: "unsafe",   payout: 0,       balance, roundId }
```

```http
POST /api/casino/shatterpoint/sessions/{id}/cashout
{ idempotencyKey: "<uuid>" }
→ 200 { payout, multiplier, balance, roundId }
```

- `stake` is debited **on session creation** (atomic, integer minor units). Payout is credited on
  victory or cash-out only. A failed stage pays nothing.
- Rules the server enforces: session belongs to the caller; one active session per player; session
  expires (suggest 30 min idle, plus a hard cap); stage must be the current stage; a repeated
  `stage` with the same idempotency key returns the original result instead of re-rolling; stake
  within `[min, max]` from the game config; sufficient available balance after bonuses/locks.
- Demo mode keeps working entirely client-side (it is free and cannot pay out) — but it must use
  the **same** code path shape so the UI does not fork.
- The renderer stays exactly as it is; only the answers come from the server. The animation
  sequence already tolerates a network round trip, because `handlePick` awaits
  `scene.resolveSafe()` / `scene.breakPanel()` and the pane stays `selected` until resolved. Add a
  short pre-roll (100–200 ms) if latency is high — do not reveal the result before the response.

### 5.3 RTP & house edge — plug into the existing Fizz system

This game ships **no math model, no RTP, no edge, no paytable**, and must not grow one. Fizz Casino
already owns an RTP / house-edge system behind its admin dashboard. Shatterpoint registers as a
game in that system and takes every number from it.

The game needs exactly six things from it. The names below are placeholders for **the existing
Fizz endpoints** — map each to the real service; do not build a parallel one:

1. **A game registration + math profile** for `shatterpoint`: stage count and its range, base
   safe-pane probability, multiplier curve or edge model, bet limits, max win, currency,
   jurisdiction availability, enabled / maintenance flags.
2. **A server-side profile read at session open**, returning the effective config and its
   `configVersion`. Cache it briefly; never read it in the browser.
3. **The per-stage decision** — the weighted `left | right` outcome from the engine — or, if the
   engine models edge only through payout, the game keeps `p = 0.5` and applies the engine's ladder.
4. **The payout multiplier per cleared stage**, including the max-win cap.
5. **A round-result write-back** into the existing telemetry, so the dashboard's live RTP / turnover
   / GGR reporting already covers Shatterpoint with no separate reporting path.
6. **The `configVersion` stamped on every round record**, so historical payouts stay reproducible
   after a profile change.

Do not: hardcode multipliers, compute RTP inside the game, add a parallel admin screen, add a second
math model, or build a simulation harness — the Fizz engine already owns the model and validates it.

**Settle these with the Fizz math/backend owner before writing code:**

- Endpoint + auth for reading a game's math profile; can it take a player segment?
- Does the engine return a **per-stage decision**, or a **static profile** (probability + ladder) the
  game applies locally? That decides whether each step is a call to the math service.
- Which side does the edge live on — pane weighting, payout trim, or both?
- How are promo / segment RTP overrides scoped and resolved (player, window, jurisdiction)?
- What is the p95 latency of the decision call? The pane animation needs ~100–200 ms of cover.

---

## 6. The math surface this game declares to Fizz

Structural facts the engine needs in order to price the game — facts only, no formulas and no
recommendation:

- **Per stage:** two panes, mutually exclusive, independent of earlier stages, exactly one safe.
  The probability `p` is uniform across stages and comes from Fizz.
- **Run length:** `N` stages, Fizz-configured (this build clamps 3–24, floor default 12).
- **Failure:** one unsafe pane ends the run immediately, payout 0, no partial credit.
- **Composition:** purely sequential independent trials. Decisions carry no skill and no readable
  pattern, so the chance of clearing `k` stages is `p^k` with no player influence.
- **Settlement:** today a run ends only by clearing all `N` stages. If Fizz wants cash-out
  (recommended for variance), the ladder and stop points come from the engine; the game already
  tracks the cleared stage count needed to drive it.
- **Nothing else is staked:** no side bets, no multiplier modifiers, no free spins.

---

## 7. Non-negotiables (fairness, security, compliance)

- Outcomes decided server-side, per stage, committed before the pick. Recommended:
  commit-reveal — publish `SHA256(serverSeed)` at session start, reveal `serverSeed` at round end so
  the player can verify `HMAC(serverSeed, sessionId:stage) → left|right`.
- Never ship the arrangement, the seed, or the RTP weighting to the client before the round ends.
- Every money movement is an atomic, idempotent wallet transaction in integer minor units; retries
  must never double-debit or double-credit.
- The client's `completeRealPlay` callback must never be the thing that pays a player.
- Rate-limit steps (suggest ≤ 1 per second per session, hard cap per round).
- Session bound to the authenticated player; reject foreign session ids.
- Keep the game's current `dispose()` path intact — a floor tile that is entered and left repeatedly
  must not leak WebGL contexts.
- Respect the casino's existing responsible-gaming services (limits, self-exclusion, cool-off) and
  jurisdiction blocking — do not build parallel implementations.
- Log every round immutably: player, config version, stake, seed, arrangement, decisions, payout,
  timestamps, device. This is the audit trail regulators ask for.

---

## 8. Migration checklist

**Phase 1 — Floor presence (no money)**
- [ ] `embedded` prop: container height instead of `100svh`, hide duplicated branding.
- [ ] Route `/games/shatterpoint` inside the casino shell, deep link `?mode=`.
- [ ] Lobby tile + catalogue entry + launch analytics.
- [ ] Confirm WebGL context hygiene across repeated enter/exit.

**Phase 2 — Server rounds**
- [ ] Read the game's math profile from the existing Fizz config (public subset: stage count,
      paytable, limits, theme).
- [ ] `POST /sessions`, `POST /sessions/{id}/steps`, `POST /sessions/{id}/cashout`.
- [ ] Replace `stableSide()` / `arrangement` with the server response; strip `arrangement` from the
      client session object entirely.
- [ ] Demo mode re-pointed at the same client shape (local, free).

**Phase 3 — Wallet**
- [ ] Stake input on the menu (min/max from config, formatted in FC).
- [ ] Debit on session create; credit on victory / cash-out; show live balance in HUD.
- [ ] Cash-out button in the HUD (only when `canCashOut`), with the multiplier ladder shown.
- [ ] Insufficient-balance and session-expired UX.

**Phase 4 — Fizz RTP wiring**
- [ ] Register `shatterpoint` + its math profile in the existing Fizz config.
- [ ] Read the profile server-side at session open; stamp `configVersion` on the round.
- [ ] Consume pane weighting and multipliers from the engine — no local maths anywhere.
- [ ] Write round results into the existing telemetry.
- [ ] Honour the profile's bet limits, jurisdictions, kill switch and maintenance flag.

**Phase 5 — Acceptance**
- [ ] Shatterpoint appears in Fizz's existing RTP report and converges to its configured RTP
      there. Validation belongs to the platform, not to a harness added to this repo.
- [ ] No response before a step contains the stage outcome or the arrangement.
- [ ] Idempotency, double-click, refresh mid-round and dropped-connection tests.
- [ ] Max-win / liability path exercised against the profile.

---

## 9. Do not change

- The scene, animation timings, art direction, themes, audio design, and the `safe | unstable` pane
  language — the experience is finished and approved.
- The stage rule (exactly one safe pane per stage, one mistake ends the run).
- The fair 50/50 pane logic as the game's base structure. All edge, multipliers and limits come
  from Fizz's existing RTP system at runtime — never from this codebase.
- Local preferences (volume, graphics, reduced motion) stay client-side and per-device.