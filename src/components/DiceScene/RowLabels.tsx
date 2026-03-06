/**
 * RowLabels — Face-value labels shown next to arranged dice rows
 */

'use client';

import { Text } from '@react-three/drei';
import type { DiceRollResult } from '../../core/types';
import { useDiceStore } from '../../store/diceStore';
import { BOARD_W, LETHAL_ZONE_Z } from './sceneUtils';

const LABEL_X = -(BOARD_W / 2) + 0.9;

interface RowLabelsProps {
  rollResult: DiceRollResult | null;
  activeMask: boolean[] | null;
  lethalMask: boolean[] | null;
}

export function RowLabels({ rollResult, activeMask, lethalMask }: RowLabelsProps) {
  const arrangeTargets = useDiceStore(s => s.arrangeTargets);
  if (!arrangeTargets || !rollResult) return null;

  const normalRowZ = new Map<number, number>();
  const normalRowCount = new Map<number, number>();
  let lethalCount = 0;

  for (const [dieIdx, target] of arrangeTargets) {
    if (activeMask && !activeMask[dieIdx]) continue;
    const v = rollResult.values[dieIdx];
    const isLethal = lethalMask?.[dieIdx] ?? false;
    if (isLethal) {
      lethalCount++;
    } else {
      if (!normalRowZ.has(v)) normalRowZ.set(v, target.position[2]);
      normalRowCount.set(v, (normalRowCount.get(v) ?? 0) + 1);
    }
  }

  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(v => {
        const z   = normalRowZ.get(v);
        const cnt = normalRowCount.get(v);
        if (z === undefined || !cnt) return null;
        return (
          <Text
            key={v}
            position={[LABEL_X, 0.12, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.42}
            color="#0a0a08"
            anchorX="center"
            anchorY="middle"
          >
            {`${v} x${cnt}`}
          </Text>
        );
      })}
      {lethalCount > 0 && (
        <Text
          position={[0, 0.12, LETHAL_ZONE_Z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.42}
          color="#0a0a08"
          anchorX="center"
          anchorY="middle"
        >
          {`☠ x${lethalCount}`}
        </Text>
      )}
    </>
  );
}
