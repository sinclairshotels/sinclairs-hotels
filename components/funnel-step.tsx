'use client';

import { recordFunnelStep } from '@/lib/analytics';
import { useEffect } from 'react';

// Records one funnel step when the page it sits on is shown. Rendered rather
// than called so a server component can mark its own step without becoming a
// client component itself.
export function FunnelStep({ step, hotel }: { step: 'home_view' | 'room_view'; hotel?: string }) {
  useEffect(() => {
    recordFunnelStep(step, hotel);
  }, [step, hotel]);

  return null;
}
