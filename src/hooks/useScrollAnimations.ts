'use client';

import { useEffect } from 'react';
import { initScrollAnimations } from '@/lib/gsap';

/**
 * Hook para inicializar animaciones de scroll en cualquier página.
 * Usa GSAP ScrollTrigger batch sobre elementos con data-animate.
 * Respeta prefers-reduced-motion automáticamente (gestionado en gsap.ts).
 */
export function useScrollAnimations() {
  useEffect(() => {
    initScrollAnimations();
  }, []);
}
