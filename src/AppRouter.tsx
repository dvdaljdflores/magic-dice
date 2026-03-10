/**
 * AppRouter — Top-Level Screen Router
 *
 * PURPOSE:
 *   Reads the current app mode from appModeStore and renders the
 *   appropriate screen. This is the single routing point for the app.
 *
 * MODES → SCREENS:
 *   "lobby"   → LobbyScreen   (choose solo or session)
 *   "waiting" → WaitingRoom   (session lobby, pre-game)
 *   "solo"    → DiceTableScreen (full 3D board, canRoll=true from sessionStore)
 *   "table"   → DiceTableScreen (full 3D board, canRoll from sessionStore role)
 *
 * INITIALIZATION:
 *   On mount, sets up the BroadcastChannel session listener so cross-tab
 *   messages are handled throughout the application lifetime.
 *
 * INTERACTIONS:
 *   - useAppModeStore → reads mode to decide which screen to render
 *   - initSessionListener → wired once on mount
 *   - All screen components imported here
 *
 * NOTE:
 *   This component runs inside a `dynamic(..., { ssr: false })` wrapper
 *   in pages/index.tsx, so browser-only APIs (BroadcastChannel, localStorage,
 *   Three.js WebGL) are safe to use here without guards.
 */

'use client';

import { useEffect } from 'react';
import { useAppModeStore } from './appState/appModeStore';
import { initSessionListener } from './session/sessionManager';
import { LobbyScreen }     from './screens/LobbyScreen';
import { WaitingRoom }     from './screens/WaitingRoom';
import { DiceTableScreen } from './screens/DiceTableScreen';

// ─── Component ────────────────────────────────────────────────────────────────

export function AppRouter() {
  const mode = useAppModeStore(s => s.mode);

  // Initialise BroadcastChannel listener once for the lifetime of the app.
  // This allows cross-tab session messages (join, start, close, roll) to be
  // received by all participant tabs automatically.
  useEffect(() => {
    initSessionListener();
  }, []);

  // ── Screen Routing ─────────────────────────────────────────────────────────

  if (mode === 'lobby') {
    return <LobbyScreen />;
  }

  if (mode === 'waiting') {
    return <WaitingRoom />;
  }

  // Both "solo" and "table" render the full 3D dice table.
  // DiceTableScreen reads canRoll and session data from sessionStore internally.
  if (mode === 'solo' || mode === 'table') {
    return <DiceTableScreen />;
  }

  // Fallback — should never happen, but keeps TypeScript happy
  return <LobbyScreen />;
}