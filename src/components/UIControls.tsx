/**
 * UIControls — Router component
 *
 * Delegates to MobileControlBar or DesktopControlBar based on viewport.
 */

'use client';

import type { GamePhase, DieColor, WarhPhase, RollHistoryEntry } from '../core/types';
import { MobileControlBar } from './ui/MobileControlBar';
import { DesktopControlBar } from './ui/DesktopControlBar';

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

export function UIControls({
  isMobile, onRepeat, history, ...shared
}: UIControlsProps) {
  if (isMobile) {
    return <MobileControlBar {...shared} history={history} />;
  }
  return <DesktopControlBar {...shared} onRepeat={onRepeat} />;
}
