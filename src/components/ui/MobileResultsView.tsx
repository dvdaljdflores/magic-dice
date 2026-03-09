/**
 * MobileResultsView — Mobile results layout
 *
 * Includes: action strip (ARRANGED), toggle chip, collapsible results sheet.
 */

'use client';

import { useState, useEffect } from 'react';
import type {
  DiceRollResult,
  DieColor,
  GamePhase,
  SustainedX,
  RollHistoryEntry,
} from '../../core/types';

import { FONT_FAMILY, COLOR_HEX, FACES } from '../../constants/theme';
import { getFaceCount } from '../../core/DiceCalculations';
import { faceEmoji, spinningLabel } from '../../core/formatUtils';

import { ResultsTable } from './ResultsTable';
import { HistoryModal } from './HistoryModal';

interface MobileResultsViewProps {
  rollResult: DiceRollResult | null;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
  dieColor: DieColor;
  gamePhase: GamePhase;
  sustainedX: SustainedX;
  history: RollHistoryEntry[];

  onSustainedXChange: (x: SustainedX) => void;
  onDelete: (v: number) => void;
  onReroll: (v: number) => void;
  onSustainedHits: (v: number) => void;
  onToggleLethal: (v: number) => void;

  onUndo: () => void;
  canUndo: boolean;
  mobileBarH: number;
}

export function MobileResultsView({
  rollResult,
  activeMask,
  lethalMask,
  dieColor,
  gamePhase,
  sustainedX,
  history,
  onSustainedXChange,
  onDelete,
  onReroll,
  onSustainedHits,
  onToggleLethal,
  onUndo,
  canUndo,
  mobileBarH,
}: MobileResultsViewProps) {

  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalEntry, setModalEntry] = useState<RollHistoryEntry | null>(null);

  const dipColor = COLOR_HEX[dieColor];
  const hasResult = rollResult !== null;

  const inArranged = gamePhase === 'ARRANGED';

  const busy =
    gamePhase === 'ROLLING' ||
    gamePhase === 'SETTLING' ||
    gamePhase === 'ARRANGING';

  useEffect(() => {
    if (gamePhase === 'ROLLING') {
      setSheetOpen(false);
    }
  }, [gamePhase]);

  const fc = (v: number) => getFaceCount(rollResult, activeMask, v);

  const totalActive = FACES.reduce((acc, v) => acc + fc(v), 0);

  const tableProps = {
    rollResult,
    activeMask,
    lethalMask,
    dipColor,
    busy,
    hasResult,
    inArranged,
    sustainedX,
    onDelete,
    onReroll,
    onSustainedHits,
    onToggleLethal,
  };

  if (!hasResult) return null;

  return (
    <>
      {/* Floating action strip */}
      {inArranged && (
        <div style={{ ...s.actionStrip, top: mobileBarH + 8 }}>
          {FACES.map((v) => {
            const cnt = fc(v);
            if (cnt === 0) return null;

            return (
              <div key={v} style={s.actionRow}>
                <span style={{ color: dipColor, fontSize: 13 }}>
                  {faceEmoji(v)}
                </span>

                <span style={s.actionCnt}>{cnt}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toggle chip */}
      {!sheetOpen && (
        <div style={s.chipWrap}>
          <button
            style={s.toggleChip}
            onPointerDown={() => setSheetOpen(true)}
          >
            {busy
              ? spinningLabel(gamePhase)
              : `≡  ${totalActive} dados`}
          </button>
        </div>
      )}

      {/* Results sheet */}
      {sheetOpen && (
        <div style={s.mobileSheet}>

          <div style={s.sheetHeader}>

            <div style={s.susRow}>
              <span style={s.susLabel}>SUS×</span>

              {([1, 2, 3] as SustainedX[]).map((x) => (
                <button
                  key={x}
                  style={{
                    ...s.susBtn,
                    ...(sustainedX === x ? s.susBtnActive : {}),
                  }}
                  onPointerDown={() => onSustainedXChange(x)}
                >
                  {x}
                </button>
              ))}
            </div>

            {busy && (
              <span style={s.animStatus}>
                {spinningLabel(gamePhase)}
              </span>
            )}

            {inArranged && (
              <span style={s.totalLabel}>
                <span style={{ color: '#3a5a7a' }}>
                  TOTAL
                </span>

                <span style={{ color: '#c9a84c', fontWeight: 700 }}>
                  {totalActive}
                </span>
              </span>
            )}

            <button
              style={{
                ...s.undoBtn,
                opacity: canUndo ? 1 : 0.35,
              }}
              disabled={!canUndo}
              onPointerDown={onUndo}
            >
              ↩
            </button>

            <button
              style={s.sheetClose}
              onPointerDown={() => setSheetOpen(false)}
            >
              ✕
            </button>

          </div>

          <ResultsTable {...tableProps} compact />

        </div>
      )}

      {/* History modal */}
      {modalEntry && (
        <HistoryModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
        />
      )}

    </>
  );
}

const s: Record<string, React.CSSProperties> = {

  actionStrip: {
    position: 'absolute',
    right: 8,
    background: 'rgba(4, 7, 16, 0.85)',
    border: '1px solid #1a3a5a',
    borderRadius: 6,
    padding: '5px 6px',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    backdropFilter: 'blur(8px)',
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
  },

  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  actionCnt: {
    color: '#c9a84c',
    fontSize: 11,
    fontWeight: 700,
    minWidth: 14,
    fontFamily: FONT_FAMILY,
  },

  chipWrap: {
    position: 'absolute',
    bottom: 'calc(20px + env(safe-area-inset-bottom))',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 35,
    pointerEvents: 'none',
  },

  toggleChip: {
    fontFamily: FONT_FAMILY,
    background: 'rgba(4, 7, 16, 0.88)',
    border: '1px solid #2a4a6a',
    borderRadius: 20,
    color: '#6a9aaa',
    padding: '6px 20px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    cursor: 'pointer',
    pointerEvents: 'auto',
  },

  mobileSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(4, 7, 16, 0.96)',
    borderTop: '1px solid #1a3a5a',
    backdropFilter: 'blur(12px)',
    fontFamily: FONT_FAMILY,
    zIndex: 40,
    maxHeight: '50vh',
    overflowY: 'auto',
    padding: '6px 12px 24px',
  },

  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },

  sheetClose: {
    marginLeft: 'auto',
    fontFamily: FONT_FAMILY,
    background: 'none',
    border: '1px solid #2a2a3a',
    borderRadius: 4,
    color: '#6a6a8a',
    padding: '2px 8px',
    fontSize: 12,
    cursor: 'pointer',
  },

  susRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  susLabel: {
    color: '#44cc88',
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: 700,
  },

  susBtn: {
    fontFamily: FONT_FAMILY,
    background: '#0d1a2e',
    border: '1px solid #152a44',
    borderRadius: 3,
    color: '#44cc88',
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },

  susBtnActive: {
    background: '#1a3a20',
    border: '1px solid #44cc88',
  },

  undoBtn: {
    fontFamily: FONT_FAMILY,
    background: '#1a1828',
    border: '1px solid #3a2a50',
    borderRadius: 3,
    color: '#9966cc',
    padding: '2px 7px',
    fontSize: 9,
    fontWeight: 700,
    cursor: 'pointer',
  },

  animStatus: {
    color: '#4a8aaa',
    fontSize: 9,
    fontStyle: 'italic',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },

  totalLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: FONT_FAMILY,
  },
};