// @vitest-environment happy-dom

/**
 * BrandMark slot (issue #347)
 *
 * The fork-owned header/footer brand slot. Its default body renders `BRAND.name`
 * as a bare string (no wrapper element) so vanilla header/footer HTML is
 * unchanged. `BRAND.name` is read from `lib/app/brand.ts` at module load, so
 * each case stubs the env and re-imports fresh.
 *
 * @see components/brand/brand-mark.tsx · lib/brand.ts
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function renderBrandMark(): Promise<HTMLElement> {
  const { BrandMark } = await import('@/components/brand/brand-mark');
  const { container } = render(React.createElement(BrandMark));
  return container;
}

describe('BrandMark default', () => {
  it('renders the default brand name when the seam is unset', async () => {
    const container = await renderBrandMark();
    expect(container.textContent).toBe('Sunrise');
  });

  // Fork-brand cases live in tests/unit/brand-fork-surfaces.test.tsx, which
  // mocks the seam HOISTED. Driving a brand from here needs doMock +
  // resetModules + re-import, which races the module graph and failed on CI.

  // ThreatWorker fork: the slot is filled with the canary mark (divergence
  // ledger row 2). Sunrise's version asserted the scaffold's bare string.
  it('renders the canary mark as decoration beside the brand name', async () => {
    const container = await renderBrandMark();
    const mark = container.querySelector('img');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('src')).toContain('/brand/threatworker-mark.svg');
    // Decorative: the wordmark text is the accessible name, so the image adds none.
    expect(mark?.getAttribute('alt')).toBe('');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
  });
});
