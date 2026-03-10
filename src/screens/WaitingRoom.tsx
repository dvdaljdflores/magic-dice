/**
 * WaitingRoom — Session Lobby Before Game Start
 *
 * PURPOSE:
 *   Shown after a user creates or joins a session, while waiting for
 *   the host to press "Start Table". Displays:
 *     - The session code (so the host can share it)
 *     - Connected players and spectators
 *     - "Start Table" button (visible only to the host)
 *     - "Leave" button for all participants
 *
 * RESPONSIBILITIES:
 *   - Read session state from sessionStore
 *   - Poll localStorage for session updates (other tabs joining)
 *   - Subscribe to BroadcastChannel via the listener set up in sessionManager
 *   - Allow host to start the game
 *
 * INTERACTIONS:
 *   - Reads useSessionStore for session data
 *   - Calls startSession() from sessionManager when host starts
 *   - Calls leaveSession() when any participant clicks Leave
 *   - listens for external changes by polling localStorage
 */

'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionStore } from '../session/sessionStore';
import { startSession, leaveSession } from '../session/sessionManager';
import { STORAGE_KEY_PREFIX } from '../session/sessionTypes';

const F = "'Courier New', Courier, monospace";

// ─── Component ────────────────────────────────────────────────────────────────

export function WaitingRoom() {
  const { session, clientId, localRole } = useSessionStore(
    useShallow(s => ({
      session:   s.session,
      clientId:  s.clientId,
      localRole: s.localRole,
    }))
  );

  const isHost = localRole === 'host';

  // ── Poll localStorage for updates ──────────────────────────────────────────
  // BroadcastChannel handles messages between tabs, but to catch changes
  // that arrive before the listener is ready we also poll every 1.5s.

  useEffect(() => {
    if (!session) return;
    const id = session.id;

    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
        if (!raw) return;
        const fresh = JSON.parse(raw);

        const store = useSessionStore.getState();
        const cur   = store.session;
        if (!cur) return;

        // Update if player/spectator counts changed
        const sameP = fresh.players.length    === cur.players.length;
        const sameS = fresh.spectators.length === cur.spectators.length;
        if (!sameP || !sameS) {
          store.setSession(fresh);
        }
      } catch {
        // ignore parse errors
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [session?.id]);

  if (!session) return null;

  const canStart = isHost && session.players.length >= 1; // Host can start alone

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>

      <div style={s.bgGrid} aria-hidden />

      <div style={s.card}>

        {/* ── Header ── */}
        <div style={s.title}>SALA DE ESPERA</div>

        {/* Session code */}
        <div style={s.codeSection}>
          <span style={s.codeLabel}>CÓDIGO DE SESIÓN</span>
          <div style={s.code}>{session.id}</div>
          <span style={s.codeHint}>Comparte este código para que otros se unan</span>
        </div>

        <div style={s.divider} />

        {/* ── Players ── */}
        <div style={s.sectionLabel}>JUGADORES ({session.players.length}/2)</div>
        <div style={s.list}>
          {session.players.map(p => (
            <div key={p.id} style={s.listItem}>
              <span style={p.role === 'host' ? s.hostBadge : s.playerBadge}>
                {p.role === 'host' ? 'HOST' : 'JUGADOR'}
              </span>
              <span style={s.listName}>
                {p.name}
                {p.id === clientId && <span style={s.youTag}> (tú)</span>}
              </span>
            </div>
          ))}
          {session.players.length === 0 && (
            <div style={s.empty}>Sin jugadores</div>
          )}
        </div>

        {/* ── Spectators ── */}
        <div style={{ ...s.sectionLabel, marginTop: 12 }}>ESPECTADORES ({session.spectators.length}/3)</div>
        <div style={s.list}>
          {session.spectators.map(sp => (
            <div key={sp.id} style={s.listItem}>
              <span style={s.specBadge}>👁</span>
              <span style={s.listName}>
                {sp.name}
                {sp.id === clientId && <span style={s.youTag}> (tú)</span>}
              </span>
            </div>
          ))}
          {session.spectators.length === 0 && (
            <div style={s.empty}>Sin espectadores</div>
          )}
        </div>

        <div style={s.divider} />

        {/* ── Status indicator ── */}
        {!isHost && (
          <div style={s.waitingMsg}>
            Esperando que el host inicie la partida…
            <span style={s.dots} />
          </div>
        )}

        {/* ── Actions ── */}
        <div style={s.actions}>
          {isHost && (
            <button
              style={{ ...s.btnStart, opacity: canStart ? 1 : 0.5 }}
              onClick={startSession}
              disabled={!canStart}
              title={canStart ? 'Iniciar mesa de juego' : 'Necesitas al menos un jugador'}
            >
              ▶ INICIAR MESA
            </button>
          )}

          <button style={s.btnLeave} onClick={leaveSession}>
            {isHost ? '✕ Cerrar Sesión' : '← Salir'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    width:          '100vw',
    height:         '100vh',
    background:     '#08080f',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontFamily:     F,
    position:       'relative',
    overflow:       'hidden',
  },

  bgGrid: {
    position:       'absolute',
    inset:           0,
    background:     'radial-gradient(circle at 50% 40%, #0a1428 0%, #08080f 70%)',
    backgroundImage: 'radial-gradient(circle, #1a2a4020 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    pointerEvents:  'none',
  },

  card: {
    position:    'relative',
    width:       '100%',
    maxWidth:    400,
    margin:      '0 16px',
    background:  'rgba(8, 12, 26, 0.97)',
    border:      '1px solid #1a3a5a',
    borderRadius: 8,
    padding:     '28px 24px',
    boxShadow:   '0 8px 48px rgba(0, 212, 255, 0.08)',
  },

  title: {
    fontSize:      20,
    fontWeight:    700,
    letterSpacing: 6,
    color:         '#00d4ff',
    textAlign:     'center',
    textShadow:    '0 0 16px rgba(0,212,255,0.4)',
    marginBottom:  16,
  },

  codeSection: {
    textAlign:  'center',
    marginBottom: 4,
  },

  codeLabel: {
    display:       'block',
    fontSize:      8,
    letterSpacing: 3,
    color:         '#2a4a6a',
    fontWeight:    700,
    marginBottom:  6,
  },

  code: {
    fontSize:      36,
    fontWeight:    700,
    letterSpacing: 10,
    color:         '#c9a84c',
    textShadow:    '0 0 20px rgba(201,168,76,0.5)',
    padding:       '8px 0',
  },

  codeHint: {
    display:    'block',
    fontSize:   9,
    color:      '#1e3050',
    letterSpacing: 0.5,
  },

  divider: {
    height:     1,
    background: 'linear-gradient(to right, transparent, #1a3a5a, transparent)',
    margin:     '16px 0',
  },

  sectionLabel: {
    fontSize:      8,
    letterSpacing: 3,
    color:         '#2a4a6a',
    fontWeight:    700,
    marginBottom:  8,
  },

  list: {
    display:       'flex',
    flexDirection: 'column',
    gap:            4,
  },

  listItem: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    padding:    '5px 8px',
    background: '#0a1020',
    border:     '1px solid #0e2040',
    borderRadius: 3,
  },

  hostBadge: {
    fontSize:      7,
    letterSpacing: 1,
    fontWeight:    700,
    color:         '#00d4ff',
    background:    '#001a2e',
    border:        '1px solid #00d4ff44',
    borderRadius:  2,
    padding:       '1px 4px',
    flexShrink:    0,
  },

  playerBadge: {
    fontSize:      7,
    letterSpacing: 1,
    fontWeight:    700,
    color:         '#44cc88',
    background:    '#001a0e',
    border:        '1px solid #44cc8844',
    borderRadius:  2,
    padding:       '1px 4px',
    flexShrink:    0,
  },

  specBadge: {
    fontSize:   12,
    flexShrink: 0,
  },

  listName: {
    fontSize: 11,
    color:    '#8aaccc',
    fontFamily: F,
  },

  youTag: {
    color:    '#4a6a8a',
    fontSize: 9,
  },

  empty: {
    fontSize:   9,
    color:      '#1e3050',
    fontStyle:  'italic',
    padding:    '4px 0',
  },

  waitingMsg: {
    textAlign:   'center',
    fontSize:    10,
    color:       '#3a6a9a',
    letterSpacing: 1,
    marginBottom: 12,
    animation:   'pulse 2s infinite',
  },

  dots: {
    display: 'inline-block',
    marginLeft: 4,
  },

  actions: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },

  btnStart: {
    padding:       '11px 0',
    background:    '#001a10',
    border:        '1px solid #00884a',
    borderRadius:  4,
    color:         '#00cc66',
    fontFamily:    F,
    fontSize:      13,
    fontWeight:    700,
    letterSpacing: 3,
    cursor:        'pointer',
    transition:    'opacity 0.2s',
  },

  btnLeave: {
    padding:    '9px 0',
    background: '#120808',
    border:     '1px solid #3a1010',
    borderRadius: 4,
    color:      '#6a3030',
    fontFamily: F,
    fontSize:   10,
    fontWeight: 700,
    cursor:     'pointer',
    letterSpacing: 1,
  },
};