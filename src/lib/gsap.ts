/**
 * gsap.ts — Sistema de animaciones GSAP para WaaS
 *
 * Principios (Emil Kowalski):
 * - Solo animar transform y opacity
 * - ease-in NUNCA en UI — siempre ease-out o ease-in-out
 * - Hover gated: solo en (hover: hover) and (pointer: fine)
 * - prefers-reduced-motion: respetado en todas las funciones
 */

import type { gsap as GSAPType } from 'gsap';

let gsapInstance: typeof GSAPType | null = null;
let scrollTriggerRegistered = false;

// ─── Core GSAP loader ───────────────────────────────────────────────────────

export async function getGSAP() {
  if (typeof window === 'undefined') return null;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;

  if (!gsapInstance) {
    const { gsap } = await import('gsap');
    gsapInstance = gsap;
  }
  return gsapInstance;
}

export async function getGSAPWithScrollTrigger() {
  if (typeof window === 'undefined') return null;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;

  const gsap = await getGSAP();
  if (!gsap) return null;

  if (!scrollTriggerRegistered) {
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    gsap.registerPlugin(ScrollTrigger);
    scrollTriggerRegistered = true;
  }

  return gsap;
}

// ─── Micro-interactions (L1) ────────────────────────────────────────────────

/** Fade + slide up: elementos entrando en pantalla */
export async function animateIn(element: HTMLElement | null, delay = 0) {
  if (!element) return;
  const gsap = await getGSAP();
  if (!gsap) {
    element.style.opacity = '1';
    return;
  }
  gsap.fromTo(
    element,
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.5, delay, ease: 'power2.out' }
  );
}

/** Error shake */
export async function animateShake(element: HTMLElement | null) {
  if (!element) return;
  const gsap = await getGSAP();
  if (!gsap) return;
  gsap.to(element, {
    keyframes: { x: [-8, 8, -6, 6, -4, 4, 0] },
    duration: 0.4,
    ease: 'none',
  });
}

/** Success scale pulse */
export async function animateSuccess(element: HTMLElement | null) {
  if (!element) return;
  const gsap = await getGSAP();
  if (!gsap) return;
  gsap.to(element, {
    keyframes: { scale: [1.05, 0.97, 1] },
    duration: 0.35,
    ease: 'none',
  });
}

// ─── Hero Sequence (L3 — Cinematográfico) ───────────────────────────────────

/**
 * Secuencia de entrada del hero (landing page).
 * Usa GSAP Timeline con stagger por secciones.
 * Solo se ejecuta una vez (primera carga).
 */
export async function animateHeroSequence(refs: {
  eyebrow: HTMLElement | null;
  h1Lines: HTMLElement[];
  subheadline: HTMLElement | null;
  ctas: HTMLElement[];
  heroVisual: HTMLElement | null;
}) {
  const gsap = await getGSAP();
  if (!gsap) {
    // Fallback: mostrar todo sin animación
    [refs.eyebrow, ...refs.h1Lines, refs.subheadline, ...refs.ctas, refs.heroVisual]
      .filter(Boolean)
      .forEach(el => { if (el) { el.style.opacity = '1'; el.style.transform = 'none'; } });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // Eyebrow: clip-path reveal + fade
  if (refs.eyebrow) {
    tl.fromTo(
      refs.eyebrow,
      { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
      { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.6 }
    );
  }

  // H1: líneas con stagger
  if (refs.h1Lines.length) {
    tl.fromTo(
      refs.h1Lines,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 },
      '-=0.3'
    );
  }

  // Subheadline
  if (refs.subheadline) {
    tl.fromTo(
      refs.subheadline,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.6 },
      '-=0.4'
    );
  }

  // CTAs con stagger y scale
  if (refs.ctas.length) {
    tl.fromTo(
      refs.ctas,
      { opacity: 0, scale: 0.93, y: 8 },
      { opacity: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(1.4)' },
      '-=0.3'
    );
  }

  // Hero visual (mockup)
  if (refs.heroVisual) {
    tl.fromTo(
      refs.heroVisual,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
      '-=0.4'
    );
  }
}

// ─── Scroll Animations (L2) ─────────────────────────────────────────────────

/**
 * Inicializa animaciones de scroll con ScrollTrigger batch.
 * Agrega data-animate a cualquier elemento para que entre con fade-up.
 */
export async function initScrollAnimations() {
  const gsap = await getGSAPWithScrollTrigger();
  if (!gsap) return;

  ScrollTrigger.batch('[data-animate]', {
    onEnter: (elements) => {
      gsap.fromTo(
        elements,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.6,
          ease: 'power2.out',
        }
      );
    },
    once: true,
    start: 'top 88%',
  });
}

/**
 * Counter animation para métricas numéricas.
 * Cuenta desde 0 hasta el valor final cuando entra en viewport.
 */
export async function animateCounter(
  element: HTMLElement | null,
  targetValue: number,
  suffix = ''
) {
  if (!element) return;
  const gsap = await getGSAPWithScrollTrigger();
  if (!gsap) {
    element.textContent = `${targetValue}${suffix}`;
    return;
  }

  const obj = { value: 0 };
  gsap.to(obj, {
    value: targetValue,
    duration: 1.5,
    ease: 'power2.out',
    snap: { value: 1 },
    scrollTrigger: {
      trigger: element,
      start: 'top 80%',
      once: true,
    },
    onUpdate: () => {
      element.textContent = `${Math.round(obj.value)}${suffix}`;
    },
    onComplete: () => {
      element.textContent = `${targetValue}${suffix}`;
    },
  });
}

// ─── Magnetic Hover (solo desktop) ─────────────────────────────────────────

/**
 * Efecto magnético en hover de botones CTA.
 * Solo activado en dispositivos con pointer fino (desktop).
 * Emil Kowalski: hover gated con (hover: hover) and (pointer: fine)
 */
export async function magneticHover(element: HTMLElement | null) {
  if (!element) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const gsap = await getGSAP();
  if (!gsap) return;

  const handleMouseMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * 0.25;
    const deltaY = (e.clientY - centerY) * 0.25;
    gsap.to(element, { x: deltaX, y: deltaY, duration: 0.4, ease: 'power2.out' });
  };

  const handleMouseLeave = () => {
    gsap.to(element, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
  };

  element.addEventListener('mousemove', handleMouseMove);
  element.addEventListener('mouseleave', handleMouseLeave);

  // Retorna cleanup function
  return () => {
    element.removeEventListener('mousemove', handleMouseMove);
    element.removeEventListener('mouseleave', handleMouseLeave);
  };
}

// ─── State Badge Transition (portal) ────────────────────────────────────────

/**
 * Animación de transición de estado en el portal cliente.
 * Cuando el estado del proyecto cambia, el badge anima.
 */
export async function animateStateBadge(element: HTMLElement | null) {
  if (!element) return;
  const gsap = await getGSAP();
  if (!gsap) return;
  gsap.fromTo(
    element,
    { scale: 0.85, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }
  );
}

/**
 * Animación de progress bar al montar el componente.
 */
export async function animateProgressBar(
  element: HTMLElement | null,
  targetWidth: string
) {
  if (!element) return;
  const gsap = await getGSAP();
  if (!gsap) {
    element.style.width = targetWidth;
    return;
  }
  gsap.fromTo(
    element,
    { width: '0%' },
    { width: targetWidth, duration: 1, ease: 'power2.out', delay: 0.2 }
  );
}
