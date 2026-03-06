/**
 * DesktopControlBar — Two-row control bar for desktop
 *
 * Row 1: Turn buttons | Phase buttons | Color swatches | FX | Repeat
 * Row 2: Throw | +ND6 presets | Count | Lock | Reset
 */

'use client';

import type { GamePhase, DieColor, WarhPhase } from '../../core/types';
import { WARH_PHASE_LABEL } from '../../core/types';
import { FONT_FAMILY, COLOR_SWATCHES } from '../../constants/theme';
import { phaseShort } from '../../core/formatUtils';

interface DesktopControlBarProps {
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
  cameraLocked: boolean;
  onCameraLockChange: (v: boolean) => void;
}

const ADD_PRESETS = [1, 2, 5, 10, 25];
const TURNS  = [1, 2, 3, 4, 5];
const PHASES = Object.keys(WARH_PHASE_LABEL) as WarhPhase[];

export function DesktopControlBar({
  count, onAddCount, dieColor, onColorChange,
  currentTurn, onTurnChange, currentPhase, onPhaseChange,
  gamePhase, onThrow, onRepeat, onReset,
  animEnabled, onAnimEnabledChange,
  cameraLocked, onCameraLockChange,
}: DesktopControlBarProps) {
  const busy = gamePhase === 'ROLLING' || gamePhase === 'SETTLING' || gamePhase === 'ARRANGING';

  return (
    <div style={s.bar}>
      {/* Row 1 */}
      <div style={s.row1}>
        <div style={s.group}>
          <span style={s.groupLabel}>Turno</span>
          {TURNS.map(t => (
            <button
              key={t}
              style={{ ...s.turnBtn, ...(currentTurn === t ? s.turnBtnActive : {}) }}
              onClick={() => onTurnChange(t)}
              title={`Turno ${t}`}
            >{t}</button>
          ))}
        </div>

        <div style={s.sep} />

        <div style={s.group}>
          {PHASES.map(p => (
            <button
              key={p}
              style={{ ...s.phaseBtn, ...(currentPhase === p ? s.phaseBtnActive : {}) }}
              onClick={() => onPhaseChange(currentPhase === p ? null : p)}
              title={WARH_PHASE_LABEL[p]}
            >{phaseShort(p)}</button>
          ))}
        </div>

        <div style={s.sep} />

        <div style={s.group}>
          <span style={s.groupLabel}>Color</span>
          {COLOR_SWATCHES.map(c => (
            <button
              key={c.id}
              title={c.label}
              style={{
                ...s.swatch,
                background: c.hex,
                outline: dieColor === c.id ? '2px solid #fff' : '2px solid transparent',
                outlineOffset: 2,
              }}
              onClick={() => onColorChange(c.id)}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button
          style={{ ...s.fxBtn, ...(animEnabled ? s.fxOn : s.fxOff) }}
          onClick={() => onAnimEnabledChange(!animEnabled)}
          title={animEnabled ? 'Desactivar animación' : 'Activar animación'}
        >⚙ FX {animEnabled ? 'ON' : 'OFF'}</button>

        <button
          style={s.repeatBtn}
          onClick={onRepeat}
          disabled={gamePhase !== 'ARRANGED'}
          title="Repetir tirada"
        >↺ Repetir</button>
      </div>

      {/* Row 2 */}
      <div style={s.row2}>
        <button
          style={{ ...s.throwBtn, opacity: count > 0 ? 1 : 0.45 }}
          onClick={onThrow}
          disabled={count === 0 || busy || (gamePhase !== 'PREVIEW' && gamePhase !== 'ARRANGED')}
        >▶ TIRAR DADOS</button>

        <div style={s.sep} />

        <div style={s.group}>
          {ADD_PRESETS.map(n => (
            <button
              key={n}
              style={s.addBtn}
              onClick={() => onAddCount(n)}
              title={`Agregar ${n} dado${n > 1 ? 's' : ''}`}
            >+{n}D6</button>
          ))}
        </div>

        {count > 0 && <span style={s.countLabel}>{count}d6</span>}

        <div style={{ flex: 1 }} />

        <button
          style={{ ...s.lockBtn, ...(cameraLocked ? s.lockOn : s.lockOff) }}
          onClick={() => onCameraLockChange(!cameraLocked)}
          title={cameraLocked ? 'Desbloquear cámara' : 'Fijar cámara (bloquear rotación)'}
        >{cameraLocked ? '🔒' : '🔓'}</button>

        <button style={s.resetBtn} onClick={onReset} title="Limpiar mesa">
          ✕ Limpiar
        </button>
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
    boxShadow: '0 2px 16px rgba(0,0,0,0.5)', userSelect: 'none',
  },
  row1: {
    display: 'flex', alignItems: 'center',
    padding: '5px 12px', gap: 6,
    borderBottom: '1px solid #0e1c30', minHeight: 36,
  },
  row2: {
    display: 'flex', alignItems: 'center',
    padding: '5px 12px', gap: 6, minHeight: 36,
  },
  group: { display: 'flex', alignItems: 'center', gap: 4 },
  groupLabel: {
    color: '#3a5a7a', fontSize: 9, letterSpacing: 2,
    fontWeight: 700, textTransform: 'uppercase', marginRight: 2,
  },
  sep: { width: 1, height: 20, background: '#0e2040', margin: '0 4px', flexShrink: 0 },
  swatch: {
    width: 20, height: 20, borderRadius: 3, border: 'none',
    cursor: 'pointer', padding: 0, transition: 'outline 0.1s',
  },
  turnBtn: {
    fontFamily: f, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#6080a0',
    padding: '2px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
  turnBtnActive: { background: '#001a2e', border: '1px solid #00d4ff', color: '#00d4ff' },
  phaseBtn: {
    fontFamily: f, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#5070a0',
    padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
  },
  phaseBtnActive: { background: '#120e00', border: '1px solid #c9a84c', color: '#c9a84c' },
  fxBtn: {
    fontFamily: f, borderRadius: 4, padding: '3px 9px', fontSize: 10,
    cursor: 'pointer', letterSpacing: 1, fontWeight: 700,
    transition: 'all 0.15s', flexShrink: 0,
  },
  fxOn:  { background: '#001a1a', border: '1px solid #00aabb', color: '#00ccdd' },
  fxOff: { background: '#1a1a1a', border: '1px solid #333', color: '#555' },
  repeatBtn: {
    fontFamily: f, background: '#1a2030', border: '1px solid #2a3a50',
    borderRadius: 4, color: '#6080a0',
    padding: '3px 10px', fontSize: 10,
    cursor: 'pointer', letterSpacing: 1, fontWeight: 700,
  },
  throwBtn: {
    fontFamily: f, background: '#00d4ff', border: 'none',
    borderRadius: 4, color: '#000c14',
    padding: '5px 16px', fontSize: 12,
    fontWeight: 700, letterSpacing: 2,
    cursor: 'pointer', transition: 'opacity 0.15s', minWidth: 130,
  },
  addBtn: {
    fontFamily: f, background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#44cc88',
    padding: '3px 10px', fontSize: 11,
    fontWeight: 700, cursor: 'pointer',
    letterSpacing: 0.5, transition: 'all 0.1s',
  },
  countLabel: { color: '#c9a84c', fontSize: 13, fontWeight: 700, letterSpacing: 1, marginLeft: 6 },
  lockBtn: {
    fontFamily: f, borderRadius: 4, padding: '3px 8px', fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, lineHeight: 1,
  },
  lockOn:  { background: '#1a1000', border: '1px solid #aa8800', color: '#ffcc00' },
  lockOff: { background: '#0d1a2e', border: '1px solid #152a44', color: '#4a6a8a' },
  resetBtn: {
    fontFamily: f, background: '#1a1018', border: '1px solid #3a1020',
    borderRadius: 4, color: '#aa4040',
    padding: '3px 10px', fontSize: 10,
    cursor: 'pointer', letterSpacing: 1, fontWeight: 700,
  },
};
