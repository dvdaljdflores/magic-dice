/**
 * RollHistoryPanel — Session Roll History Component
 *
 * PURPOSE:
 *   Displays the live roll history for a session (or solo play).
 *   Rendered inside DiceTableScreen as a floating overlay panel.
 *
 * RESPONSIBILITIES:
 *   - Show each roll entry: who rolled, what they got, total
 *   - Auto-scroll to the newest entry (WITHOUT scrolling the page)
 *   - Open a detail modal when clicking an entry (same UX as the left panel)
 *   - Be collapsible to avoid obscuring the 3D scene
 *   - Work on mobile and desktop
 *
 * BUG NOTES:
 *   scrollIntoView() was replaced with direct scrollTop on the container ref
 *   because scrollIntoView propagates to the document and pushes the entire
 *   page upward, hiding the top control bar after each roll.
 *
 * INTERACTIONS:
 *   - DiceTableScreen passes the rolls array
 *   - In solo mode the array comes from diceStore.history (adapted)
 *   - In session mode the array comes from sessionStore.session.history
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { SessionDiceRoll } from '../../session/sessionTypes';

const F = "'Courier New', Courier, monospace";

// ─── Props ────────────────────────────────────────────────────────────────────

interface RollHistoryPanelProps {
  rolls: SessionDiceRoll[];
  /** If true, panel renders in a compact mobile-friendly style */
  isMobile?: boolean;
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDiceShort(dice: number[]): string {
  if (dice.length === 0) return '—';
  if (dice.length <= 6) return `[${dice.join(', ')}]`;
  return `[${dice.slice(0, 6).join(', ')} …+${dice.length - 6}]`;
}

const FACE_EMOJI: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  roll: SessionDiceRoll;
  onClose: () => void;
}

function DetailModal({ roll, onClose }: DetailModalProps) {
  // Count occurrences of each face value
  const counts: Record<number, number> = {};
  for (const v of roll.dice) counts[v] = (counts[v] ?? 0) + 1;

  return (
    // Backdrop — clicking outside closes modal
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.card} onClick={e => e.stopPropagation()}>
        <button style={ms.close} onClick={onClose}>✕</button>

        {/* Player + time */}
        <div style={ms.header}>
          <span style={ms.playerName}>{roll.playerName}</span>
        </div>
        <div style={ms.time}>{formatTime(roll.timestamp)}</div>

        {/* Face-value breakdown grid */}
        <div style={ms.grid}>
          {[1, 2, 3, 4, 5, 6].filter(v => counts[v]).map(v => (
            <div key={v} style={ms.faceBox}>
              <span style={ms.emoji}>{FACE_EMOJI[v]}</span>
              <span style={ms.faceCount}>×{counts[v]}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={ms.total}>
          <span style={{ color: '#3a5a7a' }}>TOTAL</span>
          <span style={{ color: '#00d4ff', fontWeight: 700, fontSize: 18 }}>
            {roll.result}
          </span>
          <span style={{ color: '#2a4060', fontSize: 9 }}>
            {roll.dice.length} dado{roll.dice.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RollHistoryPanel({ rolls, isMobile = false }: RollHistoryPanelProps) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [selectedRoll, setSelectedRoll] = useState<SessionDiceRoll | null>(null);

  // Ref to the scrollable body div — we set scrollTop directly to avoid
  // scrollIntoView() propagating to the document and scrolling the page.
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll body to bottom when a new roll arrives.
  // Uses scrollTop, NOT scrollIntoView, to stay scoped to the panel.
  useEffect(() => {
    if (!collapsed && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [rolls.length, collapsed]);

  // ── Layout dims ────────────────────────────────────────────────────────────
  const panelW = isMobile ? '100%' : 240;
  const bodyH  = isMobile ? 150 : 260;

  return (
    <>
      <div style={{
        position:   'absolute',
        bottom:     isMobile ? 0 : 12,
        right:      isMobile ? 0 : 12,
        width:      panelW,
        zIndex:     200,
        fontFamily: F,
        // Prevent this panel from participating in document scroll
        contain:    'strict' as unknown as undefined,
      }}>
        {/* ── Header (click to collapse/expand) ── */}
        <div
          style={s.header}
          onClick={() => setCollapsed(c => !c)}
          role="button"
          aria-expanded={!collapsed}
        >
          <span style={s.headerTitle}>HISTORIAL DE TIRADAS</span>
          <span style={s.headerCount}>{rolls.length}</span>
          <span style={s.toggle}>{collapsed ? '▲' : '▼'}</span>
        </div>

        {/* ── Entry list ── */}
        {!collapsed && (
          <div ref={bodyRef} style={{ ...s.body, maxHeight: bodyH }}>
            {rolls.length === 0 ? (
              <div style={s.empty}>Sin tiradas aún</div>
            ) : (
              [...rolls].map(roll => (
                <div
                  key={roll.id}
                  style={s.entry}
                  onClick={() => setSelectedRoll(roll)}
                  title="Click para ver detalle"
                >
                  <div style={s.entryHeader}>
                    <span style={s.playerName}>{roll.playerName}</span>
                    <span style={s.entryTime}>{formatTime(roll.timestamp)}</span>
                  </div>
                  <div style={s.entryResult}>
                    Total: <span style={s.resultNum}>{roll.result}</span>
                  </div>
                  <div style={s.entryDice}>{formatDiceShort(roll.dice)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Detail modal (renders outside the panel to avoid stacking issues) ── */}
      {selectedRoll && (
        <DetailModal roll={selectedRoll} onClose={() => setSelectedRoll(null)} />
      )}
    </>
  );
}

// ─── Panel Styles ─────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  header: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '5px 10px',
    background:   'rgba(6, 10, 22, 0.95)',
    borderTop:    '1px solid #1a3a5a',
    borderLeft:   '1px solid #1a3a5a',
    borderRight:  '1px solid #1a3a5a',
    borderBottom: '1px solid #0e2040',
    cursor:       'pointer',
    userSelect:   'none',
  },
  headerTitle: {
    fontSize:     9,
    letterSpacing: 2,
    fontWeight:   700,
    color:        '#2a4a6a',
    flex:         1,
  },
  headerCount: {
    fontSize:     10,
    fontWeight:   700,
    color:        '#00d4ff',
    background:   '#001a2e',
    borderRadius: 3,
    padding:      '1px 5px',
  },
  toggle: {
    fontSize:   9,
    color:      '#2a4a6a',
    marginLeft: 4,
  },
  body: {
    overflowY:  'auto',
    background: 'rgba(6, 10, 22, 0.95)',
    border:     '1px solid #1a3a5a',
    borderTop:  'none',
    // Prevent scroll from leaking out to the document
    overscrollBehavior: 'contain',
  },
  empty: {
    padding:   '12px 10px',
    color:     '#2a3a50',
    fontSize:  10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  entry: {
    padding:      '6px 10px',
    borderBottom: '1px solid #0a1828',
    cursor:       'pointer',
    transition:   'background 0.1s',
  },
  entryHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   2,
  },
  playerName: {
    fontSize:     10,
    fontWeight:   700,
    color:        '#4a9adf',
    letterSpacing: 0.5,
  },
  entryTime: {
    fontSize: 9,
    color:    '#2a3a50',
  },
  entryResult: {
    fontSize: 10,
    color:    '#6080a0',
  },
  resultNum: {
    color:      '#00d4ff',
    fontWeight: 700,
    fontSize:   12,
  },
  entryDice: {
    fontSize:  9,
    color:     '#2a4a6a',
    marginTop: 2,
    wordBreak: 'break-all',
  },
};

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const ms: Record<string, React.CSSProperties> = {
  overlay: {
    position:        'fixed',
    inset:            0,
    background:      'rgba(0, 0, 0, 0.72)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          500,
    backdropFilter:  'blur(4px)',
  },
  card: {
    background:     'rgba(6, 10, 22, 0.98)',
    border:         '1px solid #1a3a5a',
    borderRadius:   8,
    padding:        '24px 28px',
    minWidth:       280,
    maxWidth:       400,
    fontFamily:     F,
    boxShadow:      '0 8px 40px rgba(0, 0, 0, 0.8)',
    position:       'relative',
    display:        'flex',
    flexDirection:  'column',
    gap:            12,
  },
  close: {
    position:   'absolute',
    top:        10,
    right:      12,
    background: 'none',
    border:     'none',
    color:      '#3a5a7a',
    fontSize:   16,
    cursor:     'pointer',
    fontFamily: F,
    lineHeight: 1,
  },
  header: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  },
  playerName: {
    fontSize:  14,
    fontWeight: 700,
    color:     '#4a9adf',
    letterSpacing: 1,
  },
  time: {
    color:        '#2a4060',
    fontSize:     11,
    letterSpacing: 1,
  },
  grid: {
    display:   'flex',
    flexWrap:  'wrap',
    gap:       10,
    marginTop: 4,
  },
  faceBox: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    background:     '#0d1a30',
    borderRadius:   6,
    padding:        '10px 14px',
    gap:            4,
    border:         '1px solid #1a3a5a',
  },
  emoji:     { fontSize: 36, lineHeight: 1 },
  faceCount: { color: '#c9a84c', fontSize: 18, fontWeight: 700 },
  total: {
    display:        'flex',
    alignItems:     'center',
    gap:            10,
    color:          '#3a5a7a',
    fontSize:       10,
    letterSpacing:  2,
    borderTop:      '1px solid #0e2040',
    paddingTop:     10,
    fontFamily:     F,
  },
};