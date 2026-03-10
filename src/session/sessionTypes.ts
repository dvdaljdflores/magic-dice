/**
 * SessionTypes — Data Models for the Session System
 *
 * PURPOSE:
 *   Defines all TypeScript types used across the session layer.
 *   These types are shared by sessionStore, sessionManager, and the screens.
 *
 * DESIGN:
 *   Session is temporary and in-memory (plus localStorage for cross-tab sync).
 *   No persistent storage — if the host disconnects everything is gone.
 *
 * INTERACTIONS:
 *   - sessionStore.ts uses these types for its state shape
 *   - sessionManager.ts uses these types in create/join/leave operations
 *   - Screen components (WaitingRoom, DiceTableScreen) consume these types
 */

// ─── Role ─────────────────────────────────────────────────────────────────────

/** The role of a connected participant */
export type PlayerRole = 'host' | 'player';

// ─── Participants ──────────────────────────────────────────────────────────────

/**
 * A player who can roll dice.
 * Includes both the host and the second player slot.
 */
export interface Player {
  id: string;      // Unique client ID (from sessionStorage)
  name: string;    // Display name chosen in the lobby
  role: PlayerRole;
}

/**
 * A spectator who can only watch and read history.
 * Cannot roll dice.
 */
export interface Spectator {
  id: string;    // Unique client ID
  name: string;  // Display name
}

// ─── Roll History ──────────────────────────────────────────────────────────────

/**
 * A single dice roll event recorded in the session history.
 * Created whenever a player rolls and pushed to all participants.
 */
export interface SessionDiceRoll {
  id: string;           // Unique roll ID
  playerId: string;     // ID of the player who rolled
  playerName: string;   // Display name of the player (for quick rendering)
  result: number;       // Sum of all dice
  dice: number[];       // Individual face values
  timestamp: number;    // Unix ms
}

// ─── Session ───────────────────────────────────────────────────────────────────

/** The lifecycle state of a session */
export type SessionState = 'lobby' | 'active';

/**
 * The full session object shared across all participants.
 * Stored in localStorage for cross-tab access in local simulation mode.
 */
export interface Session {
  id: string;                // Short alphanumeric code (e.g. "AQWZ")
  hostId: string;            // ID of the player who created the session
  players: Player[];         // Max 2 (host counts as a player)
  spectators: Spectator[];   // Max 3
  history: SessionDiceRoll[];
  state: SessionState;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const MAX_PLAYERS    = 2;
export const MAX_SPECTATORS = 3;

// ─── BroadcastChannel Message Types ───────────────────────────────────────────

/**
 * Messages sent over BroadcastChannel for cross-tab sync (local simulation).
 * In a future WebRTC implementation, these map to data-channel messages.
 */
export type SessionMessage =
  | { type: 'SESSION_UPDATE'; session: Session }
  | { type: 'SESSION_STARTED' }
  | { type: 'SESSION_CLOSED' }
  | { type: 'ROLL_ADDED'; roll: SessionDiceRoll };

export const BROADCAST_CHANNEL_NAME = 'mdc-session';
export const STORAGE_KEY_PREFIX     = 'mdc-session-';
export const CLIENT_ID_KEY          = 'mdc-client-id';