/**
 * LAYER 1/2 — UIControls: Top control bar
 *
 * Desktop (2 rows):
 *   Row 1: Turno | Phase | Color swatches | FX | Repetir
 *   Row 2: Tirar | +ND6 | Count | Lock | Limpiar
 *
 * Mobile (1 compact row):
 *   Tirar | +1 +5 +10 | colors | FX | Lock | Limpiar
 */

'use client';

import type { GamePhase, DieColor, WarhPhase } from '../core/types';
import { WARH_PHASE_LABEL } from '../core/types';

interface UIControlsProps {
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
  onRepeat: () => void;
  onReset: () => void;
  animEnabled: boolean;
  onAnimEnabledChange: (v: boolean) => void;
  isMobile: boolean;
  cameraLocked: boolean;
  onCameraLockChange: (v: boolean) => void;
}

const ADD_PRESETS        = [1, 2, 5, 10, 25];
const ADD_PRESETS_MOBILE = [1, 5, 10];
const TURNS  = [1, 2, 3, 4, 5];
const PHASES = Object.keys(WARH_PHASE_LABEL) as WarhPhase[];

const COLOR_SWATCHES: { id: DieColor; hex: string; label: string }[] = [
  { id: 'white',  hex: '#e8e8e8', label: 'Blanco'   },
  { id: 'blue',   hex: '#2a7a8a', label: 'Azul'     },
  { id: 'red',    hex: '#c03020', label: 'Rojo'     },
  { id: 'green',  hex: '#20a040', label: 'Verde'    },
  { id: 'yellow', hex: '#c9a800', label: 'Amarillo' },
  { id: 'orange', hex: '#c05010', label: 'Naranja'  },
  { id: 'purple', hex: '#8030c0', label: 'Morado'   },
  { id: 'black',  hex: '#1a1a20', label: 'Negro'    },
];

const font = "'Courier New', Courier, monospace";

export function UIControls({
  count, onAddCount,
  dieColor, onColorChange,
  currentTurn, onTurnChange,
  currentPhase, onPhaseChange,
  gamePhase, onThrow, onRepeat, onReset,
  animEnabled, onAnimEnabledChange,
  isMobile, cameraLocked, onCameraLockChange,
}: UIControlsProps) {
  const busy = gamePhase === 'ROLLING' || gamePhase === 'SETTLING' || gamePhase === 'ARRANGING';

  const lockBtn = (
    <button
      style={{ ...s.lockBtn, ...(cameraLocked ? s.lockOn : s.lockOff) }}
      onClick={() => onCameraLockChange(!cameraLocked)}
      title={cameraLocked ? 'Desbloquear cámara' : 'Fijar cámara (bloquear rotación)'}
    >
      {cameraLocked ? '🔒' : '🔓'}
    </button>
  );

  const fxBtn = (
    <button
      style={{ ...s.fxBtn, ...(animEnabled ? s.fxOn : s.fxOff) }}
      onClick={() => onAnimEnabledChange(!animEnabled)}
      title={animEnabled ? 'Desactivar animación' : 'Activar animación'}
    >
      ⚙ FX {animEnabled ? 'ON' : 'OFF'}
    </button>
  );

  if (isMobile) {
    return (
      <div style={s.barMobile}>
        {/* Throw */}
        <button
          style={{ ...s.throwBtnMobile, opacity: count > 0 ? 1 : 0.45 }}
          onClick={onThrow}
          disabled={count === 0 || busy || (gamePhase !== 'PREVIEW' && gamePhase !== 'ARRANGED')}
        >
          ▶ TIRAR
        </button>

        <div style={s.sep} />

        {/* Add presets */}
        {ADD_PRESETS_MOBILE.map(n => (
          <button
            key={n}
            style={s.addBtnMobile}
            onClick={() => onAddCount(n)}
          >
            +{n}
          </button>
        ))}

        {count > 0 && <span style={s.countLabelMobile}>{count}d6</span>}

        <div style={{ flex: 1 }} />

        {/* Color swatches — compact */}
        <div style={s.group}>
          {COLOR_SWATCHES.map(c => (
            <button
              key={c.id}
              title={c.label}
              style={{
                ...s.swatchMobile,
                background: c.hex,
                outline: dieColor === c.id ? '2px solid #fff' : '2px solid transparent',
                outlineOffset: 2,
              }}
              onClick={() => onColorChange(c.id)}
            />
          ))}
        </div>

        <div style={s.sep} />

        {fxBtn}
        {lockBtn}

        {/* Reset */}
        <button style={s.resetBtnMobile} onClick={onReset} title="Limpiar mesa">
          ✕
        </button>
      </div>
    );
  }

  // ── Desktop layout (2 rows) ─────────────────────────────────────────────
  return (
    <div style={s.bar}>
      {/* ── Row 1 ─────────────────────────────────────────────────────── */}
      <div style={s.row1}>
        {/* Turn selector */}
        <div style={s.group}>
          <span style={s.groupLabel}>Turno</span>
          {TURNS.map(t => (
            <button
              key={t}
              style={{ ...s.turnBtn, ...(currentTurn === t ? s.turnActive : {}) }}
              onClick={() => onTurnChange(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={s.sep} />

        {/* Phase buttons */}
        <div style={s.group}>
          {PHASES.map(p => (
            <button
              key={p}
              style={{ ...s.phaseBtn, ...(currentPhase === p ? s.phaseActive : {}) }}
              onClick={() => onPhaseChange(currentPhase === p ? null : p)}
            >
              {WARH_PHASE_LABEL[p]}
            </button>
          ))}
        </div>

        <div style={s.sep} />

        {/* Color swatches */}
        <div style={s.group}>
          <span style={s.groupLabel}>Color</span>
          {COLOR_SWATCHES.map(c => (
            <button
              key={c.id}
              title={c.label}
              style={{
                ...s.swatch,
                background: c.hex,
                outline: dieColor === c.id ? `2px solid #fff` : '2px solid transparent',
                outlineOffset: 2,
              }}
              onClick={() => onColorChange(c.id)}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {fxBtn}

        {/* Repetir */}
        <button
          style={s.repeatBtn}
          onClick={onRepeat}
          disabled={gamePhase !== 'ARRANGED'}
          title="Repetir tirada"
        >
          ↺ Repetir
        </button>
      </div>

      {/* ── Row 2 ─────────────────────────────────────────────────────── */}
      <div style={s.row2}>
        {/* Tirar dados */}
        <button
          style={{ ...s.throwBtn, opacity: count > 0 ? 1 : 0.45 }}
          onClick={onThrow}
          disabled={count === 0 || busy || (gamePhase !== 'PREVIEW' && gamePhase !== 'ARRANGED')}
        >
          ▶ TIRAR DADOS
        </button>

        <div style={s.sep} />

        {/* +ND6 additive buttons */}
        <div style={s.group}>
          {ADD_PRESETS.map(n => (
            <button
              key={n}
              style={s.addBtn}
              onClick={() => onAddCount(n)}
              title={`Agregar ${n} dado${n > 1 ? 's' : ''}`}
            >
              +{n}D6
            </button>
          ))}
        </div>

        {count > 0 && (
          <span style={s.countLabel}>{count}d6</span>
        )}

        <div style={{ flex: 1 }} />

        {lockBtn}

        {/* Limpiar mesa */}
        <button style={s.resetBtn} onClick={onReset} title="Limpiar mesa">
          ✕ Limpiar
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    background: 'rgba(8, 10, 20, 0.97)',
    borderBottom: '1px solid #1a2a40',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font,
    zIndex: 100,
    boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
    userSelect: 'none',
  },
  barMobile: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 52,
    background: 'rgba(8, 10, 20, 0.97)',
    borderBottom: '1px solid #1a2a40',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 5,
    fontFamily: font,
    zIndex: 100,
    boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
    userSelect: 'none',
    overflowX: 'auto',
  },
  row1: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px',
    gap: 6,
    borderBottom: '1px solid #0e1c30',
    minHeight: 36,
  },
  row2: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px',
    gap: 6,
    minHeight: 36,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  groupLabel: {
    color: '#3a5a7a',
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginRight: 2,
  },
  sep: {
    width: 1,
    height: 20,
    background: '#0e2040',
    margin: '0 4px',
    flexShrink: 0,
  },
  turnBtn: {
    fontFamily: font,
    background: '#0d1a2e',
    border: '1px solid #152a44',
    borderRadius: 3,
    color: '#6080a0',
    padding: '2px 7px',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.1s',
  },
  turnActive: {
    background: '#00d4ff1a',
    border: '1px solid #00d4ff',
    color: '#00d4ff',
  },
  phaseBtn: {
    fontFamily: font,
    background: '#0d1a2e',
    border: '1px solid #152a44',
    borderRadius: 3,
    color: '#5070a0',
    padding: '2px 8px',
    fontSize: 10,
    cursor: 'pointer',
    letterSpacing: 0.5,
    transition: 'all 0.1s',
  },
  phaseActive: {
    background: '#c9a84c22',
    border: '1px solid #c9a84c',
    color: '#c9a84c',
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 3,
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'outline 0.1s',
  },
  swatchMobile: {
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'outline 0.1s',
  },
  repeatBtn: {
    fontFamily: font,
    background: '#1a2030',
    border: '1px solid #2a3a50',
    borderRadius: 4,
    color: '#6080a0',
    padding: '3px 10px',
    fontSize: 10,
    cursor: 'pointer',
    letterSpacing: 1,
    fontWeight: 700,
  },
  throwBtn: {
    fontFamily: font,
    background: '#00d4ff',
    border: 'none',
    borderRadius: 4,
    color: '#000c14',
    padding: '5px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    minWidth: 130,
  },
  throwBtnMobile: {
    fontFamily: font,
    background: '#00d4ff',
    border: 'none',
    borderRadius: 4,
    color: '#000c14',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    flexShrink: 0,
    minHeight: 36,
  },
  addBtn: {
    fontFamily: font,
    background: '#0d1a2e',
    border: '1px solid #152a44',
    borderRadius: 3,
    color: '#44cc88',
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.5,
    transition: 'all 0.1s',
  },
  addBtnMobile: {
    fontFamily: font,
    background: '#0d1a2e',
    border: '1px solid #152a44',
    borderRadius: 3,
    color: '#44cc88',
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    minHeight: 36,
  },
  countLabel: {
    color: '#c9a84c',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    marginLeft: 6,
  },
  countLabelMobile: {
    color: '#c9a84c',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    flexShrink: 0,
  },
  resetBtn: {
    fontFamily: font,
    background: '#1a1018',
    border: '1px solid #3a1020',
    borderRadius: 4,
    color: '#aa4040',
    padding: '3px 10px',
    fontSize: 10,
    cursor: 'pointer',
    letterSpacing: 1,
    fontWeight: 700,
  },
  resetBtnMobile: {
    fontFamily: font,
    background: '#1a1018',
    border: '1px solid #3a1020',
    borderRadius: 4,
    color: '#aa4040',
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 700,
    flexShrink: 0,
    minHeight: 36,
  },
  fxBtn: {
    fontFamily: font,
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 10,
    cursor: 'pointer',
    letterSpacing: 1,
    fontWeight: 700,
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  fxOn: {
    background: '#001a1a',
    border: '1px solid #00aabb',
    color: '#00ccdd',
  },
  fxOff: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#555',
  },
  lockBtn: {
    fontFamily: font,
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
    lineHeight: 1,
  },
  lockOn: {
    background: '#1a1000',
    border: '1px solid #aa8800',
    color: '#ffcc00',
  },
  lockOff: {
    background: '#0d1a2e',
    border: '1px solid #152a44',
    color: '#4a6a8a',
  },
};
