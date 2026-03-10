/**
 * AppModeStore — Application Mode State
 *
 * PURPOSE:
 *   Controls which screen is currently visible to the user.
 *   This is the top-level routing state for the entire application.
 *
 * MODES:
 *   "lobby"   → LobbyScreen: entry point, choose solo or session
 *   "waiting" → WaitingRoom: session lobby before the game starts
 *   "solo"    → DiceTableScreen in solo mode (no session, no networking)
 *   "table"   → DiceTableScreen in session mode (host/player/spectator)
 *
 * INTERACTIONS:
 *   - LobbyScreen reads and writes this store to navigate
 *   - WaitingRoom reads and writes this store
 *   - DiceTableScreen reads this store to determine permissions
 *   - sessionManager writes this store when host disconnects
 */

import { create } from 'zustand';

export type AppMode = 'lobby' | 'waiting' | 'solo' | 'table';

interface AppModeState {
  /** Current application mode — determines which screen is shown */
  mode: AppMode;

  /** Navigate to a new mode */
  setMode: (mode: AppMode) => void;
}

export const useAppModeStore = create<AppModeState>((set) => ({
  mode: 'lobby',

  setMode: (mode) => set({ mode }),
}));