/**
 * ArrangedDice — Three InstancedMeshes (normal, lethal, sustained)
 *
 * Shown during ARRANGING + ARRANGED phases. Uses non-reactive store reads
 * in useFrame for performance.
 */

'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DiceRollResult, DieColor } from '../../core/types';
import { DIE_COLOR_MAP } from '../../rendering/DiceMaterial';
import { useDiceStore } from '../../store/diceStore';
import { _p, _q, _sc, _mat, _zero, MAX_DICE, computeScale, easeOutCubic } from './sceneUtils';

interface ArrangedDiceProps {
  rollResult: DiceRollResult | null;
  lethalMask: boolean[] | null;
  dieColor: DieColor;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  lethalMat: THREE.MeshStandardMaterial;
  sustainedMat: THREE.MeshStandardMaterial;
}

export function ArrangedDice({
  rollResult, lethalMask, dieColor, geo, mat, lethalMat, sustainedMat,
}: ArrangedDiceProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lethalMeshRef = useRef<THREE.InstancedMesh>(null);
  const sustainedMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    mat.color.copy(DIE_COLOR_MAP[dieColor]);
  }, [dieColor, mat]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const lethalMesh = lethalMeshRef.current;
    const sustainedMesh = sustainedMeshRef.current;
    if (!mesh || !lethalMesh || !sustainedMesh || !rollResult) return;

    const store = useDiceStore.getState();

    if (store.phase === 'ARRANGING') {
      store.tickArrangeAnimation(delta);
    }

    const { arrangeTargets, arrangeProgress, sustainedMask } = useDiceStore.getState();
    if (!arrangeTargets) return;

    const n = rollResult.count;
    const s = computeScale(n);
    _sc.set(s, s, s);

    for (let i = 0; i < MAX_DICE; i++) {
      mesh.setMatrixAt(i, _zero);
      lethalMesh.setMatrixAt(i, _zero);
      sustainedMesh.setMatrixAt(i, _zero);
    }

    const t = easeOutCubic(arrangeProgress);

    for (const [dieIdx, target] of arrangeTargets) {
      const isLethal    = lethalMask?.[dieIdx] ?? false;
      const isSustained = sustainedMask?.[dieIdx] ?? false;
      const targetMesh  = isLethal ? lethalMesh : isSustained ? sustainedMesh : mesh;

      _p.set(target.position[0], target.position[1], target.position[2]);

      if (t < 1) {
        const startY = target.position[1] + 2 * (1 - t);
        _p.y = target.position[1] * t + startY * (1 - t);
      }

      _q.set(target.quaternion[0], target.quaternion[1], target.quaternion[2], target.quaternion[3]);
      _mat.compose(_p, _q, _sc);
      targetMesh.setMatrixAt(dieIdx, _mat);
    }

    mesh.instanceMatrix.needsUpdate = true;
    lethalMesh.instanceMatrix.needsUpdate = true;
    sustainedMesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DICE;
    lethalMesh.count = MAX_DICE;
    sustainedMesh.count = MAX_DICE;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={lethalMeshRef}
        args={[geo, lethalMat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={sustainedMeshRef}
        args={[geo, sustainedMat, MAX_DICE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </>
  );
}
