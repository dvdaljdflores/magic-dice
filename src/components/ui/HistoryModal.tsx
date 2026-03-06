/**
 * HistoryModal — Full-screen overlay showing details of a single roll history entry
 */

'use client';

import type { RollHistoryEntry } from '../../core/types';
import { FONT_FAMILY } from '../../constants/theme';
import { faceEmoji, formatTime, phaseLabel } from '../../core/formatUtils';

interface HistoryModalProps {
  entry: RollHistoryEntry;
  onClose: () => void;
}

export function HistoryModal({ entry, onClose }: HistoryModalProps) {
  const pLabel   = phaseLabel(entry.phase);
  const isAction = !!entry.actionLabel;
  const title    = isAction
    ? entry.actionLabel!
    : `Turno ${entry.turn}${pLabel ? ` · ${pLabel}` : ''}${entry.isReroll ? ' · Repetida' : ''}`;

  const counts: Record<number, number> = {};
  for (const v of entry.values) counts[v] = (counts[v] ?? 0) + 1;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={e => e.stopPropagation()}>
        <button style={s.close} onClick={onClose}>✕</button>
        <div style={s.header}>
          <span style={{
            color: isAction ? '#9966cc' : entry.isReroll ? '#c9a84c' : '#4a7aaa',
            fontSize: 14, fontWeight: 700,
          }}>
            {title}
          </span>
        </div>
        <div style={s.time}>{formatTime(entry.timestamp)}</div>
        <div style={s.grid}>
          {[1,2,3,4,5,6].filter(v => counts[v]).map(v => (
            <div key={v} style={s.faceBox}>
              <span style={s.emoji}>{faceEmoji(v)}</span>
              <span style={s.faceCount}>×{counts[v]}</span>
            </div>
          ))}
        </div>
        {entry.diceCount > 0 && (
          <div style={s.total}>
            {entry.diceCount} dado{entry.diceCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500, backdropFilter: 'blur(4px)',
  },
  card: {
    background: 'rgba(6, 10, 22, 0.98)',
    border: '1px solid #1a3a5a', borderRadius: 8,
    padding: '24px 28px', minWidth: 300, maxWidth: 420,
    fontFamily: FONT_FAMILY, boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
    position: 'relative', display: 'flex', flexDirection: 'column', gap: 12,
  },
  close: {
    position: 'absolute', top: 10, right: 12,
    background: 'none', border: 'none',
    color: '#3a5a7a', fontSize: 16, cursor: 'pointer',
    fontFamily: FONT_FAMILY, lineHeight: 1,
  },
  header: { display: 'flex', alignItems: 'center', gap: 8 },
  time:   { color: '#2a4060', fontSize: 11, letterSpacing: 1 },
  grid:   { display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginTop: 4 },
  faceBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#0d1a30', borderRadius: 6, padding: '10px 14px', gap: 4,
    border: '1px solid #1a3a5a',
  },
  emoji:     { fontSize: 36, lineHeight: 1 },
  faceCount: { color: '#c9a84c', fontSize: 18, fontWeight: 700 },
  total: {
    color: '#2a4060', fontSize: 11, letterSpacing: 1,
    borderTop: '1px solid #0e2040', paddingTop: 8,
  },
};
