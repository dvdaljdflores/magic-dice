/**
 * LAYER 2/6 — ResultsPanel: Left side — always visible
 *
 * Always shows 6 face-value rows (#1–#6).
 * Each row: face value, count, (del - N), (roll - N) buttons.
 * History accumulates below with turn/phase labels.
 */

'use client';

import type { DiceRollResult, DieColor, RollHistoryEntry, WarhPhase } from '../core/types';
import { WARH_PHASE_LABEL } from '../core/types';

interface ResultsPanelProps {
  rollResult: DiceRollResult | null;
  activeMask: boolean[] | null;
  dieColor: DieColor;
  history: RollHistoryEntry[];
  onDelete: (faceValue: number) => void;
  onReroll: (faceValue: number) => void;
}

const COLOR_HEX: Record<DieColor, string> = {
  white: '#e8e8e8',
  red:   '#e05040',
  blue:  '#4488cc',
  green: '#40c060',
};

const FACES = [1, 2, 3, 4, 5, 6];

function faceEmoji(v: number): string {
  return ['⚀','⚁','⚂','⚃','⚄','⚅'][v - 1] ?? String(v);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatHistoryValues(values: number[]): string {
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return [1, 2, 3, 4, 5, 6]
    .filter(v => counts[v])
    .map(v => `#${v} ×${counts[v]}`)
    .join('  ');
}

function phaseLabel(phase: WarhPhase | null): string {
  return phase ? WARH_PHASE_LABEL[phase] : '';
}

export function ResultsPanel({
  rollResult, activeMask, dieColor, history, onDelete, onReroll,
}: ResultsPanelProps) {
  const dipColor = COLOR_HEX[dieColor];

  // Count per face value (only active dice)
  function getFaceCount(v: number): number {
    if (!rollResult) return 0;
    let n = 0;
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (rollResult.values[i] === v) n++;
    }
    return n;
  }

  const totalActive = FACES.reduce((s, v) => s + getFaceCount(v), 0);
  const hasResult   = rollResult !== null;

  return (
    <div style={s.panel}>
      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div style={s.sectionHead}>RESULTADO</div>

      <table style={s.table}>
        <tbody>
          {FACES.map(v => {
            const cnt = getFaceCount(v);
            return (
              <tr key={v} style={s.row}>
                <td style={s.face}>
                  <span style={{ color: dipColor, fontSize: 16, lineHeight: 1 }}>
                    {faceEmoji(v)}
                  </span>
                  <span style={s.faceNum}>{v}</span>
                </td>
                <td style={s.cnt}>
                  {cnt > 0 ? `× ${cnt}` : <span style={{ color: '#2a3a50' }}>—</span>}
                </td>
                <td style={s.actions}>
                  <button
                    style={{ ...s.actBtn, color: hasResult && cnt > 0 ? '#ff5555' : '#2a3a50' }}
                    title={`Eliminar todos los ${v}`}
                    onClick={() => onDelete(v)}
                    disabled={!hasResult || cnt === 0}
                  >
                    del-{v}
                  </button>
                  <button
                    style={{ ...s.actBtn, color: hasResult && cnt > 0 ? '#00d4ff' : '#2a3a50' }}
                    title={`Re-tirar todos los ${v}`}
                    onClick={() => onReroll(v)}
                    disabled={!hasResult || cnt === 0}
                  >
                    roll-{v}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hasResult && (
        <div style={s.total}>
          <span style={{ color: '#3a5a7a' }}>TOTAL ACTIVOS</span>
          <span style={{ color: '#c9a84c', fontWeight: 700 }}>{totalActive}</span>
        </div>
      )}

      {/* ── History ─────────────────────────────────────────────────────── */}
      <div style={{ ...s.sectionHead, marginTop: 10 }}>HISTORIAL</div>

      {history.length === 0 ? (
        <div style={s.histEmpty}>sin tiradas aún</div>
      ) : (
        <div style={s.histList}>
          {[...history].reverse().map(entry => {
            const pLabel = phaseLabel(entry.phase);
            const title  = `Turno ${entry.turn}${pLabel ? ` (${pLabel})` : ''}${entry.isReroll ? ' · tirada repetida' : ''}`;
            return (
              <div key={entry.id} style={s.histBlock}>
                <div style={s.histTitle}>
                  <span style={histDotStyle(COLOR_HEX[entry.color])} />
                  <span style={{ color: entry.isReroll ? '#c9a84c' : '#4a7aaa' }}>
                    {title}
                  </span>
                  <span style={{ color: '#2a3a50', marginLeft: 'auto', fontSize: 9 }}>
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <div style={s.histValues}>
                  {formatHistoryValues(entry.values)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const font = "'Courier New', Courier, monospace";

function histDotStyle(color: string): React.CSSProperties {
  return {
    width: 6, height: 6, borderRadius: '50%',
    background: color, flexShrink: 0, display: 'inline-block',
  };
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    left: 0,
    top: 72,
    bottom: 0,
    width: 240,
    background: 'rgba(5, 8, 18, 0.95)',
    borderRight: '1px solid #0e2040',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    backdropFilter: 'blur(14px)',
    fontFamily: font,
    zIndex: 50,
    overflowY: 'auto',
  },
  sectionHead: {
    color: '#2a4a6a',
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: 700,
    paddingBottom: 4,
    borderBottom: '1px solid #0e2040',
    marginBottom: 2,
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  row: {
    borderBottom: '1px solid #0a1a2a',
  },
  face: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
    paddingTop: 3,
    paddingBottom: 3,
    whiteSpace: 'nowrap' as const,
  },
  faceNum: {
    color: '#7090b0',
    fontSize: 11,
    fontWeight: 700,
    width: 10,
    display: 'inline-block',
  },
  cnt: {
    color: '#c9a84c',
    fontSize: 12,
    fontWeight: 700,
    paddingRight: 6,
    whiteSpace: 'nowrap' as const,
    minWidth: 38,
  },
  actions: {
    whiteSpace: 'nowrap' as const,
  },
  actBtn: {
    background: 'none',
    border: 'none',
    fontSize: 9,
    fontFamily: font,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: 'pointer',
    padding: '1px 3px',
    textTransform: 'uppercase' as const,
    transition: 'opacity 0.1s',
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    letterSpacing: 2,
    paddingTop: 4,
    fontFamily: font,
    marginTop: 2,
  },
  histEmpty: {
    color: '#1e2e3e',
    fontSize: 10,
    fontStyle: 'italic',
    padding: '4px 0',
  },
  histList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
  },
  histBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: '3px 0',
    borderBottom: '1px solid #0a1520',
  },
  histTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    fontWeight: 700,
  },
  histValues: {
    color: '#3a5a7a',
    fontSize: 9,
    lineHeight: 1.4,
    paddingLeft: 11,
    wordBreak: 'break-word' as const,
  },
};
