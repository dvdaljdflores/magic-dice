/**
 * PreviewGrid — Static InstancedMesh grid shown during PREVIEW phase
 */

'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { DieColor } from '../../core/types';
import { PREVIEW_QUATERNION } from '../../core/DiceEngine';
import { DIE_COLOR_MAP } from '../../rendering/DiceMaterial';
import { _p, _q, _sc, _mat, _zero, MAX_DICE, computeScale } from './sceneUtils';

interface PreviewGridProps {
  count: number;
  geo: THREE.BoxGeometry;
  mat: THREE.MeshStandardMaterial;
  dieColor: DieColor;
}

export function PreviewGrid({ count, geo, mat, dieColor }: PreviewGridProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < MAX_DICE; i++) mesh.setMatrixAt(i, _zero);

    if (count > 0) {
      const s = computeScale(count);
      _sc.set(s, s, s);
      const cols    = Math.ceil(Math.sqrt(count * 1.3));
      const spacing = s * 1.4;
      const ox      = -((cols - 1) * spacing) / 2;
      const rowsN   = Math.ceil(count / cols);
      const oz      = -((rowsN - 1) * spacing) / 2;

      for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        _p.set(ox + c * spacing, s / 2 + 0.01, oz + r * spacing);
        _q.copy(PREVIEW_QUATERNION);
        _mat.compose(_p, _q, _sc);
        mesh.setMatrixAt(i, _mat);
      }
      mat.color.copy(DIE_COLOR_MAP[dieColor]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DICE;
  }, [count, dieColor, geo, mat]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_DICE]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}
