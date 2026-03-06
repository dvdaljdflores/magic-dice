/**
 * DiceScene — Root 3D scene orchestrator
 *
 * Three rendering modes:
 *   1. PREVIEW — Static grid, no physics
 *   2. ROLLING + SETTLING — Rapier3D physics active
 *   3. ARRANGING + ARRANGED — Lerp to sorted positions, no physics
 */

'use client';

import { useEffect, useMemo } from 'react';
import { Physics } from '@react-three/rapier';
import type { DiceRollResult, GamePhase, DieColor } from '../../core/types';
import { createDiceGeometry } from '../../rendering/DiceGeometry';
import { createDiceMaterial } from '../../rendering/DiceMaterial';
import { PHYSICS_CONFIG } from '../../physics/constants';
import { refreshBoardDimensions } from './sceneUtils';
import { Lighting } from './Lighting';
import { BoardMesh } from './BoardMesh';
import { PreviewGrid } from './PreviewGrid';
import { PhysicsDice } from './PhysicsDice';
import { PhysicsFloor, PhysicsWalls } from './PhysicsEnvironment';
import { ArrangedDice } from './ArrangedDice';
import { RowLabels } from './RowLabels';

interface DiceSceneProps {
  count: number;
  gamePhase: GamePhase;
  rollResult: DiceRollResult | null;
  dieColor: DieColor;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
}

export function DiceScene({
  count, gamePhase, rollResult, dieColor, activeMask, lethalMask,
}: DiceSceneProps) {

  const geo = useMemo(() => createDiceGeometry(), []);
  const mat = useMemo(() => createDiceMaterial(), []);

  useEffect(() => {
    refreshBoardDimensions();
  }, []);

  const lethalMat = useMemo(() => {
    const m = createDiceMaterial();
    m.color.setRGB(0.92, 0.68, 0.02);
    return m;
  }, []);
  const sustainedMat = useMemo(() => {
    const m = createDiceMaterial();
    m.color.setRGB(0.0, 0.88, 0.95);
    return m;
  }, []);

  const hasAnyLethal = useMemo(
    () => !!lethalMask?.some(Boolean),
    [lethalMask],
  );

  const isPhysicsPhase = gamePhase === 'ROLLING' || gamePhase === 'SETTLING';

  return (
    <>
      <Lighting />
      <BoardMesh hasAnyLethal={hasAnyLethal} />

      {gamePhase === 'PREVIEW' && (
        <PreviewGrid count={count} geo={geo} mat={mat} dieColor={dieColor} />
      )}

      {isPhysicsPhase && (
        <Physics gravity={[...PHYSICS_CONFIG.gravity]}>
          <PhysicsDice count={count} geo={geo} mat={mat} dieColor={dieColor} />
          <PhysicsFloor />
          <PhysicsWalls />
        </Physics>
      )}

      {(gamePhase === 'ARRANGING' || gamePhase === 'ARRANGED') && (
        <>
          <ArrangedDice
            rollResult={rollResult}
            lethalMask={lethalMask}
            dieColor={dieColor}
            geo={geo}
            mat={mat}
            lethalMat={lethalMat}
            sustainedMat={sustainedMat}
          />
          <RowLabels
            rollResult={rollResult}
            activeMask={activeMask}
            lethalMask={lethalMask}
          />
        </>
      )}
    </>
  );
}
