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
  onHistoryClick: (entry: RollHistoryEntry) => void;
  /** When false (spectator) the throw button is hidden in the child bars. */
  canRoll?: boolean;
}

export function UIControls({
  isMobile,
  onRepeat,
  history,
  onHistoryClick,
  canRoll = true,
  ...shared
}: UIControlsProps) {

  if (isMobile) {
    return (
      <MobileControlBar
        {...shared}
        history={history}
        onHistoryClick={onHistoryClick}
        canRoll={canRoll}
      />
    );
  }

  return (
    <DesktopControlBar
      {...shared}
      onRepeat={onRepeat}
      canRoll={canRoll}
    />
  );
}
