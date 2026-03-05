/**
 * LAYER 2/6 — ResultsPanel
 *
 * Desktop: absolute left panel (240px), includes history.
 * Mobile:  compact floating overlay at the bottom of the canvas.
 *          History is in the top-bar history dropdown (UIControls).
 *          Not shown in PREVIEW (canvas fully visible until first throw).
 */

'use client';

import { useState } from 'react';
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
  isMobile:          boolean;
}

const COLOR_HEX: Record<DieColor, string> = {
  white: '#e8e8e8', red: '#e05040', blue: '#4488cc', green: '#40c060',
  yellow: '#d4b800', orange: '#cc5510', purple: '#8830c0', black: '#303038',
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
  onUndo, canUndo, isMobile,
}: ResultsPanelProps) {
  const [modalEntry, setModalEntry] = useState<RollHistoryEntry | null>(null);

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

  // ── Results table (shared between desktop and mobile) ─────────────────
  const resultsTable = (
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
              <td style={s.face}>
                <span style={{ color: dipColor, fontSize: 16, lineHeight: 1 }}>
                  {faceEmoji(v)}
                </span>
                <span style={s.faceNum}>{v}</span>
              </td>

              <td style={s.cnt}>
                {busy
                  ? <span style={{ color: '#1a3a5a' }}>···</span>
                  : cnt > 0
                    ? <span>{`× ${cnt}`}</span>
                    : <span style={{ color: '#2a3a50' }}>—</span>
                }
              </td>

              <td style={s.lethalCell}>
                {inArranged && lethalCnt > 0 && (
                  <span style={s.lethalBadge} title={`${lethalCnt} letales`}>☠{lethalCnt}</span>
                )}
              </td>

              <td style={s.actions}>
                <button
                  style={{ ...s.actBtn, color: hasResult && delCount > 0 && !busy ? '#ff5555' : '#2a3a50' }}
                  title={`Eliminar todos los dados ≤${v} (${delCount})`}
                  onClick={() => onDelete(v)}
                  disabled={busy || !hasResult || delCount === 0}
                >del</button>
                <button
                  style={{ ...s.actBtn, color: hasResult && rollCount > 0 && !busy ? '#00d4ff' : '#2a3a50' }}
                  title={`Re-tirar dados ≤${v} (${rollCount})`}
                  onClick={() => onReroll(v)}
                  disabled={busy || !hasResult || rollCount === 0}
                >roll</button>
                <button
                  style={{ ...s.actBtn, color: inArranged && rerollable > 0 ? '#44cc88' : '#2a3a50' }}
                  title={`Sustained Hits ×${sustainedX} para ${v}s`}
                  onClick={() => onSustainedHits(v)}
                  disabled={!inArranged || rerollable === 0}
                >sus</button>
                <button
                  style={{
                    ...s.actBtn,
                    color: groupLethal ? '#cc44ff' : hasResult && cnt > 0 && !busy ? '#884488' : '#2a3a50',
                    fontWeight: groupLethal ? 900 : 700,
                  }}
                  title={groupLethal ? `Quitar lethal de ${v}s` : `Marcar ${v}s como Mortal Wounds`}
                  onClick={() => onToggleLethal(v)}
                  disabled={busy || !hasResult || cnt === 0}
                >{groupLethal ? '☠let' : 'let'}</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // ── Modal (shared) ─────────────────────────────────────────────────────
  const modal = modalEntry && (() => {
    const pLabel   = phaseLabel(modalEntry.phase);
    const isAction = !!modalEntry.actionLabel;
    const title    = isAction
      ? modalEntry.actionLabel!
      : `Turno ${modalEntry.turn}${pLabel ? ` · ${pLabel}` : ''}${modalEntry.isReroll ? ' · Repetida' : ''}`;
    const counts: Record<number, number> = {};
    for (const v of modalEntry.values) counts[v] = (counts[v] ?? 0) + 1;
    return (
      <div style={s.modalOverlay} onClick={() => setModalEntry(null)}>
        <div style={s.modalCard} onClick={e => e.stopPropagation()}>
          <button style={s.modalClose} onClick={() => setModalEntry(null)}>✕</button>
          <div style={s.modalHeader}>
            <span style={{
              color: isAction ? '#9966cc' : modalEntry.isReroll ? '#c9a84c' : '#4a7aaa',
              fontSize: 14, fontWeight: 700,
            }}>
              {title}
            </span>
          </div>
          <div style={s.modalTime}>{formatTime(modalEntry.timestamp)}</div>
          <div style={s.modalGrid}>
            {[1,2,3,4,5,6].filter(v => counts[v]).map(v => (
              <div key={v} style={s.modalFaceBox}>
                <span style={s.modalEmoji}>{faceEmoji(v)}</span>
                <span style={s.modalFaceCount}>×{counts[v]}</span>
              </div>
            ))}
          </div>
          {modalEntry.diceCount > 0 && (
            <div style={s.modalTotal}>
              {modalEntry.diceCount} dado{modalEntry.diceCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    );
  })();

  // ── Mobile: compact overlay over canvas bottom ─────────────────────────
  // Hidden in PREVIEW (canvas fully visible). Shown as soon as there's a result.
  if (isMobile) {
    if (!hasResult) return null;
    return (
      <>
        <div style={s.overlay}>
          {/* SUS × + Regresar */}
          <div style={s.topRow}>
            <div style={s.susRow}>
              <span style={s.susLabel}>SUS×</span>
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

            {busy && <span style={s.animStatus}>{spinningLabel(gamePhase)}</span>}

            {inArranged && hasResult && (
              <span style={s.totalLabel}>
                <span style={{ color: '#3a5a7a' }}>TOTAL </span>
                <span style={{ color: '#c9a84c', fontWeight: 700 }}>{totalActive}</span>
              </span>
            )}

            <button
              style={{ ...s.undoBtn, opacity: canUndo ? 1 : 0.35 }}
              disabled={!canUndo}
              onClick={onUndo}
              title={canUndo ? 'Deshacer' : 'Nada que deshacer (solo del/roll/let/sus)'}
            >
              ↩
            </button>
          </div>

          {resultsTable}
        </div>
        {modal}
      </>
    );
  }

  // ── Desktop: left panel ────────────────────────────────────────────────
  return (
    <>
      <div style={s.panel}>
        {/* SUS × + Regresar */}
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
            title={canUndo ? 'Deshacer última acción' : 'Nada que deshacer (solo del/roll/let/sus)'}
          >
            ↩ Regresar
          </button>
        </div>

        <div style={s.sectionHead}>RESULTADO</div>

        {busy && <div style={s.animStatusDesktop}>{spinningLabel(gamePhase)}</div>}

        {resultsTable}

        {inArranged && hasResult && (
          <div style={s.total}>
            <span style={{ color: '#3a5a7a' }}>TOTAL ACTIVOS</span>
            <span style={{ color: '#c9a84c', fontWeight: 700 }}>{totalActive}</span>
          </div>
        )}

        {/* History (desktop only) */}
        <div style={{ ...s.sectionHead, marginTop: 10 }}>HISTORIAL</div>

        {history.length === 0 ? (
          <div style={s.histEmpty}>sin tiradas aún</div>
        ) : (
          <div style={s.histList}>
            {[...history].reverse().map(entry => {
              const pLabel   = phaseLabel(entry.phase);
              const isAction = !!entry.actionLabel;
              const title    = isAction
                ? entry.actionLabel!
                : `Turno ${entry.turn}${pLabel ? ` (${pLabel})` : ''}${entry.isReroll ? ' · rep.' : ''}`;
              const valStr   = formatHistoryValues(entry.values);

              return (
                <div
                  key={entry.id}
                  style={{ ...s.histBlock, cursor: 'pointer' }}
                  onClick={() => setModalEntry(entry)}
                >
                  <div style={s.histTitle}>
                    <span style={histDotStyle(COLOR_HEX[entry.color])} />
                    <span style={{
                      color: isAction ? '#9966cc' : entry.isReroll ? '#c9a84c' : '#4a7aaa',
                    }}>
                      {title}
                    </span>
                    <span style={{ color: '#2a3a50', marginLeft: 'auto', fontSize: 9 }}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  {valStr && <div style={s.histValues}>{valStr}</div>}
                  {entry.diceCount > 0 && (
                    <div style={{ color: '#2a4060', fontSize: 8, paddingLeft: 11 }}>
                      {entry.diceCount} dado{entry.diceCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {modal}
    </>
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
  // ── Desktop left panel ─────────────────────────────────────────────────
  panel: {
    position: 'absolute', left: 0, top: 72, bottom: 0, width: 240,
    background: 'rgba(5, 8, 18, 0.95)',
    borderRight: '1px solid #0e2040',
    padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 2,
    backdropFilter: 'blur(14px)',
    fontFamily: font, zIndex: 50, overflowY: 'auto',
  },
  // ── Mobile overlay ─────────────────────────────────────────────────────
  overlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    background: 'rgba(4, 7, 16, 0.93)',
    borderTop: '1px solid #1a3a5a',
    backdropFilter: 'blur(12px)',
    padding: '5px 10px 8px',
    fontFamily: font,
    zIndex: 30,
  },
  // ── Shared ─────────────────────────────────────────────────────────────
  topRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 3,
  },
  susRow: { display: 'flex', alignItems: 'center', gap: 4 },
  susLabel: {
    color: '#44cc88', fontSize: 9, letterSpacing: 2, fontWeight: 700,
  },
  susBtn: {
    fontFamily: font, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#44cc88', padding: '1px 6px',
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
  },
  susBtnActive: { background: '#1a3a20', border: '1px solid #44cc88' },
  undoBtn: {
    fontFamily: font, background: '#1a1828', border: '1px solid #3a2a50',
    borderRadius: 3, color: '#9966cc', padding: '2px 7px',
    fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
    flexShrink: 0,
  },
  animStatus: {
    color: '#4a8aaa', fontSize: 9, fontStyle: 'italic', letterSpacing: 1,
    flex: 1, textAlign: 'center',
  },
  animStatusDesktop: {
    color: '#4a8aaa', fontSize: 9, fontStyle: 'italic',
    letterSpacing: 1, padding: '2px 0 4px',
  },
  totalLabel: { fontSize: 10, letterSpacing: 1, fontFamily: font },
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
  // ── Modal ──────────────────────────────────────────────────────────────
  modalOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500, backdropFilter: 'blur(4px)',
  },
  modalCard: {
    background: 'rgba(6, 10, 22, 0.98)',
    border: '1px solid #1a3a5a', borderRadius: 8,
    padding: '24px 28px', minWidth: 300, maxWidth: 420,
    fontFamily: font, boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
    position: 'relative', display: 'flex', flexDirection: 'column', gap: 12,
  },
  modalClose: {
    position: 'absolute', top: 10, right: 12,
    background: 'none', border: 'none',
    color: '#3a5a7a', fontSize: 16, cursor: 'pointer',
    fontFamily: font, lineHeight: 1,
  },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  modalTime:   { color: '#2a4060', fontSize: 11, letterSpacing: 1 },
  modalGrid:   { display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginTop: 4 },
  modalFaceBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#0d1a30', borderRadius: 6, padding: '10px 14px', gap: 4,
    border: '1px solid #1a3a5a',
  },
  modalEmoji:     { fontSize: 36, lineHeight: 1 },
  modalFaceCount: { color: '#c9a84c', fontSize: 18, fontWeight: 700 },
  modalTotal: {
    color: '#2a4060', fontSize: 11, letterSpacing: 1,
    borderTop: '1px solid #0e2040', paddingTop: 8,
  },
};
