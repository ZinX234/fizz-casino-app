import { store } from './store';

/**
 * Fizz Rush — player identity
 * ---------------------------------------------------------------------------
 * Identity comes from the casino site that hosts the game; the app has no
 * login of its own. The host hands over the player it has already
 * authenticated by setting, before or while the game runs:
 *
 *   window.FizzRushAuth = { playerId: 'casino-1042', displayName: 'Ava' };
 *
 * With no host identity the player gets a persistent local guest id, so the
 * game is fully playable standalone.
 */

let injected = null;

/** Push the signed-in player in directly: setIdentity({ playerId, displayName }). */
export function setIdentity(next) {
  injected = next?.playerId ? { playerId: String(next.playerId), displayName: next.displayName } : null;
}

function fromHost() {
  if (injected?.playerId) return injected;
  if (typeof window === 'undefined') return null;
  const value = window.FizzRushAuth;
  if (value?.playerId) return { playerId: String(value.playerId), displayName: value.displayName };
  return null;
}

function guestId() {
  let id = store.get('guestId');
  if (!id) {
    id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    store.set('guestId', id);
  }
  return id;
}

/** Who is playing. Synchronous and side-effect free — safe to call often. */
export function getIdentity() {
  const host = fromHost();
  if (host) {
    return {
      player_id: `u_${host.playerId}`,
      display_name: String(host.displayName || 'Runner').slice(0, 24),
      isGuest: false,
    };
  }
  return {
    player_id: `g_${guestId()}`,
    display_name: store.get('displayName') || 'Guest Runner',
    isGuest: true,
  };
}

export default getIdentity;