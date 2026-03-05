/**
 * LAYER 1/2 — UIControls: Top control bar
 *
 * Desktop (2 rows):
 *   Row 1: [T▾] [Fase▾] | Colors | FX | [Hist▾] | Repetir
 *   Row 2: Tirar | +ND6 | Count | Lock | Limpiar
 *
 * Mobile (1 compact row, scrollable):
 *   TIRAR | +1 +5 +10 | Nd6 | [T▾] [F▾] [Hist▾] | FX | Lock | ✕
 */

'use client';

import { useState } from 'react';
import type { GamePhase, DieColor, WarhPhase, RollHistoryEntry } from '../core/types';
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
  history: RollHistoryEntry[];
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

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatHistShort(values: number[]): string {
  if (values.length === 0) return '';
  const c: Record<number, number> = {};
  for (const v of values) c[v] = (c[v] ?? 0) + 1;
  return [1,2,3,4,5,6].filter(v => c[v]).map(v => `${v}×${c[v]}`).join(' ');
}

// Short label for the phase button: last word of the label
function phaseShort(p: WarhPhase | null): string {
  if (!p) return 'Fase';
  const label = WARH_PHASE_LABEL[p];
  return label.split(' ').at(-1)!;
}

export function UIControls({
  count, onAddCount,
  dieColor, onColorChange,
  currentTurn, onTurnChange,
  currentPhase, onPhaseChange,
  gamePhase, onThrow, onRepeat, onReset,
  animEnabled, onAnimEnabledChange,
  isMobile, cameraLocked, onCameraLockChange,
  history,
}: UIControlsProps) {
  const [turnOpen,  setTurnOpen]  = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [histOpen,  setHistOpen]  = useState(false);

  const busy = gamePhase === 'ROLLING' || gamePhase === 'SETTLING' || gamePhase === 'ARRANGING';

  function closeAll() { setTurnOpen(false); setPhaseOpen(false); setHistOpen(false); }

  // ── Turn dropdown ──────────────────────────────────────────────────────
  const turnDropdown = (
    <div style={{ position: 'relative' }}>
      <button
        style={{ ...s.dropBtn, ...(turnOpen ? s.dropBtnOpen : {}) }}
        onClick={() => { setTurnOpen(o => !o); setPhaseOpen(false); setHistOpen(false); }}
        title="Seleccionar turno"
      >
        T{currentTurn} ▾
      </button>
      {turnOpen && (
        <>
          <div style={s.backdrop} onClick={closeAll} />
          <div style={isMobile ? s.dropMenuMobile : s.dropMenu}>
            {TURNS.map(t => (
              <button
                key={t}
                style={{ ...(isMobile ? s.dropItemMobile : s.dropItem), ...(currentTurn === t ? s.dropItemActive : {}) }}
                onClick={() => { onTurnChange(t); setTurnOpen(false); }}
              >
                Turno {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── Phase dropdown ─────────────────────────────────────────────────────
  const phaseDropdown = (
    <div style={{ position: 'relative' }}>
      <button
        style={{
          ...s.dropBtn,
          ...(phaseOpen ? s.dropBtnOpen : {}),
          ...(currentPhase ? s.dropBtnActive : {}),
        }}
        onClick={() => { setPhaseOpen(o => !o); setTurnOpen(false); setHistOpen(false); }}
        title="Seleccionar fase de Warhammer"
      >
        {phaseShort(currentPhase)} ▾
      </button>
      {phaseOpen && (
        <>
          <div style={s.backdrop} onClick={closeAll} />
          <div style={isMobile ? s.dropMenuMobile : { ...s.dropMenu, minWidth: 160 }}>
            <button
              style={{ ...(isMobile ? s.dropItemMobile : s.dropItem), ...(currentPhase === null ? s.dropItemActive : {}) }}
              onClick={() => { onPhaseChange(null); setPhaseOpen(false); }}
            >
              — ninguna —
            </button>
            {PHASES.map(p => (
              <button
                key={p}
                style={{ ...(isMobile ? s.dropItemMobile : s.dropItem), ...(currentPhase === p ? s.dropItemActive : {}) }}
                onClick={() => { onPhaseChange(p); setPhaseOpen(false); }}
              >
                {WARH_PHASE_LABEL[p]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── History dropdown ───────────────────────────────────────────────────
  const histDropdown = (
    <div style={{ position: 'relative' }}>
      <button
        style={{ ...s.dropBtn, ...(histOpen ? s.dropBtnOpen : {}) }}
        onClick={() => { setHistOpen(o => !o); setTurnOpen(false); setPhaseOpen(false); }}
        title="Historial de tiradas"
      >
        ✦ ▾
      </button>
      {histOpen && (
        <>
          <div style={s.backdrop} onClick={closeAll} />
          <div style={isMobile ? { ...s.dropMenuMobile, overflowY: 'auto' } : { ...s.dropMenu, right: 0, left: 'auto', width: 260, maxHeight: 360, overflowY: 'auto' }}>
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
                      }}>
                        {title}
                      </span>
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
        </>
      )}
    </div>
  );

  // ── Shared buttons ─────────────────────────────────────────────────────
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

  // ── Mobile layout (single row) ─────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={s.barMobile}>
        <button
          style={{ ...s.throwBtnMobile, opacity: count > 0 ? 1 : 0.45 }}
          onClick={onThrow}
          disabled={count === 0 || busy || (gamePhase !== 'PREVIEW' && gamePhase !== 'ARRANGED')}
        >
          ▶ TIRAR
        </button>

        <div style={s.sep} />

        {ADD_PRESETS_MOBILE.map(n => (
          <button key={n} style={s.addBtnMobile} onClick={() => onAddCount(n)}>
            +{n}
          </button>
        ))}

        {count > 0 && <span style={s.countLabelMobile}>{count}d6</span>}

        <div style={{ flex: 1 }} />

        {/* Colors — compact */}
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

        <div style={s.sep} />

        {turnDropdown}
        {phaseDropdown}
        {histDropdown}

        <div style={s.sep} />

        {fxBtn}
        {lockBtn}

        <button style={s.resetBtnMobile} onClick={onReset} title="Limpiar mesa">✕</button>
      </div>
    );
  }

  // ── Desktop layout (2 rows) ────────────────────────────────────────────
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
            >
              {t}
            </button>
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
            >
              {phaseShort(p)}
            </button>
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
                outline: dieColor === c.id ? `2px solid #fff` : '2px solid transparent',
                outlineOffset: 2,
              }}
              onClick={() => onColorChange(c.id)}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {fxBtn}

        <button
          style={s.repeatBtn}
          onClick={onRepeat}
          disabled={gamePhase !== 'ARRANGED'}
          title="Repetir tirada"
        >
          ↺ Repetir
        </button>
      </div>

      {/* Row 2 */}
      <div style={s.row2}>
        <button
          style={{ ...s.throwBtn, opacity: count > 0 ? 1 : 0.45 }}
          onClick={onThrow}
          disabled={count === 0 || busy || (gamePhase !== 'PREVIEW' && gamePhase !== 'ARRANGED')}
        >
          ▶ TIRAR DADOS
        </button>

        <div style={s.sep} />

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

        {count > 0 && <span style={s.countLabel}>{count}d6</span>}

        <div style={{ flex: 1 }} />

        {lockBtn}

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
    height: 60,
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
  swatch: {
    width: 20, height: 20,
    borderRadius: 3, border: 'none',
    cursor: 'pointer', padding: 0,
    transition: 'outline 0.1s',
  },
  swatchMobile: {
    width: 16, height: 16,
    borderRadius: 3, border: 'none',
    cursor: 'pointer', padding: 0,
    flexShrink: 0,
    transition: 'outline 0.1s',
  },
  repeatBtn: {
    fontFamily: font,
    background: '#1a2030', border: '1px solid #2a3a50',
    borderRadius: 4, color: '#6080a0',
    padding: '3px 10px', fontSize: 10,
    cursor: 'pointer', letterSpacing: 1, fontWeight: 700,
  },
  throwBtn: {
    fontFamily: font,
    background: '#00d4ff', border: 'none',
    borderRadius: 4, color: '#000c14',
    padding: '5px 16px', fontSize: 12,
    fontWeight: 700, letterSpacing: 2,
    cursor: 'pointer', transition: 'opacity 0.15s',
    minWidth: 130,
  },
  throwBtnMobile: {
    fontFamily: font,
    background: '#00d4ff', border: 'none',
    borderRadius: 4, color: '#000c14',
    padding: '7px 12px', fontSize: 12,
    fontWeight: 700, letterSpacing: 1,
    cursor: 'pointer', transition: 'opacity 0.15s',
    flexShrink: 0, minHeight: 36,
  },
  addBtn: {
    fontFamily: font,
    background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#44cc88',
    padding: '3px 10px', fontSize: 11,
    fontWeight: 700, cursor: 'pointer',
    letterSpacing: 0.5, transition: 'all 0.1s',
  },
  addBtnMobile: {
    fontFamily: font,
    background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#44cc88',
    padding: '5px 8px', fontSize: 11,
    fontWeight: 700, cursor: 'pointer',
    flexShrink: 0, minHeight: 34,
  },
  countLabel: {
    color: '#c9a84c', fontSize: 13,
    fontWeight: 700, letterSpacing: 1, marginLeft: 6,
  },
  countLabelMobile: {
    color: '#c9a84c', fontSize: 12,
    fontWeight: 700, letterSpacing: 1, flexShrink: 0,
  },
  resetBtn: {
    fontFamily: font,
    background: '#1a1018', border: '1px solid #3a1020',
    borderRadius: 4, color: '#aa4040',
    padding: '3px 10px', fontSize: 10,
    cursor: 'pointer', letterSpacing: 1, fontWeight: 700,
  },
  resetBtnMobile: {
    fontFamily: font,
    background: '#1a1018', border: '1px solid #3a1020',
    borderRadius: 4, color: '#aa4040',
    padding: '6px 10px', fontSize: 12,
    cursor: 'pointer', fontWeight: 700,
    flexShrink: 0, minHeight: 36,
  },
  fxBtn: {
    fontFamily: font, borderRadius: 4,
    padding: '3px 9px', fontSize: 10,
    cursor: 'pointer', letterSpacing: 1,
    fontWeight: 700, transition: 'all 0.15s', flexShrink: 0,
  },
  fxOn:  { background: '#001a1a', border: '1px solid #00aabb', color: '#00ccdd' },
  fxOff: { background: '#1a1a1a', border: '1px solid #333',    color: '#555'    },
  lockBtn: {
    fontFamily: font, borderRadius: 4,
    padding: '3px 8px', fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s',
    flexShrink: 0, lineHeight: 1,
  },
  lockOn:  { background: '#1a1000', border: '1px solid #aa8800', color: '#ffcc00' },
  lockOff: { background: '#0d1a2e', border: '1px solid #152a44', color: '#4a6a8a' },
  // ── Desktop inline Turn / Phase buttons ───────────────────────────────
  turnBtn: {
    fontFamily: font,
    background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#6080a0',
    padding: '2px 7px', fontSize: 11,
    fontWeight: 700, cursor: 'pointer',
  },
  turnBtnActive: {
    background: '#001a2e', border: '1px solid #00d4ff',
    color: '#00d4ff',
  },
  phaseBtn: {
    fontFamily: font,
    background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 3, color: '#5070a0',
    padding: '2px 8px', fontSize: 10,
    fontWeight: 700, cursor: 'pointer',
  },
  phaseBtnActive: {
    background: '#120e00', border: '1px solid #c9a84c',
    color: '#c9a84c',
  },
  // ── Dropdown shared ────────────────────────────────────────────────────
  dropBtn: {
    fontFamily: font,
    background: '#0d1a2e', border: '1px solid #152a44',
    borderRadius: 4, color: '#4a7aaa',
    padding: '3px 8px', fontSize: 10,
    fontWeight: 700, cursor: 'pointer',
    letterSpacing: 0.5, whiteSpace: 'nowrap',
    transition: 'all 0.1s', flexShrink: 0,
  },
  dropBtnOpen: {
    border: '1px solid #00d4ff66',
    color: '#00d4ff', background: '#001a2e',
  },
  dropBtnActive: {
    border: '1px solid #c9a84c88',
    color: '#c9a84c', background: '#120e00',
  },
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 499,
  },
  dropMenu: {
    position: 'absolute',
    top: 'calc(100% + 3px)', left: 0,
    zIndex: 200,
    background: 'rgba(6, 10, 22, 0.98)',
    border: '1px solid #1a3a5a',
    borderRadius: 4,
    minWidth: 100,
    boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
    overflow: 'hidden',
    fontFamily: font,
  },
  dropItem: {
    display: 'block', width: '100%',
    background: 'none', border: 'none',
    borderBottom: '1px solid #0a1828',
    color: '#4a6a8a', fontFamily: font,
    fontSize: 10, fontWeight: 700,
    padding: '7px 12px',
    textAlign: 'left', cursor: 'pointer',
    letterSpacing: 0.5, whiteSpace: 'nowrap',
    transition: 'background 0.1s, color 0.1s',
  },
  dropItemActive: {
    color: '#00d4ff', background: '#001a2a',
  },
  // ── History dropdown content ────────────────────────────────────────────
  histHead: {
    padding: '5px 12px',
    borderBottom: '1px solid #0e2040',
    color: '#2a4a6a', fontSize: 9,
    letterSpacing: 3, fontWeight: 700,
    fontFamily: font,
  },
  histEmpty: {
    color: '#2a3a50', fontSize: 10,
    padding: '8px 12px', fontFamily: font,
    fontStyle: 'italic',
  },
  histItem: {
    padding: '5px 12px',
    borderBottom: '1px solid #0a1520',
    fontFamily: font,
  },
  histItemRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: 8,
  },
  // ── Mobile full-screen overlay dropdown ────────────────────────────────
  dropMenuMobile: {
    position: 'fixed',
    top: 60, left: 0, right: 0,
    width: '100%',
    zIndex: 500,
    background: 'rgba(4, 8, 20, 0.98)',
    borderBottom: '1px solid #1a3a5a',
    maxHeight: '70vh',
    overflowY: 'auto',
    fontFamily: font,
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  },
  dropItemMobile: {
    display: 'block', width: '100%',
    background: 'none', border: 'none',
    borderBottom: '1px solid #0a1828',
    color: '#4a6a8a', fontFamily: font,
    fontSize: 14, fontWeight: 700,
    padding: '14px 20px',
    textAlign: 'left', cursor: 'pointer',
    letterSpacing: 0.5,
  },
};
