/**
 * MobileControlBar — Two compact rows for mobile
 *
 * Row 1: TIRAR | +1 +5 +10 | Nd6 | ✕ Reset
 * Row 2: Colors | T▾ | F▾ | ✦▾ | FX | 🔒
 */

'use client';

import { useState } from 'react';
import type { GamePhase, DieColor, WarhPhase, RollHistoryEntry } from '../../core/types';
import { WARH_PHASE_LABEL } from '../../core/types';
import { FONT_FAMILY, COLOR_SWATCHES } from '../../constants/theme';
import { formatTime, formatHistShort, phaseShort } from '../../core/formatUtils';

interface MobileControlBarProps {
  count: number;
  onAddCount: (n: number) => void;
  dieColor: DieColor;
  onColorChange: (c: DieColor) => void;
  currentTurn: number;
  onTurnChange: (t: number) => void;
  currentPhase: WarhPhase | null;
  onPhaseChange: (p: WarhPhase | null) => void;
  gamePhase: GamePhase;
  onThrow: () => void;
  onReset: () => void;
  animEnabled: boolean;
  onAnimEnabledChange: (v: boolean) => void;
  cameraLocked: boolean;
  onCameraLockChange: (v: boolean) => void;
  history: RollHistoryEntry[];
}

const ADD_PRESETS = [1, 5, 10];
const PHASES = Object.keys(WARH_PHASE_LABEL) as WarhPhase[];

export function MobileControlBar({
  count, onAddCount, dieColor, onColorChange,
  currentTurn, onTurnChange, currentPhase, onPhaseChange,
  gamePhase, onThrow, onReset,
  animEnabled, onAnimEnabledChange,
  cameraLocked, onCameraLockChange, history,
}: MobileControlBarProps) {
  const [turnOpen,  setTurnOpen]  = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [histOpen,  setHistOpen]  = useState(false);

  const busy = gamePhase === 'ROLLING' || gamePhase === 'SETTLING' || gamePhase === 'ARRANGING';

  return (
    <div style={s.bar}>
      {/* Row 1: Primary actions */}
      <div style={s.row}>
        <button
          style={{ ...s.throwBtn, opacity: count > 0 ? 1 : 0.45 }}
          onClick={onThrow}
          disabled={count === 0 || busy || (gamePhase !== 'PREVIEW' && gamePhase !== 'ARRANGED')}
        >▶ TIRAR</button>

        <div style={s.sep} />

        {ADD_PRESETS.map(n => (
          <button key={n} style={s.addBtn} onClick={() => onAddCount(n)}>+{n}</button>
        ))}

        {count > 0 && <span style={s.countLabel}>{count}d6</span>}

        <div style={{ flex: 1 }} />

        <button style={s.resetBtn} onClick={onReset} title="Limpiar mesa">✕</button>
      </div>

      {/* Row 2: Secondary controls */}
      <div style={{ ...s.row, borderTop: '1px solid #0e1c30' }}>
        {COLOR_SWATCHES.map(c => (
          <button
            key={c.id}
            title={c.label}
            style={{
              ...s.swatch,
              background: c.hex,
              outline: dieColor === c.id ? '2px solid #fff' : '2px solid transparent',
              outlineOffset: 1,
            }}
            onClick={() => onColorChange(c.id)}
          />
        ))}

        <div style={s.sep} />

        {/* Turn dropdown */}
        <div style={s.dropWrap}>
          <button
            style={{ ...s.dropBtn, ...(turnOpen ? s.dropBtnOpen : {}) }}
            onClick={() => { setTurnOpen(o => !o); setPhaseOpen(false); setHistOpen(false); }}
          >T{currentTurn} ▾</button>
          {turnOpen && (
            <div style={{ ...s.dropMenu, left: 0 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(t => (
                <button key={t} style={s.dropItem} onClick={() => { onTurnChange(t); setTurnOpen(false); }}>
                  Turno {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phase dropdown */}
        <div style={s.dropWrap}>
          <button
            style={{ ...s.dropBtn, ...(phaseOpen ? s.dropBtnOpen : {}), ...(currentPhase ? s.dropBtnActive : {}) }}
            onClick={() => { setPhaseOpen(o => !o); setTurnOpen(false); setHistOpen(false); }}
          >{phaseShort(currentPhase)} ▾</button>
          {phaseOpen && (
            <div style={{ ...s.dropMenu, left: 0, minWidth: 160 }}>
              <button
                style={{ ...s.dropItem, ...(currentPhase === null ? s.dropItemActive : {}) }}
                onClick={() => { onPhaseChange(null); setPhaseOpen(false); }}
              >— ninguna —</button>
              {PHASES.map(p => (
                <button
                  key={p}
                  style={{ ...s.dropItem, ...(currentPhase === p ? s.dropItemActive : {}) }}
                  onClick={() => { onPhaseChange(p); setPhaseOpen(false); }}
                >{WARH_PHASE_LABEL[p]}</button>
              ))}
            </div>
          )}
        </div>

        {/* History dropdown */}
        <div style={s.dropWrap}>
          <button
            style={{ ...s.dropBtn, ...(histOpen ? s.dropBtnOpen : {}) }}
            onClick={() => { setHistOpen(o => !o); setTurnOpen(false); setPhaseOpen(false); }}
          >✦ ▾</button>
          {histOpen && (
            <div style={{ ...s.dropMenu, right: 0, left: 'auto', width: 260, maxHeight: 360, overflowY: 'auto' }}>
              <div style={s.histHead}>HISTORIAL</div>
              {history.length === 0 ? (
                <div style={s.histEmpty}>sin tiradas aún</div>
              ) : (
                [...history].reverse().map(entry => {
                  const isAction = !!entry.actionLabel;
                  const title = isAction
                    ? entry.actionLabel!
                    : `T${entry.turn}${entry.isReroll ? ' · rep.' : ''}`;
                  return (
                    <div key={entry.id} style={s.histItem}>
                      <div style={s.histItemRow}>
                        <span style={{
                          color: isAction ? '#9966cc' : entry.isReroll ? '#c9a84c' : '#4a7aaa',
                          fontSize: 10, fontWeight: 700,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{title}</span>
                        <span style={{ color: '#2a3a50', fontSize: 9, flexShrink: 0 }}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      {entry.values.length > 0 && (
                        <div style={{ color: '#2a4060', fontSize: 9, marginTop: 1 }}>
                          {formatHistShort(entry.values)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <button
          style={{ ...s.fxBtn, ...(animEnabled ? s.fxOn : s.fxOff) }}
          onClick={() => onAnimEnabledChange(!animEnabled)}
        >FX</button>

        <button
          style={{ ...s.lockBtn, ...(cameraLocked ? s.lockOn : s.lockOff) }}
          onClick={() => onCameraLockChange(!cameraLocked)}
        >{cameraLocked ? '🔒' : '🔓'}</button>
      </div>
    </div>
  );
}

const f = FONT_FAMILY;

const s: Record<string, React.CSSProperties> = {
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    background: 'rgba(8, 10, 20, 0.97)',
    borderBottom: '1px solid #1a2a40',
    backdropFilter: 'blur(10px)',
    display: 'flex', flexDirection: 'column',
    fontFamily: f, zIndex: 100,
    boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
    userSelect: 'none',
  },
  row: {
    display: 'flex', alignItems: 'center',
    padding: '4px 8px', gap: 5,
    minHeight: 36,
  },
  throwBtn: {
    fontFamily: f, background: '#00d4ff', border: 'none',
    borderRadius: 4, color: '#000c14',
    padding: '6px 12px', fontSize: 12,
    fontWeight: 700, letterSpacing: 1,
    cursor: 'pointer', transition: 'opacity 0.15s',
    flexShrink: 0,
  },
  sep: { width: 1, height: 18, background: '#0e2040', margin: '0 2px', flexShrink: 0 },
  addBtn: {
    fontFamily: f, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#44cc88',
    padding: '4px 8px', fontSize: 11,
    fontWeight: 700, cursor: 'pointer',
    flexShrink: 0,
  },
  countLabel: { color: '#c9a84c', fontSize: 12, fontWeight: 700, letterSpacing: 1, flexShrink: 0 },
  resetBtn: {
    fontFamily: f, background: '#1a1018', border: '1px solid #3a1020',
    borderRadius: 4, color: '#aa4040',
    padding: '4px 10px', fontSize: 12,
    cursor: 'pointer', fontWeight: 700,
    flexShrink: 0,
  },
  swatch: {
    width: 16, height: 16, borderRadius: 3, border: 'none',
    cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'outline 0.1s',
  },
  dropWrap: { position: 'relative', zIndex: 2000 },
  dropBtn: {
    fontFamily: f, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 4, color: '#4a7aaa',
    padding: '3px 8px', fontSize: 10,
    fontWeight: 700, cursor: 'pointer',
    letterSpacing: 0.5, whiteSpace: 'nowrap',
    transition: 'all 0.1s', flexShrink: 0,
  },
  dropBtnOpen: { border: '1px solid #00d4ff66', color: '#00d4ff', background: '#001a2e' },
  dropBtnActive: { border: '1px solid #c9a84c88', color: '#c9a84c', background: '#120e00' },
  dropMenu: {
    position: 'absolute', top: 'calc(100% + 3px)', zIndex: 3000,
    background: 'rgba(6, 10, 22, 0.98)',
    border: '1px solid #1a3a5a', borderRadius: 4,
    minWidth: 100, boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
    overflow: 'hidden', fontFamily: f,
  },
  dropItem: {
    display: 'block', width: '100%',
    background: 'none', border: 'none',
    borderBottom: '1px solid #0a1828',
    color: '#4a6a8a', fontFamily: f,
    fontSize: 10, fontWeight: 700,
    padding: '7px 12px', textAlign: 'left',
    cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap',
  },
  dropItemActive: { color: '#00d4ff', background: '#001a2a' },
  histHead: {
    padding: '5px 12px', borderBottom: '1px solid #0e2040',
    color: '#2a4a6a', fontSize: 9, letterSpacing: 3, fontWeight: 700, fontFamily: f,
  },
  histEmpty: { color: '#2a3a50', fontSize: 10, padding: '8px 12px', fontFamily: f, fontStyle: 'italic' },
  histItem: { padding: '5px 12px', borderBottom: '1px solid #0a1520', fontFamily: f },
  histItemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  fxBtn: {
    fontFamily: f, borderRadius: 4, padding: '3px 7px', fontSize: 9,
    cursor: 'pointer', letterSpacing: 1, fontWeight: 700,
    transition: 'all 0.15s', flexShrink: 0,
  },
  fxOn:  { background: '#001a1a', border: '1px solid #00aabb', color: '#00ccdd' },
  fxOff: { background: '#1a1a1a', border: '1px solid #333', color: '#555' },
  lockBtn: {
    fontFamily: f, borderRadius: 4, padding: '3px 6px', fontSize: 13,
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, lineHeight: 1,
  },
  lockOn:  { background: '#1a1000', border: '1px solid #aa8800', color: '#ffcc00' },
  lockOff: { background: '#0d1a2e', border: '1px solid #152a44', color: '#4a6a8a' },
};
