/**
 * BoardMesh — Wooden table surface + frame rails + lethal zone highlight
 */

'use client';

import { BOARD_W, BOARD_D, LETHAL_ZONE_Z } from './sceneUtils';

interface BoardMeshProps {
  hasAnyLethal: boolean;
}

export function BoardMesh({ hasAnyLethal }: BoardMeshProps) {
  return (
    <>
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <boxGeometry args={[BOARD_W, 0.12, BOARD_D]} />
        <meshStandardMaterial color="#c9a87c" roughness={0.82} metalness={0.04} />
      </mesh>

      {([
        [-(BOARD_W / 2 + 0.35), 0.06, 0,               0.7, 0.18, BOARD_D + 0.7],
        [ (BOARD_W / 2 + 0.35), 0.06, 0,               0.7, 0.18, BOARD_D + 0.7],
        [0, 0.06, -(BOARD_D / 2 + 0.35), BOARD_W + 0.7, 0.18, 0.7],
        [0, 0.06,  (BOARD_D / 2 + 0.35), BOARD_W + 0.7, 0.18, 0.7],
      ] as [number, number, number, number, number, number][]).map((d, i) => (
        <mesh key={i} position={[d[0], d[1], d[2]]}>
          <boxGeometry args={[d[3], d[4], d[5]]} />
          <meshStandardMaterial color="#7a5230" roughness={0.7} metalness={0.08} />
        </mesh>
      ))}

      {hasAnyLethal && (
        <mesh position={[0, 0.002, LETHAL_ZONE_Z]}>
          <boxGeometry args={[BOARD_W - 1.4, 0.012, 3.6]} />
          <meshStandardMaterial color="#3a0010" roughness={0.9} transparent opacity={0.75} />
        </mesh>
      )}
    </>
  );
}
