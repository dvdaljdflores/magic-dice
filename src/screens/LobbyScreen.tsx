/**
 * LobbyScreen — Application Entry Point
 *
 * PURPOSE:
 *   The first screen a user sees. Lets them choose between:
 *     1. Solo play  → enter the dice table immediately, no session
 *     2. Create a session → become the host, go to WaitingRoom
 *     3. Join as Player   → enter an existing session, can roll
 *     4. Join as Spectator → watch an existing session, cannot roll
 *
 * RESPONSIBILITIES:
 *   - Collect player name and optional session code
 *   - Validate inputs before calling sessionManager functions
 *   - Show any errors returned by sessionManager
 *   - Navigate via appModeStore (setMode)
 *
 * INTERACTIONS:
 *   - Calls createSession / joinAsPlayer / joinAsSpectator from sessionManager
 *   - Calls useAppModeStore.setMode to navigate
 *   - Does NOT interact with the dice engine at all
 */

'use client';

import { useState } from 'react';
import { useAppModeStore } from '../appState/appModeStore';
import { createSession, joinAsPlayer, joinAsSpectator } from '../session/sessionManager';

const F = "'Courier New', Courier, monospace";

// ─── Component ────────────────────────────────────────────────────────────────

export function LobbyScreen() {
  const setMode = useAppModeStore(s => s.setMode);

  const [playerName,  setPlayerName]  = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSolo() {
    setMode('solo');
  }

  function handleCreate() {
    setError(null);
    const err = createSession(playerName || 'Host');
    if (err) { setError(err); return; }
    setMode('waiting');
  }

  function handleJoinPlayer() {
    setError(null);
    if (!sessionCode.trim()) { setError('Introduce el código de sesión.'); return; }
    const err = joinAsPlayer(playerName || 'Jugador', sessionCode);
    if (err) { setError(err); return; }
    setMode('waiting');
  }

  function handleJoinSpectator() {
    setError(null);
    if (!sessionCode.trim()) { setError('Introduce el código de sesión.'); return; }
    const err = joinAsSpectator(playerName || 'Espectador', sessionCode);
    if (err) { setError(err); return; }
    setMode('waiting');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>

      {/* ── Background decoration ── */}
      <div style={s.bgGrid} aria-hidden />

      {/* ── Card ── */}
      <div style={s.card}>

        {/* Title */}
        <div style={s.title}>MAGIC DICE</div>
        <div style={s.subtitle}>Simulador de dados 3D · Warhammer 40K / Age of Sigmar</div>

        <div style={s.divider} />

        {/* Player name */}
        <label style={s.label}>Tu nombre</label>
        <input
          style={s.input}
          type="text"
          placeholder="Ej: Comandante Uriel"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
        />

        {/* ── Solo button ── */}
        <button style={s.btnSolo} onClick={handleSolo}>
          ▶ Tirar Dados (Solo)
        </button>

        <div style={s.divider} />

        {/* Session section label */}
        <div style={s.sectionLabel}>MODO MULTIJUGADOR</div>

        {/* Session code input */}
        <label style={s.label}>Código de sesión</label>
        <input
          style={{ ...s.input, textTransform: 'uppercase', letterSpacing: 4 }}
          type="text"
          placeholder="Ej: AQWZ"
          value={sessionCode}
          onChange={e => setSessionCode(e.target.value.toUpperCase().slice(0, 4))}
          maxLength={4}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Session action buttons */}
        <div style={s.btnRow}>
          <button style={s.btnCreate} onClick={handleCreate} disabled={loading}>
            ✦ Crear Mesa
          </button>
        </div>

        <div style={s.btnRow}>
          <button style={s.btnJoin} onClick={handleJoinPlayer} disabled={loading}>
            → Unirse como Jugador
          </button>
          <button style={s.btnSpec} onClick={handleJoinSpectator} disabled={loading}>
            👁 Espectador
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div style={s.errorBox}>
            ⚠ {error}
          </div>
        )}

        {/* Limits info */}
        <div style={s.info}>
          Máx. 2 jugadores · Máx. 3 espectadores<br />
          El host controla el inicio de la partida
        </div>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    width:           '100vw',
    height:          '100vh',
    background:      '#08080f',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontFamily:      F,
    position:        'relative',
    overflow:        'hidden',
  },

  // Subtle dot-grid background
  bgGrid: {
    position:   'absolute',
    inset:       0,
    background: 'radial-gradient(circle at 50% 50%, #0a1428 0%, #08080f 70%)',
    backgroundImage: `
      radial-gradient(circle, #1a2a4020 1px, transparent 1px)
    `,
    backgroundSize: '28px 28px',
    pointerEvents:  'none',
  },

  card: {
    position:       'relative',
    width:          '100%',
    maxWidth:       380,
    margin:         '0 16px',
    background:     'rgba(8, 12, 26, 0.97)',
    border:         '1px solid #1a3a5a',
    borderRadius:   8,
    padding:        '28px 24px',
    boxShadow:      '0 8px 48px rgba(0, 212, 255, 0.08), 0 2px 12px rgba(0,0,0,0.8)',
  },

  title: {
    fontSize:      28,
    fontWeight:    700,
    letterSpacing: 8,
    color:         '#00d4ff',
    textAlign:     'center',
    textShadow:    '0 0 20px rgba(0,212,255,0.5)',
  },

  subtitle: {
    fontSize:   9,
    color:      '#2a4a6a',
    textAlign:  'center',
    letterSpacing: 1,
    marginTop:  4,
  },

  divider: {
    height:     1,
    background: 'linear-gradient(to right, transparent, #1a3a5a, transparent)',
    margin:     '18px 0',
  },

  label: {
    display:       'block',
    fontSize:      9,
    letterSpacing: 2,
    color:         '#3a5a7a',
    fontWeight:    700,
    marginBottom:  5,
    textTransform: 'uppercase' as const,
  },

  input: {
    display:     'block',
    width:       '100%',
    boxSizing:   'border-box' as const,
    background:  '#0a1020',
    border:      '1px solid #1a3a5a',
    borderRadius: 4,
    color:       '#c0d8f0',
    fontFamily:  F,
    fontSize:    13,
    padding:     '8px 10px',
    marginBottom: 12,
    outline:     'none',
    transition:  'border-color 0.15s',
  },

  btnSolo: {
    display:       'block',
    width:         '100%',
    padding:       '10px 0',
    background:    '#00d4ff',
    border:        'none',
    borderRadius:  4,
    color:         '#000c14',
    fontFamily:    F,
    fontSize:      13,
    fontWeight:    700,
    letterSpacing: 2,
    cursor:        'pointer',
    transition:    'opacity 0.15s',
  },

  sectionLabel: {
    fontSize:      8,
    letterSpacing: 4,
    color:         '#2a4a6a',
    fontWeight:    700,
    textAlign:     'center',
    marginBottom:  14,
  },

  btnRow: {
    display: 'flex',
    gap:     8,
    marginBottom: 8,
  },

  btnCreate: {
    flex:          1,
    padding:       '9px 0',
    background:    '#001a10',
    border:        '1px solid #00884a',
    borderRadius:  4,
    color:         '#00cc66',
    fontFamily:    F,
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: 1,
    cursor:        'pointer',
  },

  btnJoin: {
    flex:          2,
    padding:       '9px 0',
    background:    '#001220',
    border:        '1px solid #1a5a9a',
    borderRadius:  4,
    color:         '#4a9adf',
    fontFamily:    F,
    fontSize:      10,
    fontWeight:    700,
    cursor:        'pointer',
    letterSpacing: 0.5,
  },

  btnSpec: {
    flex:          1,
    padding:       '9px 0',
    background:    '#100a20',
    border:        '1px solid #4a2a7a',
    borderRadius:  4,
    color:         '#9966cc',
    fontFamily:    F,
    fontSize:      10,
    fontWeight:    700,
    cursor:        'pointer',
  },

  errorBox: {
    marginTop:    8,
    padding:      '8px 10px',
    background:   '#1a0808',
    border:       '1px solid #5a1a1a',
    borderRadius: 4,
    color:        '#dd4444',
    fontSize:     10,
    letterSpacing: 0.5,
  },

  info: {
    marginTop:  16,
    fontSize:   9,
    color:      '#1e3050',
    textAlign:  'center',
    lineHeight: 1.8,
    letterSpacing: 0.5,
  },
};