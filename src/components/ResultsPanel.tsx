/**
 * LAYER 2/6 — ResultsPanel: Left panel — always visible
 *
 * Shows 6 fixed face-value rows. Each row has:
 *   del-N  roll-N  sus (sustained hits)  let (toggle lethal)
 * del/roll affect all dice with value ≤ N.
 * Counts hidden during animation.
 * "Regresar" button undoes last action.
 */

'use client';

import type {
  DiceRollResult, DieColor, RollHistoryEntry, WarhPhase, GamePhase, SustainedX,
} from '../core/types';
import { WARH_PHASE_LABEL } from '../core/types';

interface ResultsPanelProps {
  rollResult:        DiceRollResult | null;
  activeMask:        boolean[] | null;
  lethalMask:        boolean[] | null;
  dieColor:          DieColor;
  history:           RollHistoryEntry[];
  gamePhase:         GamePhase;
  sustainedX:        SustainedX;
  onSustainedXChange:(x: SustainedX) => void;
  onDelete:          (faceValue: number) => void;
  onReroll:          (faceValue: number) => void;
  onSustainedHits:   (faceValue: number) => void;
  onToggleLethal:    (faceValue: number) => void;
  onUndo:            () => void;
  canUndo:           boolean;
}

const COLOR_HEX: Record<DieColor, string> = {
  white: '#e8e8e8', red: '#e05040', blue: '#4488cc', green: '#40c060',
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
  if (values.length === 0) return '';
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

function spinningLabel(phase: GamePhase): string {
  if (phase === 'ROLLING')   return 'lanzando…';
  if (phase === 'SETTLING')  return 'estabilizando…';
  if (phase === 'ARRANGING') return 'organizando…';
  return '';
}

export function ResultsPanel({
  rollResult, activeMask, lethalMask, dieColor, history, gamePhase,
  sustainedX, onSustainedXChange,
  onDelete, onReroll, onSustainedHits, onToggleLethal,
  onUndo, canUndo,
}: ResultsPanelProps) {
  const dipColor   = COLOR_HEX[dieColor];
  const hasResult  = rollResult !== null;
  const inArranged = gamePhase === 'ARRANGED';
  const busy       = gamePhase === 'ROLLING' || gamePhase === 'SETTLING' || gamePhase === 'ARRANGING';

  function getFaceCount(v: number): number {
    if (!rollResult) return 0;
    let n = 0;
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (rollResult.values[i] === v) n++;
    }
    return n;
  }

  function getRerollableCount(v: number): number {
    if (!rollResult) return 0;
    let n = 0;
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (lethalMask?.[i]) continue;
      if (rollResult.values[i] === v) n++;
    }
    return n;
  }

  function getLethalCount(v: number): number {
    if (!rollResult || !lethalMask) return 0;
    let n = 0;
    for (let i = 0; i < rollResult.values.length; i++) {
      if (activeMask && !activeMask[i]) continue;
      if (lethalMask[i] && rollResult.values[i] === v) n++;
    }
    return n;
  }

  function isGroupLethal(v: number): boolean {
    const cnt = getFaceCount(v);
    return cnt > 0 && getLethalCount(v) === cnt;
  }

  // Count of dice that would be deleted/rerolled by clicking ≤v button
  function getDeleteableCount(v: number): number {
    if (!rollResult) return 0;
    let n = 0;
    for (let f = 1; f <= v; f++) n += getFaceCount(f);
    return n;
  }

  function getRerollableBelowCount(v: number): number {
    if (!rollResult) return 0;
    let n = 0;
    for (let f = 1; f <= v; f++) n += getRerollableCount(f);
    return n;
  }

  const totalActive = FACES.reduce((acc, v) => acc + getFaceCount(v), 0);

  return (
    <div style={s.panel}>
      {/* ── SUS × selector + Regresar ──────────────────────────────────── */}
      <div style={s.topRow}>
        <div style={s.susRow}>
          <span style={s.susLabel}>SUS ×</span>
          {([1, 2, 3] as SustainedX[]).map(x => (
            <button
              key={x}
              style={{ ...s.susBtn, ...(sustainedX === x ? s.susBtnActive : {}) }}
              onClick={() => onSustainedXChange(x)}
            >
              {x}
            </button>
          ))}
        </div>

        <button
          style={{ ...s.undoBtn, opacity: canUndo ? 1 : 0.35 }}
          disabled={!canUndo}
          onClick={onUndo}
          title="Deshacer última acción"
        >
          ↩ Regresar
        </button>
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      <div style={s.sectionHead}>RESULTADO</div>

      {busy && (
        <div style={s.animStatus}>{spinningLabel(gamePhase)}</div>
      )}

      <table style={s.table}>
        <tbody>
          {FACES.map(v => {
            const cnt         = getFaceCount(v);
            const rerollable  = getRerollableCount(v);
            const lethalCnt   = getLethalCount(v);
            const groupLethal = isGroupLethal(v);
            const delCount    = getDeleteableCount(v);
            const rollCount   = getRerollableBelowCount(v);

            return (
              <tr key={v} style={s.row}>
                {/* Face icon + value */}
                <td style={s.face}>
                  <span style={{ color: dipColor, fontSize: 16, lineHeight: 1 }}>
                    {faceEmoji(v)}
                  </span>
                  <span style={s.faceNum}>{v}</span>
                </td>

                {/* Count — hidden during animation */}
                <td style={s.cnt}>
                  {busy
                    ? <span style={{ color: '#1a3a5a' }}>···</span>
                    : cnt > 0
                      ? <span>{`× ${cnt}`}</span>
                      : <span style={{ color: '#2a3a50' }}>—</span>
                  }
                </td>

                {/* Lethal badge */}
                <td style={s.lethalCell}>
                  {inArranged && lethalCnt > 0 && (
                    <span style={s.lethalBadge} title={`${lethalCnt} letales (Mortal Wounds)`}>
                      ☠{lethalCnt}
                    </span>
                  )}
                </td>

                {/* Action buttons */}
                <td style={s.actions}>
                  <button
                    style={{ ...s.actBtn, color: hasResult && delCount > 0 && !busy ? '#ff5555' : '#2a3a50' }}
                    title={`Eliminar todos los dados ≤${v} (${delCount} dados)`}
                    onClick={() => onDelete(v)}
                    disabled={busy || !hasResult || delCount === 0}
                  >
                    del
                  </button>
                  <button
                    style={{ ...s.actBtn, color: hasResult && rollCount > 0 && !busy ? '#00d4ff' : '#2a3a50' }}
                    title={`Re-tirar dados ≤${v} (excluye letales, ${rollCount} dados)`}
                    onClick={() => onReroll(v)}
                    disabled={busy || !hasResult || rollCount === 0}
                  >
                    roll
                  </button>
                  <button
                    style={{ ...s.actBtn, color: inArranged && rerollable > 0 ? '#44cc88' : '#2a3a50' }}
                    title={`Sustained Hits ×${sustainedX} para ${v}s`}
                    onClick={() => onSustainedHits(v)}
                    disabled={!inArranged || rerollable === 0}
                  >
                    sus
                  </button>
                  <button
                    style={{
                      ...s.actBtn,
                      color: groupLethal
                        ? '#cc44ff'
                        : hasResult && cnt > 0 && !busy ? '#884488' : '#2a3a50',
                      fontWeight: groupLethal ? 900 : 700,
                    }}
                    title={groupLethal ? `Quitar lethal de ${v}s` : `Marcar ${v}s como Mortal Wounds`}
                    onClick={() => onToggleLethal(v)}
                    disabled={busy || !hasResult || cnt === 0}
                  >
                    {groupLethal ? '☠let' : 'let'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {inArranged && hasResult && (
        <div style={s.total}>
          <span style={{ color: '#3a5a7a' }}>TOTAL ACTIVOS</span>
          <span style={{ color: '#c9a84c', fontWeight: 700 }}>{totalActive}</span>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────── */}
      <div style={{ ...s.sectionHead, marginTop: 10 }}>HISTORIAL</div>

      {history.length === 0 ? (
        <div style={s.histEmpty}>sin tiradas aún</div>
      ) : (
        <div style={s.histList}>
          {[...history].reverse().map(entry => {
            const pLabel = phaseLabel(entry.phase);
            const isAction = !!entry.actionLabel;
            const title = isAction
              ? entry.actionLabel!
              : `Turno ${entry.turn}${pLabel ? ` (${pLabel})` : ''}${entry.isReroll ? ' · rep.' : ''}`;
            const valStr = formatHistoryValues(entry.values);
            return (
              <div key={entry.id} style={s.histBlock}>
                <div style={s.histTitle}>
                  <span style={histDotStyle(COLOR_HEX[entry.color])} />
                  <span style={{
                    color: isAction
                      ? '#9966cc'
                      : entry.isReroll ? '#c9a84c' : '#4a7aaa',
                  }}>
                    {title}
                  </span>
                  <span style={{ color: '#2a3a50', marginLeft: 'auto', fontSize: 9 }}>
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                {valStr && (
                  <div style={s.histValues}>{valStr}</div>
                )}
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
    position: 'absolute', left: 0, top: 72, bottom: 0, width: 240,
    background: 'rgba(5, 8, 18, 0.95)',
    borderRight: '1px solid #0e2040',
    padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 2,
    backdropFilter: 'blur(14px)',
    fontFamily: font, zIndex: 50, overflowY: 'auto',
  },
  topRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  susRow: {
    display: 'flex', alignItems: 'center', gap: 4,
  },
  susLabel: {
    color: '#44cc88', fontSize: 9, letterSpacing: 2, fontWeight: 700,
  },
  susBtn: {
    fontFamily: font, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#44cc88', padding: '1px 6px',
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
  },
  susBtnActive: {
    background: '#1a3a20', border: '1px solid #44cc88',
  },
  undoBtn: {
    fontFamily: font, background: '#1a1828', border: '1px solid #3a2a50',
    borderRadius: 3, color: '#9966cc', padding: '2px 7px',
    fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
  },
  animStatus: {
    color: '#4a8aaa', fontSize: 9, fontStyle: 'italic',
    letterSpacing: 1, padding: '2px 0 4px',
  },
  sectionHead: {
    color: '#2a4a6a', fontSize: 9, letterSpacing: 3, fontWeight: 700,
    paddingBottom: 3, borderBottom: '1px solid #0e2040', marginBottom: 2,
  },
  table: { borderCollapse: 'collapse', width: '100%' },
  row:   { borderBottom: '1px solid #0a1a2a' },
  face: {
    display: 'flex' as const, alignItems: 'center', gap: 4,
    paddingRight: 4, paddingTop: 2, paddingBottom: 2,
    whiteSpace: 'nowrap' as const,
  },
  faceNum: {
    color: '#7090b0', fontSize: 11, fontWeight: 700,
    width: 10, display: 'inline-block',
  },
  cnt: {
    color: '#c9a84c', fontSize: 12, fontWeight: 700,
    paddingRight: 4, whiteSpace: 'nowrap' as const, minWidth: 34,
  },
  lethalCell: { minWidth: 22, paddingRight: 2 },
  lethalBadge: {
    color: '#cc44ff', fontSize: 9, fontWeight: 900,
    whiteSpace: 'nowrap' as const,
  },
  actions: { whiteSpace: 'nowrap' as const },
  actBtn: {
    background: 'none', border: 'none', fontSize: 9,
    fontFamily: font, fontWeight: 700, letterSpacing: 0.5,
    cursor: 'pointer', padding: '1px 3px',
    textTransform: 'uppercase' as const,
  },
  total: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 10, letterSpacing: 2, paddingTop: 3, fontFamily: font,
  },
  histEmpty: {
    color: '#1e2e3e', fontSize: 10, fontStyle: 'italic', padding: '4px 0',
  },
  histList: {
    display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto',
  },
  histBlock: {
    display: 'flex', flexDirection: 'column', gap: 1,
    padding: '2px 0', borderBottom: '1px solid #0a1520',
  },
  histTitle: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 10, fontWeight: 700,
  },
  histValues: {
    color: '#3a5a7a', fontSize: 9, lineHeight: 1.4,
    paddingLeft: 11, wordBreak: 'break-word' as const,
  },
};
