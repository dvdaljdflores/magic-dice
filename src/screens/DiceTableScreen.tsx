/**
 * DiceTableScreen — The Main Dice Rolling Table
 *
 * PURPOSE:
 *   Wraps the existing WarhammerBoard 3D component with:
 *     - Session-aware roll permissions (canRoll)
 *     - Roll history sync (diceStore → sessionStore → RollHistoryPanel)
 *     - A leave/back button to return to the lobby
 *     - A role badge so every participant knows who they are
 *
 * RESPONSIBILITIES:
 *   - Render WarhammerBoard and pass canRoll based on role
 *   - Watch diceStore.history and sync new rolls to sessionStore
 *   - Show RollHistoryPanel with session-scoped history
 *   - Handle "Leave Table" to call leaveSession from sessionManager
 *
 * IMPORTANT — DO NOT MODIFY:
 *   This component intentionally does NOT touch dice physics, animation,
 *   Three.js rendering, or DiceEngine calculations. It is purely a wrapper.
 *
 * INTERACTIONS:
 *   - useSessionStore → reads session, localRole, canRoll, clientId
 *   - useDiceStore    → watches history to detect new rolls
 *   - sessionManager  → addRollToSession, leaveSession
 *   - WarhammerBoard  → rendered with canRoll prop
 *   - RollHistoryPanel → shown with session roll history
 */

'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';
import { useSessionStore } from '../session/sessionStore';
import { useDiceStore } from '../store/diceStore';
import { useAppModeStore } from '../appState/appModeStore';
import { addRollToSession, leaveSession } from '../session/sessionManager';
import { RollHistoryPanel } from '../components/history/RollHistoryPanel';
import { useMobileDetect } from '../hooks/useMobileDetect';
import type { SessionDiceRoll, Session } from '../session/sessionTypes';
import { STORAGE_KEY_PREFIX } from '../session/sessionTypes';

/**
 * WarhammerBoard is dynamically imported here (not statically) so that
 * Three.js, React Three Fiber, and @react-three/rapier are NOT loaded
 * when the Lobby or WaitingRoom is shown. These libraries have module-level
 * initialization that requires a proper Canvas context. This mirrors the
 * original dynamic(WarhammerBoard, { ssr: false }) pattern.
 */
const WarhammerBoard = dynamic(
  () => import('../components/WarhammerBoard'),
  { ssr: false, loading: () => null }
);

const F = "'Courier New', Courier, monospace";

// ─── Component ────────────────────────────────────────────────────────────────

export function DiceTableScreen() {
  const appMode   = useAppModeStore(s => s.mode);
  const isMobile  = useMobileDetect();

  // session and clientId are read inside useEffect via getState() to avoid
  // including them in the effect deps (which would cause update loops).
  // Here we only need the render-time values: canRoll, localRole, session (for badge).
  const { session, localRole, canRoll } = useSessionStore(
    useShallow(s => ({
      session:   s.session,
      localRole: s.localRole,
      canRoll:   s.canRoll,
    }))
  );

  // Track how many diceStore history entries we've already processed
  // so we can detect new ones without re-syncing old ones.
  const lastSyncedIndexRef = useRef<number>(0);

  // ── Sync new diceStore rolls → session history ─────────────────────────────
  // This runs whenever a new roll is appended to diceStore.history.
  // We only sync if we are in a real session (not solo mode).

  const diceHistory = useDiceStore(s => s.history);

  useEffect(() => {
    // Read session and clientId directly from the store inside the effect.
    // They are NOT in the dependency array so that syncing a roll (which
    // updates session.history) does NOT re-trigger this effect — that would
    // create a feedback loop causing "Maximum update depth exceeded".
    const { session: currentSession, clientId: currentClientId } =
      useSessionStore.getState();

    // Solo mode or no session: just keep the index current and exit.
    if (appMode !== 'table' || !currentSession) {
      lastSyncedIndexRef.current = diceHistory.length;
      return;
    }

    // Find the local player's display name from the session roster.
    const mePlayer = currentSession.players.find(p => p.id === currentClientId);
    const meName   = mePlayer?.name ?? 'Jugador';

    // Only process entries that arrived since the last sync pass.
    const newEntries = diceHistory.slice(lastSyncedIndexRef.current);
    for (const entry of newEntries) {
      // Skip meta-actions (del ≤N, lethal toggle, undo, sustained) — only sync real rolls.
      if (entry.actionLabel) continue;
      if (entry.values.length === 0) continue;

      addRollToSession(currentClientId, meName, entry.values);
    }

    lastSyncedIndexRef.current = diceHistory.length;
    // Intentionally only diceHistory and appMode in deps:
    // - diceHistory: the actual trigger (new roll arrived)
    // - appMode: needed to know if we're in a session
    // session / clientId are read via getState() to avoid feedback loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceHistory, appMode]);

  // ── Fallback: poll localStorage for missed rolls from other players ─────────
  // BroadcastChannel delivers rolls in real-time, but if any message is dropped
  // (race condition, timing, or browser quirk), this poll recovers missing rolls
  // within 1.5 s by comparing localStorage history against the local store.
  useEffect(() => {
    if (appMode !== 'table') return;

    const interval = setInterval(() => {
      const cur = useSessionStore.getState();
      if (!cur.session) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + cur.session.id);
        if (!raw) return;
        const fresh = JSON.parse(raw) as Session;
        const localIds = new Set(cur.session.history.map((r: SessionDiceRoll) => r.id));
        const missing = fresh.history.filter(r => !localIds.has(r.id));
        for (const roll of missing) {
          cur.addRoll(roll);
        }
      } catch { /* ignore parse errors */ }
    }, 1500);

    return () => clearInterval(interval);
  }, [appMode]);

  // ── Build session roll list for the history panel ──────────────────────────
  // In session mode: use sessionStore history
  // In solo mode: build a minimal SessionDiceRoll[] from diceStore history

  let displayRolls: SessionDiceRoll[];

  if (appMode === 'table' && session) {
    displayRolls = session.history;
  } else {
    // Solo mode — adapt diceStore entries to SessionDiceRoll shape
    displayRolls = diceHistory
      .filter(e => !e.actionLabel && e.values.length > 0)
      .map(e => ({
        id:         e.id,
        playerId:   'solo',
        playerName: 'Solo',
        result:     e.values.reduce((a, b) => a + b, 0),
        dice:       e.values,
        timestamp:  e.timestamp,
      }));
  }

  // ── Role badge text ────────────────────────────────────────────────────────
  const roleBadge =
    appMode === 'solo'           ? 'SOLO'
    : localRole === 'host'       ? 'HOST'
    : localRole === 'player'     ? 'JUGADOR'
    : localRole === 'spectator'  ? 'ESPECTADOR'
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>

      {/* ── 3D Dice Board (untouched) ── */}
      <WarhammerBoard canRoll={canRoll} />

      {/* ── Role badge (top-right on desktop, above history on mobile) ── */}
      {roleBadge && (
        <div style={{
          position:   'absolute',
          top:        isMobile ? 'auto' : 80,
          bottom:     isMobile ? 200 : 'auto',
          right:      isMobile ? 'auto' : 12,
          left:       isMobile ? 8 : 'auto',
          zIndex:     150,
          fontFamily: F,
          display:    'flex',
          alignItems: 'center',
          gap:        8,
        }}>
          <span style={{
            fontSize:      8,
            letterSpacing: 2,
            fontWeight:    700,
            color:         roleBadge === 'ESPECTADOR' ? '#9966cc'
                         : roleBadge === 'HOST'       ? '#00d4ff'
                         : roleBadge === 'JUGADOR'    ? '#44cc88'
                         : '#6080a0',
            background:    'rgba(6,10,22,0.85)',
            border:        '1px solid #1a3a5a',
            borderRadius:  3,
            padding:       '2px 6px',
          }}>
            {roleBadge}
          </span>

          {/* Session code badge (session mode only) */}
          {session && (
            <span style={{
              fontSize:      8,
              letterSpacing: 2,
              fontWeight:    700,
              color:         '#c9a84c',
              background:    'rgba(6,10,22,0.85)',
              border:        '1px solid #3a2a0a',
              borderRadius:  3,
              padding:       '2px 6px',
            }}>
              {session.id}
            </span>
          )}
        </div>
      )}

      {/* ── Spectator overlay: "view only" watermark ── */}
      {localRole === 'spectator' && (
        <div style={{
          position:       'absolute',
          bottom:         isMobile ? 170 : 20,
          left:           '50%',
          transform:      'translateX(-50%)',
          fontFamily:     F,
          fontSize:       9,
          letterSpacing:  3,
          color:          '#9966cc44',
          pointerEvents:  'none',
          userSelect:     'none',
          zIndex:         90,
        }}>
          MODO ESPECTADOR — Solo lectura
        </div>
      )}

      {/* ── Leave / Back button ── */}
      <button
        style={{
          position:      'absolute',
          // On mobile: bottom-left above result bar; on desktop: tucked in corner
          bottom:        isMobile ? 'auto' : 12,
          top:           isMobile ? 72 : 'auto',
          right:         isMobile ? 8 : 12,
          fontFamily:    F,
          fontSize:      9,
          letterSpacing: 1,
          fontWeight:    700,
          color:         '#6a3030',
          background:    'rgba(18,8,8,0.90)',
          border:        '1px solid #3a1010',
          borderRadius:  4,
          padding:       '4px 10px',
          cursor:        'pointer',
          zIndex:        150,
        }}
        onClick={leaveSession}
        title={appMode === 'solo' ? 'Volver al lobby' : 'Salir de la sesión'}
      >
        {appMode === 'solo' ? '← Lobby' : '← Salir'}
      </button>

      {/* ── Roll History Panel (bottom-right) ── */}
      <RollHistoryPanel rolls={displayRolls} isMobile={isMobile} />

    </div>
  );
}