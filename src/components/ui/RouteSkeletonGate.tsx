'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type RouteSkeletonGateProps = {
  children: React.ReactNode;
};

const VISITED_PREFIX = 'waas_route_seen:';

export function RouteVisitMarker() {
  const pathname = usePathname();

  useEffect(() => {
    sessionStorage.setItem(`${VISITED_PREFIX}${pathname}`, '1');
  }, [pathname]);

  return null;
}

/**
 * Loading fallback gate (used inside `loading.tsx` Suspense boundaries).
 *
 * Default behaviour is to RENDER the skeleton: this guarantees the fallback is
 * visible during server-side render and the first client paint while the route
 * RSC streams in. Rendering `null` by default (the previous behaviour) left the
 * Suspense fallback empty on the server, so users saw a blank dark `--bg`
 * surface — the "pantalla negra" symptom — until the page content arrived.
 *
 * The only optimisation kept is suppressing the skeleton flash on instant
 * client-side navigations: once we confirm (on the client) that this route was
 * already visited in this session, we render nothing so the cached content
 * swaps in without a skeleton blink.
 */
export function RouteSkeletonGate({ children }: RouteSkeletonGateProps) {
  const pathname = usePathname();
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    setSuppressed(sessionStorage.getItem(`${VISITED_PREFIX}${pathname}`) === '1');
  }, [pathname]);

  if (suppressed) return null;
  return <>{children}</>;
}
