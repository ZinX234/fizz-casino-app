import { useSyncExternalStore } from 'react';
import { GAME_CONFIG } from './config';

/**
 * Fizz Rush — placeholder wallet
 * ---------------------------------------------------------------------------
 * The balance system is intentionally isolated behind a tiny adapter so it can
 * be replaced by a real balance service later without touching gameplay code.
 *
 * Rules baked in (per spec):
 *   - New players start with 0 Fizz Coins.
 *   - No daily rewards, login rewards, free-coin, purchase, deposit or
 *     withdrawal systems exist anywhere in this project.
 *   - Demo Mode never credits the wallet; only Real Mode payouts can.
 *
 * Integrity guarantees:
 *   - Only finite, non-negative integers are ever stored.
 *   - Every write is clamped and validated before it is committed.
 *   - Corrupt or tampered data is discarded and falls back to the start value.
 */

const CFG = GAME_CONFIG.economy;
const MAX = CFG.wallet.maxBalance;

/** ---------------------------------------------------------------- adapters */

const localAdapter = {
  id: 'local',
  read() {
    try {
      const raw = window.localStorage.getItem(CFG.wallet.key);
      if (raw == null) return CFG.startingBalance;
      const parsed = JSON.parse(raw);
      const value = typeof parsed === 'object' && parsed !== null ? parsed.balance : parsed;
      return sanitise(value, CFG.startingBalance);
    } catch {
      return CFG.startingBalance;
    }
  },
  write(balance) {
    try {
      window.localStorage.setItem(
        CFG.wallet.key,
        JSON.stringify({ balance, v: GAME_CONFIG.meta.saveVersion, updated: Date.now() })
      );
      return true;
    } catch {
      return false;
    }
  },
};

const ADAPTERS = { local: localAdapter };

/** Clamp anything that arrives from storage or code into a safe integer. */
export function sanitise(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(MAX, Math.floor(n)));
}

const listeners = new Set();
let adapter = ADAPTERS[CFG.wallet.adapter] || localAdapter;
let current = sanitise(adapter.read(), CFG.startingBalance);

function emit() {
  listeners.forEach((fn) => fn());
}

function commit(next) {
  const safe = sanitise(next, current);
  if (safe === current) return current;
  current = safe;
  adapter.write(safe);
  emit();
  return current;
}

/** -------------------------------------------------------------- public API */

export const wallet = {
  /** Name shown in the UI ("Fizz Coins"). */
  get currencyName() {
    return CFG.currencyName;
  },
  get symbol() {
    return CFG.currencySymbol;
  },
  balance() {
    return current;
  },
  /** Add winnings. Returns the new balance. */
  credit(amount) {
    const value = Math.floor(Number(amount) || 0);
    if (value <= 0) return current;
    return commit(current + value);
  },
  /**
   * Place a wager. Refuses (returns false) when the balance is short, so a bet
   * can never push the wallet negative.
   */
  debit(amount) {
    const value = Math.floor(Number(amount) || 0);
    if (!Number.isFinite(value) || value < 0) return false;
    if (value > current) return false;
    if (value === 0) return true;
    commit(current - value);
    return true;
  },
  canAfford(amount) {
    return sanitise(amount, 0) <= current;
  },
  /** Replace the balance (used by tests / admin tooling). */
  set(amount) {
    return commit(amount);
  },
  /** Swap in a different balance backend at runtime. */
  useAdapter(nextAdapter) {
    if (!nextAdapter || typeof nextAdapter.read !== 'function') return;
    adapter = nextAdapter;
    current = sanitise(adapter.read(), CFG.startingBalance);
    emit();
  },
  reset() {
    return commit(CFG.startingBalance);
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** React binding used by the header badge and every balance readout. */
export function useWalletBalance() {
  return useSyncExternalStore(wallet.subscribe, wallet.balance, wallet.balance);
}

export default wallet;