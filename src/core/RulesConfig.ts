/**
 * LAYER 4 — Warhammer Rules Configuration
 *
 * Configurable thresholds for 40k / AoS mechanics.
 * Calculation logic is intentionally deferred — only the config
 * contract is established here so it can be injected anywhere.
 *
 * Placeholder hooks for future implementation:
 *   - computeHits(results, config)  → hits + crits
 *   - computeWounds(hits, config)   → wounds + mortals
 *   - computeSaves(wounds, config)  → unsaved wounds
 */

import type { RulesConfig } from './types';

export { DEFAULT_RULES_CONFIG } from './types';

/** Placeholder — returns raw count; implement per Warhammer ruleset */
export function countSuccesses(results: number[], config: RulesConfig): number {
  // TODO: Apply Sustained Hits X, Lethal Hits, re-roll rules
  return results.filter(v => v >= config.successThreshold).length;
}

/** Placeholder — returns crit count; implement per Warhammer ruleset */
export function countCriticals(results: number[], config: RulesConfig): number {
  // TODO: Apply Lethal Hits, Devastating Wounds, etc.
  return results.filter(v => v === config.criticalValue).length;
}
