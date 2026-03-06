/**
 * Hook — Mobile viewport detection
 *
 * Tracks whether the viewport is below MOBILE_BREAKPOINT and keeps
 * the ArrangeLayout module-level flag in sync.
 */

import { useState, useEffect } from 'react';
import { setMobileLayoutMode } from '../core/ArrangeLayout';
import { MOBILE_BREAKPOINT } from '../constants/theme';

export function useMobileDetect(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      setMobileLayoutMode(mobile);
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
