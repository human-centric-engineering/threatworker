// @vitest-environment happy-dom

/**
 * ShellNav: real links, the current page marked with `aria-current`.
 *
 * @see components/app/shell/shell-nav.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { ShellNav } from '@/components/app/shell/shell-nav';

vi.mock('@/lib/auth-landing/route', () => ({
  AUTH_LANDING_ROUTE: '/threatworker',
  AUTH_LANDING_LABEL: 'Overview',
}));

function renderAt(pathname: string): void {
  vi.mocked(usePathname).mockReturnValue(pathname);
  render(<ShellNav />);
}

describe('ShellNav', () => {
  it('links Overview to the landing route and Settings to the settings page', () => {
    renderAt('/threatworker');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/threatworker');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('marks Overview current on the landing route only', () => {
    renderAt('/threatworker');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark Overview current on a page below it', () => {
    renderAt('/threatworker/targets');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('marks Settings current on its sub-pages too', () => {
    renderAt('/settings/security');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('gives every link a 44px target', () => {
    renderAt('/threatworker');
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-11');
    }
  });
});
