// @vitest-environment happy-dom

/**
 * Overview stand-in: says what will appear here until the findings dashboard
 * (`f-findings`) replaces it.
 *
 * @see app/(threatworker)/threatworker/page.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OverviewPage, { metadata } from '@/app/(threatworker)/threatworker/page';

describe('Overview page', () => {
  it('is titled Overview and says what will appear here', () => {
    render(<OverviewPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Your open findings will appear here' })
    ).toBeInTheDocument();
    expect(metadata.title).toBe('Overview');
  });
});
