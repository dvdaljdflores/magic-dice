'use client';

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useDiceStore } from '../store/diceStore';
import { DiceScene } from './DiceScene';
import { UIControls } from './UIControls';
import { ResultsPanel } from './ResultsPanel';
import { HistoryModal } from './ui/HistoryModal';
import { TOP_BAR_H, LEFT_PANEL_W, MOBILE_BAR_H } from '../constants/theme';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { useDeviceMotion } from '../hooks/useDeviceMotion';
import { setMobileLayoutMode } from '../core/ArrangeLayout';
import type { RollHistoryEntry } from '../core/types';

export default function WarhammerBoard() {

  const {
    count, phase, rollResult, dieColor, activeMask, lethalMask,
    history, currentTurn, currentPhase, sustainedX, undoStack, animEnabled,
  } = useDiceStore(useShallow(s => ({
    count:        s.count,
    phase:        s.phase,
    rollResult:   s.rollResult,
    dieColor:     s.dieColor,
    activeMask:   s.activeMask,
    lethalMask:   s.lethalMask,
    history:      s.history,
    currentTurn:  s.currentTurn,
    currentPhase: s.currentPhase,
    sustainedX:   s.sustainedX,
    undoStack:    s.undoStack,
    animEnabled:  s.animEnabled,
  })));

  const {
    addCount, throwDice, repeatThrow, deleteFace, rerollFace,
    toggleLethal, sustainedHits, reset, setDieColor, setTurn,
    setWarhPhase, setSustainedX, undo, setAnimEnabled,
  } = useDiceStore(useShallow(s => ({
    addCount:       s.addCount,
    throwDice:      s.throwDice,
    repeatThrow:    s.repeatThrow,
    deleteFace:     s.deleteFace,
    rerollFace:     s.rerollFace,
    toggleLethal:   s.toggleLethal,
    sustainedHits:  s.sustainedHits,
    reset:          s.reset,
    setDieColor:    s.setDieColor,
    setTurn:        s.setTurn,
    setWarhPhase:   s.setWarhPhase,
    setSustainedX:  s.setSustainedX,
    undo:           s.undo,
    setAnimEnabled: s.setAnimEnabled,
  })));

  const isMobile = useMobileDetect();
  const [cameraLocked, setCameraLocked] = useState(false);

  /* NUEVO: estado del modal */
  const [modalEntry, setModalEntry] = useState<RollHistoryEntry | null>(null);

  useEffect(() => {
    setMobileLayoutMode(isMobile);
  }, [isMobile]);

  const canThrow = phase === 'PREVIEW' || phase === 'ARRANGED';
  useDeviceMotion(isMobile, canThrow, throwDice);

  const canUndo =
    undoStack.length > 0 &&
    phase !== 'ROLLING' &&
    phase !== 'SETTLING' &&
    phase !== 'ARRANGING';

  const canvasStyle = isMobile
    ? { position: 'absolute' as const, top: MOBILE_BAR_H, left: 0, right: 0, bottom: 0 }
    : { position: 'absolute' as const, top: TOP_BAR_H, left: LEFT_PANEL_W, right: 0, bottom: 0 };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#08080f' }}>

      <Canvas
        shadows
        camera={{
          position: isMobile ? [0, 28, -2] : [0, 18, 15],
          fov: isMobile ? 58 : 40,
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
          minPolarAngle={isMobile ? 0.15 : 0.11}
          maxPolarAngle={isMobile ? 0.6 : Math.PI / 2.1}
          minDistance={isMobile ? 15 : 8}
          maxDistance={isMobile ? 40 : 38}
          target={(isMobile ? [0, -15, -3] : [0, 0, 0]) as [number, number, number]}
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
        onHistoryClick={setModalEntry} 
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

      {/* MODAL GLOBAL */}
      {modalEntry && (
        <HistoryModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
        />
      )}

    </div>
  );
}