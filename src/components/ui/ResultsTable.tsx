/**
 * ResultsTable — Shared face-value results table with action buttons
 *
 * Used by both desktop and mobile ResultsPanel variants.
 * `compact` mode uses abbreviated labels and smaller sizing for mobile.
 */

'use client';

import type { DiceRollResult, SustainedX } from '../../core/types';
import { FONT_FAMILY, FACES } from '../../constants/theme';
import {
  getFaceCount, getRerollableCount, getLethalCount,
  isGroupLethal, getDeleteableCount, getRerollableBelowCount,
} from '../../core/DiceCalculations';
import { faceEmoji } from '../../core/formatUtils';

interface ResultsTableProps {
  rollResult:  DiceRollResult | null;
  activeMask:  boolean[] | null;
  lethalMask:  boolean[] | null;
  dipColor:    string;
  busy:        boolean;
  hasResult:   boolean;
  inArranged:  boolean;
  sustainedX:  SustainedX;
  onDelete:    (v: number) => void;
  onReroll:    (v: number) => void;
  onSustainedHits: (v: number) => void;
  onToggleLethal:  (v: number) => void;
  compact?:    boolean;
}

export function ResultsTable({
  rollResult, activeMask, lethalMask, dipColor,
  busy, hasResult, inArranged, sustainedX,
  onDelete, onReroll, onSustainedHits, onToggleLethal,
  compact = false,
}: ResultsTableProps) {
  const fc  = (v: number) => getFaceCount(rollResult, activeMask, v);
  const rc  = (v: number) => getRerollableCount(rollResult, activeMask, lethalMask, v);
  const lc  = (v: number) => getLethalCount(rollResult, activeMask, lethalMask, v);
  const gl  = (v: number) => isGroupLethal(rollResult, activeMask, lethalMask, v);
  const dc  = (v: number) => getDeleteableCount(rollResult, activeMask, v);
  const rbc = (v: number) => getRerollableBelowCount(rollResult, activeMask, lethalMask, v);

  const btnStyle = compact ? s.mActBtn : s.actBtn;

  return (
    <table style={s.table}>
      <tbody>
        {FACES.map(v => {
          const cnt         = fc(v);
          const rerollable  = rc(v);
          const lethalCnt   = lc(v);
          const groupLethal = gl(v);
          const delCount    = dc(v);
          const rollCount   = rbc(v);

          return (
            <tr key={v} style={s.row}>
              <td style={s.face}>
                <span style={{ color: dipColor, fontSize: compact ? 14 : 16, lineHeight: 1 }}>
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
                  style={{ ...btnStyle, color: hasResult && delCount > 0 && !busy ? '#ff5555' : '#2a3a50' }}
                  title={`Eliminar todos los dados ≤${v} (${delCount})`}
                  onClick={() => onDelete(v)}
                  disabled={busy || !hasResult || delCount === 0}
                >{compact ? 'DEL' : 'del'}</button>
                <button
                  style={{ ...btnStyle, color: hasResult && rollCount > 0 && !busy ? '#00d4ff' : '#2a3a50' }}
                  title={`Re-tirar dados ≤${v} (${rollCount})`}
                  onClick={() => onReroll(v)}
                  disabled={busy || !hasResult || rollCount === 0}
                >{compact ? 'R' : 'roll'}</button>
                <button
                  style={{ ...btnStyle, color: inArranged && rerollable > 0 ? '#44cc88' : '#2a3a50' }}
                  title={`Sustained Hits ×${sustainedX} para ${v}s`}
                  onClick={() => onSustainedHits(v)}
                  disabled={!inArranged || rerollable === 0}
                >{compact ? 'S' : 'sus'}</button>
                <button
                  style={{
                    ...btnStyle,
                    color: groupLethal ? '#cc44ff' : hasResult && cnt > 0 && !busy ? '#884488' : '#2a3a50',
                    fontWeight: groupLethal ? 900 : 700,
                  }}
                  title={groupLethal ? `Quitar lethal de ${v}s` : `Marcar ${v}s como Mortal Wounds`}
                  onClick={() => onToggleLethal(v)}
                  disabled={busy || !hasResult || cnt === 0}
                >{groupLethal ? (compact ? '☠L' : '☠let') : (compact ? 'L' : 'let')}</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const s: Record<string, React.CSSProperties> = {
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
    fontFamily: FONT_FAMILY, fontWeight: 700, letterSpacing: 0.5,
    cursor: 'pointer', padding: '1px 3px',
    textTransform: 'uppercase' as const,
  },
  mActBtn: {
    background: 'none', border: 'none',
    fontSize: 13, fontFamily: FONT_FAMILY,
    fontWeight: 700, cursor: 'pointer',
    padding: '4px 6px', letterSpacing: 0.3,
    textTransform: 'uppercase' as const, lineHeight: 1,
    minHeight: 28,
  },
};
