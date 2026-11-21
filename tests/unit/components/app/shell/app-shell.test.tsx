// @vitest-environment happy-dom

/**
 * AppShell: the side-navigation frame.
 *
 * Asserts what the frame must carry (mark, org, nav, Cookie Preferences, the
 * page) and the responsive contract: a column stack below `md`, a side column
 * from `md` up, and a main area that cannot force the page wider than the
 * viewport. Screenshots in the PR show the rendered result.
 *
 * @see components/app/shell/app-shell.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '@/components/app/shell/app-shell';

const openPreferences = vi.fn();

vi.mock('@/lib/consent', () => ({
  useConsent: () => ({ openPreferences }),
}));
vi.mock('@/lib/auth-landing/route', () => ({
  AUTH_LANDING_ROUTE: '/threatworker',
  AUTH_LANDING_LABEL: 'Overview',
}));
// The account controls are Sunrise's own, tested where they live.
vi.mock('@/components/auth/user-button', () => ({
  UserButton: () => <button type="button">User menu</button>,
}));
vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Toggle theme</button>,
}));

function renderShell(): void {
  render(
    <AppShell
      orgs={{ activeOrgId: 'install', orgs: [{ id: 'install', name: 'Acme', status: 'ACTIVE' }] }}
    >
      <h1>Page body</h1>
    </AppShell>
  );
}

describe('AppShell', () => {
  it('renders the mark linked to Overview, the active org, the nav and the page', () => {
    renderShell();

    const aside = screen.getByTestId('app-shell-aside');
    const homeLink = screen.getAllByRole('link').find((a) => a.querySelector('img'));
    expect(homeLink).toHaveAttribute('href', '/threatworker');
    expect(aside).toHaveTextContent('Acme');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Page body');
  });

  it('keeps the account controls in the frame', () => {
    renderShell();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
  });

  it('renders a Cookie Preferences control that opens the consent preferences', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Cookie Preferences' }));
    expect(openPreferences).toHaveBeenCalledTimes(1);
  });

  it('stacks the navigation above the content below md, and sets it beside from md', () => {
    renderShell();
    const shell = screen.getByTestId('app-shell');
    const aside = screen.getByTestId('app-shell-aside');
    const main = screen.getByTestId('app-shell-main');

    // Column (stacked) by default, row only from md.
    expect(shell.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(shell.className).toContain('md:flex-row');
    expect(shell.className).not.toMatch(/(^|\s)flex-row(\s|$)/);
    // The 220px column width applies only from md; below it the aside is full width.
    expect(aside.className).toContain('md:w-[220px]');
    expect(aside.className).not.toMatch(/(^|\s)w-\[/);
    // Aside comes first in the DOM, so stacked it sits above the content.
    expect(aside.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // min-w-0 lets wide content shrink or scroll inside main instead of widening the page.
    expect(main.className).toContain('min-w-0');
    // A 16px side gutter at phone width.
    expect(main.className).toMatch(/(^|\s)px-4(\s|$)/);
  });
});
