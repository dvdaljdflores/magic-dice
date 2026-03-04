/**
 * LAYER 1 — Dice Geometry with UV Face Atlas
 *
 * A BoxGeometry where each of the 6 faces has its UVs remapped to a
 * horizontal 6-cell atlas. Each atlas cell shows one die face number.
 *
 * Face assignment (must be consistent with DiceEngine.ts faceUpQuaternion):
 *   +Y face → 1   (col 0)
 *   +Z face → 2   (col 1)
 *   +X face → 3   (col 2)
 *   -X face → 4   (col 3)
 *   -Z face → 5   (col 4)
 *   -Y face → 6   (col 5)
 *
 * BoxGeometry face order in the UV attribute: +X, -X, +Y, -Y, +Z, -Z
 * Each face occupies 4 consecutive UV entries (indexed geometry, 24 vertices).
 */

import * as THREE from 'three';

// BoxGeometry face index → atlas column
// Order: [+X=3, -X=4, +Y=1, -Y=6, +Z=2, -Z=5]
const FACE_TO_COL = [2, 3, 0, 5, 1, 4];

export function createDiceGeometry(): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute;

  for (let face = 0; face < 6; face++) {
    const col = FACE_TO_COL[face];
    const u0 = col / 6;
    const u1 = (col + 1) / 6;
    const base = face * 4;

    // Three.js BoxGeometry UV per face (4 vertices, CCW winding):
    // vertex 0: bottom-left, vertex 1: bottom-right,
    // vertex 2: top-left,    vertex 3: top-right
    uvAttr.setXY(base + 0, u0, 0);
    uvAttr.setXY(base + 1, u1, 0);
    uvAttr.setXY(base + 2, u0, 1);
    uvAttr.setXY(base + 3, u1, 1);
  }

  uvAttr.needsUpdate = true;
  return geo;
}
