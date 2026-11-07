/**
 * Integration seam for the Fizz Casino host.
 *
 * This build is standalone on purpose: it never creates, stores or invents a
 * balance. When the game is embedded on fizzcasino.com, the host page can
 * expose `window.FizzShatterpoint` and the game will read the player's real
 * balance from it:
 *
 *   window.FizzShatterpoint = {
 *     getBalance: async () => ({ available: 1250, currency: "FC" }),
 *     beginRealPlay: async ({ mode }) => ({ allowed: true }),
 *     completeRealPlay: async (summary) => ({ ok: true }),
 *   };
 *
 * With no host present, `getBalance()` resolves to 0 and Real Play stays
 * locked — exactly what a brand new Fizz account looks like.
 */

const HOST = () => (typeof window !== "undefined" ? window.FizzShatterpoint : null);

export async function getBalance() {
  const host = HOST();
  if (!host || typeof host.getBalance !== "function") {
    return { available: 0, currency: "FC", connected: false };
  }
  try {
    const res = await host.getBalance();
    const available = Number(res?.available);
    return {
      available: Number.isFinite(available) && available > 0 ? Math.floor(available) : 0,
      currency: res?.currency || "FC",
      connected: true,
    };
  } catch {
    return { available: 0, currency: "FC", connected: false };
  }
}

export async function beginRealPlay(session) {
  const host = HOST();
  if (!host || typeof host.beginRealPlay !== "function") return { allowed: false };
  try {
    return await host.beginRealPlay({ mode: session?.mode || "real", id: session?.id });
  } catch {
    return { allowed: false };
  }
}

export async function completeRealPlay(summary) {
  const host = HOST();
  if (!host || typeof host.completeRealPlay !== "function") return;
  try {
    await host.completeRealPlay(summary);
  } catch {
    /* host-side wallet handling is the host's concern */
  }
}

/** Submit a single step for server-authoritative resolution.
 *  stage: current stage index (0-based)
 *  side: "left" | "right" the player picked
 *  returns: { ok, safe, nextStage, configVersion, seed, winnings, balance }
 */
export async function submitStep({ sessionId, stage, side, stake, configVersion, seed }) {
  const host = HOST();
  if (!host || typeof host.submitStep !== "function") {
    // Fallback: client-side determination (DEMO ONLY, not real play)
    if (configVersion !== "real") {
      const safe = Math.random() < 0.5;
      return { ok: true, safe, nextStage: stage + 1, configVersion: "demo", seed: null };
    }
    return { ok: false, safe: false, nextStage: stage, configVersion: "unknown", seed: null };
  }
  try {
    return await host.submitStep({ sessionId, stage, side, stake, configVersion, seed });
  } catch (e) {
    return { ok: false, safe: false, nextStage: stage, configVersion: "error", seed: null };
  }
}

/** Cash out of the current session.
 *  Returns: { ok, winnings, balance }
 */
export async function cashOut({ sessionId, configVersion, seed }) {
  const host = HOST();
  if (!host || typeof host.cashOut !== "function") return { ok: false, winnings: 0, balance: 0 };
  try {
    return await host.cashOut({ sessionId, configVersion, seed });
  } catch {
    return { ok: false, winnings: 0, balance: 0 };
  }
}