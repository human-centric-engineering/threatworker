// @vitest-environment happy-dom

/**
 * ThreatWorker's signed-in layout: the shell, inside Sunrise's maintenance
 * wrapper, fed the orgs the layout loaded.
 *
 * @see app/(threatworker)/layout.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThreatWorkerLayout from '@/app/(threatworker)/layout';
import { loadShellOrgs } from '@/components/app/shell/shell-orgs';
import type { ShellOrgs } from '@/components/app/shell/shell-orgs';

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

describe('ThreatWorkerLayout', () => {
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
