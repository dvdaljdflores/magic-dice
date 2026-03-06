/**
 * Shared UI constants — fonts, colors, breakpoints, layout dimensions.
 */

import type { DieColor } from '../core/types';

export const FONT_FAMILY = "'Courier New', Courier, monospace";

export const MOBILE_BREAKPOINT = 768;

export const TOP_BAR_H = 72;
export const LEFT_PANEL_W = 240;
export const MOBILE_BAR_H = 88;
export const MAX_DICE = 120;

export const FACES = [1, 2, 3, 4, 5, 6] as const;

export const COLOR_HEX: Record<DieColor, string> = {
  white: '#e8e8e8', red: '#e05040', blue: '#4488cc', green: '#40c060',
  yellow: '#d4b800', orange: '#cc5510', purple: '#8830c0', black: '#303038',
};

export const COLOR_SWATCHES: { id: DieColor; hex: string; label: string }[] = [
  { id: 'white',  hex: '#e8e8e8', label: 'Blanco'   },
  { id: 'blue',   hex: '#2a7a8a', label: 'Azul'     },
  { id: 'red',    hex: '#c03020', label: 'Rojo'     },
  { id: 'green',  hex: '#20a040', label: 'Verde'    },
  { id: 'yellow', hex: '#c9a800', label: 'Amarillo' },
  { id: 'orange', hex: '#c05010', label: 'Naranja'  },
  { id: 'purple', hex: '#8030c0', label: 'Morado'   },
  { id: 'black',  hex: '#1a1a20', label: 'Negro'    },
];
