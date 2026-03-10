/**
 * SessionStore — Zustand Store for Session State
 *
 * PURPOSE:
 *   Holds the current session data and local client identity.
 *   All components that need to read session information subscribe here.
 *
 * RESPONSIBILITIES:
 *   - Store the active Session object (or null if not in a session)
 *   - Store the local client's ID and role
 *   - Expose actions to update session state from sessionManager
 *
 * INTERACTIONS:
 *   - sessionManager.ts writes to this store after operations
 *   - DiceTableScreen reads canRoll / role to gate the throw button
 *   - WaitingRoom reads players and spectators lists
 *   - RollHistoryPanel reads session.history
 */

import { create } from 'zustand';
import type { Session, Player, Spectator, SessionDiceRoll, PlayerRole } from './sessionTypes';
import { CLIENT_ID_KEY } from './sessionTypes';

// ─── Helper: get or create a persistent client ID ─────────────────────────────
// Uses sessionStorage so the ID persists for the browser tab lifetime
// but does NOT persist across browser restarts (fits the "no persistent storage" rule).

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder';
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    // Generate a random short ID
    id = Math.random().toString(36).slice(2, 10).toUpperCase();
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

// ─── Store Interface ───────────────────────────────────────────────────────────

interface SessionStoreState {
  /** The active session — null when in solo mode or not yet joined */
  session: Session | null;

  /**
   * The local client's unique ID.
   * Derived from sessionStorage; stable for the tab's lifetime.
   */
  clientId: string;

  /**
   * The local client's role in the current session.
   * null when not in a session (solo mode or lobby).
   */
  localRole: PlayerRole | 'spectator' | null;

  /**
   * Convenience: whether the local client is allowed to roll dice.
   * true in solo mode, true for host/player, false for spectator.
   */
  canRoll: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────────

  /** Called by sessionManager after creating or joining a session */
  setSession: (session: Session | null) => void;

  /** Update only the session fields without rebuilding the object */
  updateSession: (updater: (s: Session) => Session) => void;

  /** Add a roll to the session history */
  addRoll: (roll: SessionDiceRoll) => void;

  /** Set the local client role (host | player | spectator | null) */
  setLocalRole: (role: PlayerRole | 'spectator' | null) => void;

  /** Enable or disable rolling for the local client */
  setCanRoll: (v: boolean) => void;

  /** Clear everything — used when leaving a session or when host disconnects */
  clearSession: () => void;
}

// ─── Store Implementation ──────────────────────────────────────────────────────

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  session:    null,
  clientId:   getOrCreateClientId(),
  localRole:  null,
  canRoll:    true, // Default true; DiceTableScreen overrides for spectators

  setSession: (session) => set({ session }),

  updateSession: (updater) => {
    const { session } = get();
    if (!session) return;
    set({ session: updater(session) });
  },

  addRoll: (roll) => {
    const { session } = get();
    if (!session) return;
    set({
      session: {
        ...session,
        history: [...session.history, roll],
      },
    });
  },

  setLocalRole: (role) => set({ localRole: role }),

  setCanRoll: (v) => set({ canRoll: v }),

  clearSession: () => set({
    session:   null,
    localRole: null,
    canRoll:   true,
  }),
}));