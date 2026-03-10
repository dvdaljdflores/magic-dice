/**
 * SessionManager — Session Lifecycle Operations
 *
 * PURPOSE:
 *   Provides functions for creating, joining, and leaving sessions.
 *   Acts as the "server" in local simulation mode using:
 *     • localStorage  — shared session state between browser tabs
 *     • BroadcastChannel — real-time messages between tabs
 *
 * ARCHITECTURE (LOCAL SIMULATION):
 *   There is no real server. Instead:
 *   - The host's tab writes the session to localStorage
 *   - Other tabs read it and write back their join requests
 *   - BroadcastChannel delivers notifications instantly between tabs
 *
 * FUTURE NETWORKING:
 *   When WebRTC is added, these functions will delegate to connectionManager.ts
 *   instead of localStorage/BroadcastChannel. The API stays the same.
 *
 * INTERACTIONS:
 *   - LobbyScreen calls createSession, joinAsPlayer, joinAsSpectator
 *   - WaitingRoom calls startSession
 *   - DiceTableScreen calls addRollToSession, leaveSession
 *   - sessionStore is updated after each operation
 *   - appModeStore is updated to navigate screens
 */

import type {
  Session, Player, Spectator, SessionDiceRoll, SessionMessage,
} from './sessionTypes';
import {
  MAX_PLAYERS, MAX_SPECTATORS,
  BROADCAST_CHANNEL_NAME, STORAGE_KEY_PREFIX,
} from './sessionTypes';
import { useSessionStore } from './sessionStore';
import { useAppModeStore } from '../appState/appModeStore';

// ─── BroadcastChannel Singleton ───────────────────────────────────────────────

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!_channel) {
    _channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
  return _channel;
}

function broadcast(msg: SessionMessage) {
  try {
    getChannel().postMessage(msg);
  } catch {
    // Channel may be closed during tab unload — ignore
  }
}

// ─── localStorage Helpers ─────────────────────────────────────────────────────

function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + session.id, JSON.stringify(session));
}

function loadSession(id: string): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function deleteSession(id: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + id);
}

// ─── Short Session ID Generator ───────────────────────────────────────────────

function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I (ambiguous)
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Incoming Message Handler ─────────────────────────────────────────────────

/**
 * Called once when the app initialises.
 * Sets up the BroadcastChannel listener for the local tab.
 *
 * In solo mode the listener is a no-op (session is null).
 */
export function initSessionListener(): void {
  const channel = getChannel();

  channel.onmessage = (evt: MessageEvent<SessionMessage>) => {
    const msg = evt.data;
    const store = useSessionStore.getState();
    const appStore = useAppModeStore.getState();

    switch (msg.type) {

      // Another tab updated the session (someone joined/left/changed name)
      case 'SESSION_UPDATE': {
        if (store.session?.id === msg.session.id) {
          store.setSession(msg.session);
        }
        break;
      }

      // Host started the game
      case 'SESSION_STARTED': {
        if (store.session) {
          store.updateSession(s => ({ ...s, state: 'active' }));
          appStore.setMode('table');
        }
        break;
      }

      // Host disconnected — session is over
      case 'SESSION_CLOSED': {
        if (store.session) {
          store.clearSession();
          appStore.setMode('lobby');
          // Small alert so players know what happened
          if (typeof window !== 'undefined') {
            // Use a brief timeout so React renders first
            setTimeout(() => alert('El host se desconectó. La sesión ha terminado.'), 100);
          }
        }
        break;
      }

      // Someone rolled — add to local session history
      case 'ROLL_ADDED': {
        if (store.session) {
          store.addRoll(msg.roll);
        }
        break;
      }
    }
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new session. The calling client becomes the host.
 * Returns an error string on failure, or null on success.
 */
export function createSession(hostName: string): string | null {
  const store = useSessionStore.getState();
  const { clientId } = store;

  const host: Player = {
    id:   clientId,
    name: hostName.trim() || 'Host',
    role: 'host',
  };

  const session: Session = {
    id:         generateSessionId(),
    hostId:     clientId,
    players:    [host],
    spectators: [],
    history:    [],
    state:      'lobby',
  };

  saveSession(session);

  // Attach host-disconnect cleanup
  attachHostUnloadHandler(session.id);

  store.setSession(session);
  store.setLocalRole('host');
  store.setCanRoll(true);

  return null; // null = no error
}

/**
 * Join an existing session as a Player (can roll dice).
 * Returns an error string on failure, or null on success.
 */
export function joinAsPlayer(playerName: string, sessionId: string): string | null {
  const store  = useSessionStore.getState();
  const { clientId } = store;

  const session = loadSession(sessionId.trim().toUpperCase());
  if (!session) return 'Sesión no encontrada. Verifica el código.';
  if (session.state === 'active') return 'La sesión ya comenzó.';

  // Check if this client is already in the session
  const alreadyPlayer = session.players.some(p => p.id === clientId);
  if (alreadyPlayer) return 'Ya estás en esta sesión como jugador.';

  if (session.players.length >= MAX_PLAYERS) {
    return `Máximo de jugadores alcanzado (${MAX_PLAYERS}).`;
  }

  const player: Player = {
    id:   clientId,
    name: playerName.trim() || 'Jugador',
    role: 'player',
  };

  const updated: Session = {
    ...session,
    players: [...session.players, player],
  };

  saveSession(updated);
  broadcast({ type: 'SESSION_UPDATE', session: updated });

  store.setSession(updated);
  store.setLocalRole('player');
  store.setCanRoll(true);

  return null;
}

/**
 * Join an existing session as a Spectator (watch only, cannot roll).
 * Returns an error string on failure, or null on success.
 */
export function joinAsSpectator(spectatorName: string, sessionId: string): string | null {
  const store = useSessionStore.getState();
  const { clientId } = store;

  const session = loadSession(sessionId.trim().toUpperCase());
  if (!session) return 'Sesión no encontrada. Verifica el código.';
  if (session.state === 'active') return 'La sesión ya comenzó.';

  const alreadySpectator = session.spectators.some(s => s.id === clientId);
  if (alreadySpectator) return 'Ya estás en esta sesión como espectador.';

  if (session.spectators.length >= MAX_SPECTATORS) {
    return `Máximo de espectadores alcanzado (${MAX_SPECTATORS}).`;
  }

  const spectator: Spectator = {
    id:   clientId,
    name: spectatorName.trim() || 'Espectador',
  };

  const updated: Session = {
    ...session,
    spectators: [...session.spectators, spectator],
  };

  saveSession(updated);
  broadcast({ type: 'SESSION_UPDATE', session: updated });

  store.setSession(updated);
  store.setLocalRole('spectator');
  store.setCanRoll(false); // Spectators cannot roll

  return null;
}

/**
 * Host only: mark the session as active and notify all participants to start.
 */
export function startSession(): void {
  const store = useSessionStore.getState();
  const appStore = useAppModeStore.getState();
  if (!store.session) return;

  const updated: Session = { ...store.session, state: 'active' };
  saveSession(updated);

  store.setSession(updated);
  appStore.setMode('table');

  broadcast({ type: 'SESSION_STARTED' });
}

/**
 * Leave the current session.
 * If the leaver is the host, the session is destroyed for everyone.
 */
export function leaveSession(): void {
  const store    = useSessionStore.getState();
  const appStore = useAppModeStore.getState();
  const { session, clientId } = store;

  if (!session) {
    // Solo mode — just go back to lobby
    appStore.setMode('lobby');
    return;
  }

  if (session.hostId === clientId) {
    // Host left → destroy the session entirely
    deleteSession(session.id);
    broadcast({ type: 'SESSION_CLOSED' });
  } else {
    // Non-host left → update session and notify others
    const updated: Session = {
      ...session,
      players:    session.players.filter(p => p.id !== clientId),
      spectators: session.spectators.filter(s => s.id !== clientId),
    };
    saveSession(updated);
    broadcast({ type: 'SESSION_UPDATE', session: updated });
  }

  store.clearSession();
  appStore.setMode('lobby');
}

/**
 * Record a dice roll in the session and broadcast it to all participants.
 * Called from DiceTableScreen whenever a new roll appears in diceStore.
 */
export function addRollToSession(
  playerId: string,
  playerName: string,
  dice: number[],
): void {
  const store = useSessionStore.getState();
  if (!store.session) return;

  const roll: SessionDiceRoll = {
    id:         `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    playerId,
    playerName,
    result:     dice.reduce((a, b) => a + b, 0),
    dice,
    timestamp:  Date.now(),
  };

  // Update local store
  store.addRoll(roll);

  // Merge with what's already in localStorage to avoid overwriting concurrent rolls
  // from other players (their rolls arrive via BroadcastChannel into the store,
  // but the localStorage copy might lag behind if both players roll simultaneously).
  const existing = loadSession(store.session.id);
  const baseHistory = existing?.history ?? [];
  if (!baseHistory.some(r => r.id === roll.id)) {
    baseHistory.push(roll);
  }
  const updated: Session = {
    ...(existing ?? store.session),
    history: baseHistory,
  };
  saveSession(updated);

  // Notify other tabs in real-time
  broadcast({ type: 'ROLL_ADDED', roll });
}

// ─── Host Unload Handler ──────────────────────────────────────────────────────

/**
 * Registers a beforeunload listener on the host's tab.
 * When the host closes/refreshes the tab, the session is cleaned up.
 */
function attachHostUnloadHandler(sessionId: string): void {
  const handler = () => {
    deleteSession(sessionId);
    broadcast({ type: 'SESSION_CLOSED' });
  };

  window.addEventListener('beforeunload', handler);

  // Also clean up if the listener itself is registered again (tab reuse edge case)
  return;
}