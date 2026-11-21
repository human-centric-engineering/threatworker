// @vitest-environment happy-dom

/**
 * ThreatWorker's signed-in layout: the shell, inside Sunrise's maintenance
 * wrapper, fed the orgs the layout loaded; and a cookie with no live session
 * behind it is cleared rather than rendered.
 *
 * @see app/(threatworker)/layout.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThreatWorkerLayout from '@/app/(threatworker)/layout';
import { loadShellOrgs } from '@/components/app/shell/shell-orgs';
import type { ShellOrgs } from '@/components/app/shell/shell-orgs';
import { auth } from '@/lib/auth/config';
import { clearInvalidSession } from '@/lib/auth/clear-session';

vi.mock('@/components/maintenance-wrapper', () => ({
  MaintenanceWrapperWithAdminNotice: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="maintenance-wrapper">{children}</div>
  ),
}));
vi.mock('@/components/app/shell/shell-orgs', () => ({ loadShellOrgs: vi.fn() }));
vi.mock('@/components/app/shell/app-shell', () => ({
  AppShell: ({ orgs, children }: { orgs: ShellOrgs | null; children: React.ReactNode }) => (
    <div data-testid="app-shell" data-active-org={orgs?.activeOrgId ?? 'none'}>
      {children}
    </div>
  ),
}));

vi.mock('@/lib/auth/config', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/auth/clear-session', () => ({
  // The real one redirects, which throws; so does this.
  clearInvalidSession: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));
vi.mock('@/lib/auth-landing/route', () => ({
  AUTH_LANDING_ROUTE: '/threatworker',
  AUTH_LANDING_LABEL: 'Overview',
}));

beforeEach(() => {
  vi.mocked(loadShellOrgs).mockReset();
  vi.mocked(clearInvalidSession).mockClear();
  vi.mocked(auth.api.getSession).mockResolvedValue(
    {} as Awaited<ReturnType<typeof auth.api.getSession>>
  );
});

describe('ThreatWorkerLayout', () => {
  it('clears a session cookie with no live session behind it, before loading anything', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    await expect(ThreatWorkerLayout({ children: <p>Page body</p> })).rejects.toThrow(
      'NEXT_REDIRECT'
    );
    expect(clearInvalidSession).toHaveBeenCalledWith('/threatworker');
    expect(loadShellOrgs).not.toHaveBeenCalled();
  });

  it('does not clear a live session when the lookup itself fails', async () => {
    vi.mocked(auth.api.getSession).mockRejectedValue(new Error('database timeout'));

    await expect(ThreatWorkerLayout({ children: <p>Page body</p> })).rejects.toThrow(
      'database timeout'
    );
    expect(clearInvalidSession).not.toHaveBeenCalled();
  });

  it('renders the shell inside the maintenance wrapper with the loaded orgs', async () => {
    vi.mocked(loadShellOrgs).mockResolvedValue({
      activeOrgId: 'org-a',
      orgs: [{ id: 'org-a', name: 'Example Co', status: 'ACTIVE' }],
    });

    render(await ThreatWorkerLayout({ children: <p>Page body</p> }));

    const wrapper = screen.getByTestId('maintenance-wrapper');
    const shell = screen.getByTestId('app-shell');
    expect(wrapper).toContainElement(shell);
    expect(shell).toHaveAttribute('data-active-org', 'org-a');
    expect(shell).toHaveTextContent('Page body');
  });

  it('still renders the page when the orgs could not be loaded', async () => {
    vi.mocked(loadShellOrgs).mockResolvedValue(null);

    render(await ThreatWorkerLayout({ children: <p>Page body</p> }));

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-active-org', 'none');
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
