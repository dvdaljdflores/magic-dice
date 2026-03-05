'use client';

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useDiceStore } from '../store/diceStore';
import { setMobileLayoutMode } from '../core/ArrangeLayout';
import { DiceScene } from './DiceScene';
import { UIControls } from './UIControls';
import { ResultsPanel } from './ResultsPanel';

const TOP_BAR_H    = 72;
const LEFT_W       = 240;
const MOBILE_BAR_H = 60;

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
  const setSustainedX = useDiceStore(s => s.setSustainedX);
  const undo          = useDiceStore(s => s.undo);
  const animEnabled   = useDiceStore(s => s.animEnabled);
  const setAnimEnabled = useDiceStore(s => s.setAnimEnabled);

  const [isMobile, setIsMobile] = useState(false);
  const [cameraLocked, setCameraLocked] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setMobileLayoutMode(isMobile);
  }, [isMobile]);

  const canUndo = undoStack.length > 0
    && phase !== 'ROLLING'
    && phase !== 'SETTLING'
    && phase !== 'ARRANGING';

  const canvasStyle = isMobile
    ? { position: 'absolute' as const, top: MOBILE_BAR_H, left: 0, right: 0, bottom: 0 }
    : { position: 'absolute' as const, top: TOP_BAR_H, left: LEFT_W, right: 0, bottom: 0 };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#08080f' }}>

      <Canvas
        shadows
        camera={{
          position: isMobile ? [0, 11, 9] : [0, 18, 15],
          fov: isMobile ? 60 : 40,
          near: 0.5,
          far: 85,
        }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={canvasStyle}
      >

        <fog attach="fog" args={['#08080f', 22, 60]} />

        <DiceScene
          count={count}
          gamePhase={phase}
          rollResult={rollResult}
          dieColor={dieColor}
          activeMask={activeMask}
          lethalMask={lethalMask}
        />

        <OrbitControls
          enabled={!cameraLocked}
          enablePan={false}
          minPolarAngle={isMobile ? 0.9 : 0.25}
          maxPolarAngle={isMobile ? 1.35 : Math.PI / 2.1}
          minDistance={isMobile ? 5 : 8}
          maxDistance={isMobile ? 22 : 38}
          target={isMobile ? [0, 0, -8] : [0, 0, 0]}
        />

      </Canvas>

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
        mobileBarH={MOBILE_BAR_H}
      />

    </div>
  );
}