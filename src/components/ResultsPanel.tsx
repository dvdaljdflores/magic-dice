/**
 * ResultsPanel — Router component
 *
 * Delegates to MobileResultsView or DesktopResultsPanel based on viewport.
 */

'use client';

import type {
  DiceRollResult, DieColor, RollHistoryEntry, GamePhase, SustainedX,
} from '../core/types';
import { MobileResultsView } from './ui/MobileResultsView';
import { DesktopResultsPanel } from './ui/DesktopResultsPanel';

interface ResultsPanelProps {
  rollResult:        DiceRollResult | null;
  activeMask:        boolean[] | null;
  lethalMask:        boolean[] | null;
  dieColor:          DieColor;
  history:           RollHistoryEntry[];
  gamePhase:         GamePhase;
  sustainedX:        SustainedX;
  onSustainedXChange:(x: SustainedX) => void;
  onDelete:          (faceValue: number) => void;
  onReroll:          (faceValue: number) => void;
  onSustainedHits:   (faceValue: number) => void;
  onToggleLethal:    (faceValue: number) => void;
  onUndo:            () => void;
  canUndo:           boolean;
  isMobile:          boolean;
  mobileBarH:        number;
}

export function ResultsPanel({
  isMobile, mobileBarH, history, ...shared
}: ResultsPanelProps) {
  if (isMobile) {
    return <MobileResultsView {...shared} mobileBarH={mobileBarH} />;
  }
  return <DesktopResultsPanel {...shared} history={history} />;
}
