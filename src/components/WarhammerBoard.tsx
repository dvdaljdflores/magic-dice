/**
 * LAYER 1/2/3 — WarhammerBoard: Root Orchestrator
 *
 * Layout (desktop):
 *   - Top bar (UIControls): absolute, full width, ~72px
 *   - Left panel (ResultsPanel): absolute, 240px wide, below top bar
 *   - Canvas (DiceScene): absolute, fills remaining area
 *
 * Layout (mobile < 768px):
 *   - Top bar (UIControls): compact single row, ~52px
 *   - Canvas: landscape-rotated (CSS rotate 90°) in overflow:hidden container
 *   - ResultsPanel: fixed-height bottom overlay (220px)
 *
 * All state is managed via Zustand (useDiceStore).
 */

'use client';

import { useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useDiceStore } from '../store/diceStore';
import { DiceScene } from './DiceScene';
import { UIControls } from './UIControls';
import { ResultsPanel } from './ResultsPanel';

const TOP_BAR_H        = 72;
const LEFT_W           = 240;
const MOBILE_BAR_H     = 52;
const MOBILE_OVERLAY_H = 220;

/**
 * Adjusts camera.up so the scene renders with +X as up.
 * Combined with CSS rotate(90deg) on the canvas this produces
 * a correct landscape view inside a portrait container.
 */
function CameraUp({ x, y, z }: { x: number; y: number; z: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(x, y, z);
    camera.updateMatrixWorld();
  }, [camera, x, y, z]);
  return null;
}

export default function WarhammerBoard() {
  const count        = useDiceStore(s => s.count);
  const phase        = useDiceStore(s => s.phase);
  const rollResult   = useDiceStore(s => s.rollResult);
  const dieColor     = useDiceStore(s => s.dieColor);
  const activeMask   = useDiceStore(s => s.activeMask);
  const lethalMask   = useDiceStore(s => s.lethalMask);
  const history      = useDiceStore(s => s.history);
  const currentTurn  = useDiceStore(s => s.currentTurn);
  const currentPhase = useDiceStore(s => s.currentPhase);
  const sustainedX   = useDiceStore(s => s.sustainedX);
  const undoStack    = useDiceStore(s => s.undoStack);

  const addCount      = useDiceStore(s => s.addCount);
  const throwDice     = useDiceStore(s => s.throwDice);
  const repeatThrow   = useDiceStore(s => s.repeatThrow);
  const deleteFace    = useDiceStore(s => s.deleteFace);
  const rerollFace    = useDiceStore(s => s.rerollFace);
  const toggleLethal  = useDiceStore(s => s.toggleLethal);
  const sustainedHits = useDiceStore(s => s.sustainedHits);
  const reset         = useDiceStore(s => s.reset);
  const setDieColor   = useDiceStore(s => s.setDieColor);
  const setTurn       = useDiceStore(s => s.setTurn);
  const setWarhPhase  = useDiceStore(s => s.setWarhPhase);
  const setSustainedX   = useDiceStore(s => s.setSustainedX);
  const undo            = useDiceStore(s => s.undo);
  const animEnabled     = useDiceStore(s => s.animEnabled);
  const setAnimEnabled  = useDiceStore(s => s.setAnimEnabled);

  const [isMobile,   setIsMobile]   = useState(false);
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [cameraLocked, setCameraLocked] = useState(false);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 768);
      setWindowSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const canUndo = undoStack.length > 0
    && phase !== 'ROLLING'
    && phase !== 'SETTLING'
    && phase !== 'ARRANGING';

  // ── Mobile canvas geometry (landscape via CSS rotation) ────────────────
  // The container fills between top bar (52px) and overlay (220px).
  // We render the Canvas with swapped W/H then CSS-rotate 90deg to get
  // landscape content inside the portrait container.
  const containerW = windowSize.w;
  const containerH = windowSize.h - MOBILE_BAR_H - MOBILE_OVERLAY_H;
  const mobileCanvasW    = containerH;          // wide in render space
  const mobileCanvasH    = containerW;          // tall in render space
  const mobileCanvasLeft = (containerW - containerH) / 2;  // negative
  const mobileCanvasTop  = (containerH - containerW) / 2;  // positive

  const sceneProps = {
    count,
    gamePhase: phase,
    rollResult,
    dieColor,
    activeMask,
    lethalMask,
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#08080f' }}>

      {/* ── Mobile canvas: landscape-rotated ──────────────────────────── */}
      {isMobile && windowSize.w > 0 && (
        <div style={{
          position: 'absolute',
          top: MOBILE_BAR_H,
          bottom: MOBILE_OVERLAY_H,
          left: 0, right: 0,
          overflow: 'hidden',
        }}>
          <Canvas
            shadows
            camera={{ position: [0, 18, 15], fov: 40, near: 0.5, far: 85 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
            style={{
              position: 'absolute',
              width: mobileCanvasW,
              height: mobileCanvasH,
              left: mobileCanvasLeft,
              top: mobileCanvasTop,
              transform: 'rotate(90deg)',
              transformOrigin: '50% 50%',
            }}
          >
            <fog attach="fog" args={['#08080f', 22, 60]} />
            <CameraUp x={1} y={0} z={0} />
            <DiceScene {...sceneProps} />
          </Canvas>
        </div>
      )}

      {/* ── Desktop canvas: unchanged ──────────────────────────────────── */}
      {!isMobile && (
        <Canvas
          shadows
          camera={{ position: [0, 18, 15], fov: 40, near: 0.5, far: 85 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ position: 'absolute', top: TOP_BAR_H, left: LEFT_W, right: 0, bottom: 0 }}
        >
          <fog attach="fog" args={['#08080f', 22, 60]} />

          <DiceScene {...sceneProps} />

          <OrbitControls
            enabled={!cameraLocked}
            enablePan={false}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={8}
            maxDistance={38}
            target={[0, 0, 0]}
          />
        </Canvas>
      )}

      <UIControls
        count={count}
        onAddCount={addCount}
        dieColor={dieColor}
        onColorChange={setDieColor}
        currentTurn={currentTurn}
        onTurnChange={setTurn}
        currentPhase={currentPhase}
        onPhaseChange={setWarhPhase}
        gamePhase={phase}
        onThrow={throwDice}
        onRepeat={repeatThrow}
        onReset={reset}
        animEnabled={animEnabled}
        onAnimEnabledChange={setAnimEnabled}
        isMobile={isMobile}
        cameraLocked={cameraLocked}
        onCameraLockChange={(v) => setCameraLocked(v)}
        history={history}
      />

      <ResultsPanel
        rollResult={rollResult}
        activeMask={activeMask}
        lethalMask={lethalMask}
        dieColor={dieColor}
        history={history}
        gamePhase={phase}
        sustainedX={sustainedX}
        onSustainedXChange={setSustainedX}
        onDelete={deleteFace}
        onReroll={rerollFace}
        onSustainedHits={sustainedHits}
        onToggleLethal={toggleLethal}
        onUndo={undo}
        canUndo={canUndo}
        isMobile={isMobile}
      />
    </div>
  );
}
