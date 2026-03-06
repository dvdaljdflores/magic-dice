/**
 * LAYER 1 — Format Utilities
 *
 * Pure formatting functions shared across UI components.
 * No React dependencies — plain string transformations.
 */

import type { WarhPhase, GamePhase } from './types';
import { WARH_PHASE_LABEL } from './types';

/** Unicode die face for value 1–6. */
export function faceEmoji(v: number): string {
  return ['⚀','⚁','⚂','⚃','⚄','⚅'][v - 1] ?? String(v);
}

/** Format a timestamp as HH:MM. */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/** Summarise a values array as "#1 ×3  #4 ×2". Used in desktop history. */
export function formatHistoryValues(values: number[]): string {
  if (values.length === 0) return '';
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return [1, 2, 3, 4, 5, 6]
    .filter(v => counts[v])
    .map(v => `#${v} ×${counts[v]}`)
    .join('  ');
}

/** Compact history summary "1×3 4×2". Used in dropdown/mobile history. */
export function formatHistShort(values: number[]): string {
  if (values.length === 0) return '';
  const c: Record<number, number> = {};
  for (const v of values) c[v] = (c[v] ?? 0) + 1;
  return [1,2,3,4,5,6].filter(v => c[v]).map(v => `${v}×${c[v]}`).join(' ');
}

/** Full phase label from WarhPhase, empty string if null. */
export function phaseLabel(phase: WarhPhase | null): string {
  return phase ? WARH_PHASE_LABEL[phase] : '';
}

/** Short phase label for compact UI — last word of the full label. */
export function phaseShort(p: WarhPhase | null): string {
  if (!p) return 'Fase';
  const label = WARH_PHASE_LABEL[p];
  return label.split(' ').at(-1)!;
}

/** Status text while dice are animating. */
export function spinningLabel(phase: GamePhase): string {
  if (phase === 'ROLLING')   return 'lanzando…';
  if (phase === 'SETTLING')  return 'estabilizando…';
  if (phase === 'ARRANGING') return 'organizando…';
  return '';
}
