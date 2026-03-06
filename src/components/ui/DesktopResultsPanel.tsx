/**
 * DesktopResultsPanel — Left sidebar with results table + history
 */

'use client';

import { useState } from 'react';
import type {
  DiceRollResult, DieColor, RollHistoryEntry, GamePhase, SustainedX,
} from '../../core/types';
import { FONT_FAMILY, COLOR_HEX, FACES } from '../../constants/theme';
import { getFaceCount } from '../../core/DiceCalculations';
import {
  formatTime, formatHistoryValues, phaseLabel, spinningLabel,
} from '../../core/formatUtils';
import { ResultsTable } from './ResultsTable';
import { HistoryModal } from './HistoryModal';

interface DesktopResultsPanelProps {
  rollResult:  DiceRollResult | null;
  activeMask:  boolean[] | null;
  lethalMask:  boolean[] | null;
  dieColor:    DieColor;
  history:     RollHistoryEntry[];
  gamePhase:   GamePhase;
  sustainedX:  SustainedX;
  onSustainedXChange: (x: SustainedX) => void;
  onDelete:    (v: number) => void;
  onReroll:    (v: number) => void;
  onSustainedHits: (v: number) => void;
  onToggleLethal:  (v: number) => void;
  onUndo:      () => void;
  canUndo:     boolean;
}

export function DesktopResultsPanel({
  rollResult, activeMask, lethalMask, dieColor, history, gamePhase,
  sustainedX, onSustainedXChange,
  onDelete, onReroll, onSustainedHits, onToggleLethal,
  onUndo, canUndo,
}: DesktopResultsPanelProps) {
  const [modalEntry, setModalEntry] = useState<RollHistoryEntry | null>(null);

  const dipColor   = COLOR_HEX[dieColor];
  const hasResult  = rollResult !== null;
  const inArranged = gamePhase === 'ARRANGED';
  const busy       = gamePhase === 'ROLLING' || gamePhase === 'SETTLING' || gamePhase === 'ARRANGING';

  const fc = (v: number) => getFaceCount(rollResult, activeMask, v);
  const totalActive = FACES.reduce((acc, v) => acc + fc(v), 0);

  const tableProps = {
    rollResult, activeMask, lethalMask, dipColor,
    busy, hasResult, inArranged, sustainedX,
    onDelete, onReroll, onSustainedHits, onToggleLethal,
  };

  return (
    <>
      <div style={s.panel}>
        {/* SUS × + Undo */}
        <div style={s.topRow}>
          <div style={s.susRow}>
            <span style={s.susLabel}>SUS ×</span>
            {([1, 2, 3] as SustainedX[]).map(x => (
              <button
                key={x}
                style={{ ...s.susBtn, ...(sustainedX === x ? s.susBtnActive : {}) }}
                onClick={() => onSustainedXChange(x)}
              >{x}</button>
            ))}
          </div>

          <button
            style={{ ...s.undoBtn, opacity: canUndo ? 1 : 0.35 }}
            disabled={!canUndo}
            onClick={onUndo}
            title={canUndo ? 'Deshacer última acción' : 'Nada que deshacer (solo del/roll/let/sus)'}
          >↩ Regresar</button>
        </div>

        <div style={s.sectionHead}>RESULTADO</div>

        {busy && <div style={s.animStatus}>{spinningLabel(gamePhase)}</div>}

        <ResultsTable {...tableProps} />

        {inArranged && hasResult && (
          <div style={s.total}>
            <span style={{ color: '#3a5a7a' }}>TOTAL ACTIVOS</span>
            <span style={{ color: '#c9a84c', fontWeight: 700 }}>{totalActive}</span>
          </div>
        )}

        {/* History */}
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

      {modalEntry && (
        <HistoryModal entry={modalEntry} onClose={() => setModalEntry(null)} />
      )}
    </>
  );
}

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
    fontFamily: FONT_FAMILY, zIndex: 50, overflowY: 'auto',
  },
  topRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 3,
  },
  susRow: { display: 'flex', alignItems: 'center', gap: 4 },
  susLabel: { color: '#44cc88', fontSize: 9, letterSpacing: 2, fontWeight: 700 },
  susBtn: {
    fontFamily: FONT_FAMILY, background: '#0d1a2e',
    border: '1px solid #152a44', borderRadius: 3,
    color: '#44cc88', padding: '1px 6px',
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
  },
  susBtnActive: { background: '#1a3a20', border: '1px solid #44cc88' },
  undoBtn: {
    fontFamily: FONT_FAMILY, background: '#1a1828',
    border: '1px solid #3a2a50', borderRadius: 3,
    color: '#9966cc', padding: '2px 7px',
    fontSize: 9, fontWeight: 700, cursor: 'pointer',
    letterSpacing: 0.5, flexShrink: 0,
  },
  sectionHead: {
    color: '#2a4a6a', fontSize: 9, letterSpacing: 3, fontWeight: 700,
    paddingBottom: 3, borderBottom: '1px solid #0e2040', marginBottom: 2,
  },
  animStatus: {
    color: '#4a8aaa', fontSize: 9, fontStyle: 'italic',
    letterSpacing: 1, padding: '2px 0 4px',
  },
  total: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 10, letterSpacing: 2, paddingTop: 3, fontFamily: FONT_FAMILY,
  },
  histEmpty: { color: '#1e2e3e', fontSize: 10, fontStyle: 'italic', padding: '4px 0' },
  histList: { display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' },
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
