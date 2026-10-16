/**
 * RouteSkeletonGate — regression guard for the "black screen" bug.
 *
 * The gate wraps the Suspense fallback inside `loading.tsx`. On the server it MUST
 * render its children so the skeleton is part of the streamed HTML. A previous
 * version returned `null` by default (useState(false) → return null), so the
 * Suspense fallback was empty on SSR and users saw the dark `--bg` surface as a
 * blank/black screen until the page content arrived.
 *
 * We assert SSR output directly with renderToStaticMarkup (no DOM testing lib):
 * useEffect does not run during SSR, so this pins the exact default-render path.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouteSkeletonGate } from '@/components/ui/RouteSkeletonGate';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('RouteSkeletonGate (SSR)', () => {
  it('renders children on the server — skeleton must NOT be blank', () => {
    const html = renderToStaticMarkup(
      <RouteSkeletonGate>
        <span data-testid="skeleton">SKELETON_CONTENT</span>
      </RouteSkeletonGate>,
    );
    expect(html).toContain('SKELETON_CONTENT');
    expect(html.trim()).not.toBe('');
  });
});
