// @vitest-environment happy-dom

/**
 * OrgSwitcher: the first UI caller of `POST /api/v1/orgs/switch`.
 *
 * The load-bearing cases are the wiring: the switch request carries the chosen
 * org, the page is refreshed only after it succeeds, and a user with one org is
 * offered no choice at all.
 *
 * @see components/app/shell/org-switcher.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { OrgSwitcher } from '@/components/app/shell/org-switcher';
import { apiClient, APIClientError } from '@/lib/api/client';
import type { ShellOrgs } from '@/components/app/shell/shell-orgs';
import { createMockRouter } from '@/tests/types/mocks';

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, apiClient: { post: vi.fn() } };
});

const refresh = vi.fn();

const TWO_ORGS: ShellOrgs = {
  activeOrgId: 'org-a',
  orgs: [
    { id: 'org-a', name: 'Example Co', status: 'ACTIVE' },
    { id: 'org-b', name: 'Other Ltd', status: 'ACTIVE' },
  ],
};

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset();
  refresh.mockReset();
  vi.mocked(useRouter).mockReturnValue(createMockRouter({ refresh }));
});

describe('OrgSwitcher', () => {
  it('shows a single-org user their org and offers no choice', () => {
    render(
      <OrgSwitcher
        orgs={{ activeOrgId: 'install', orgs: [{ id: 'install', name: 'Acme', status: 'ACTIVE' }] }}
      />
    );

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('offers a single org the session is not acting in, so the user is not stranded', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ activeOrgId: 'only' });
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        orgs={{ activeOrgId: null, orgs: [{ id: 'only', name: 'Acme', status: 'ACTIVE' }] }}
      />
    );

    await user.click(screen.getByRole('button', { name: /no organisation.*switch organisation/i }));
    await user.click(screen.getByRole('menuitem', { name: /acme/i }));

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/orgs/switch', { body: { orgId: 'only' } });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('says the org list could not be loaded, rather than showing none', () => {
    render(<OrgSwitcher orgs={null} />);
    expect(screen.getByText('Organisation unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('lists every org for a user in more than one, marking the active one', async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher orgs={TWO_ORGS} />);

    await user.click(screen.getByRole('button', { name: /example co.*switch organisation/i }));

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Example Co'),
      expect.stringContaining('Other Ltd'),
    ]);
    // The current org is not a switch target.
    expect(items[0]).toHaveAttribute('data-disabled');
    expect(items[1]).not.toHaveAttribute('data-disabled');
  });

  it('switches with the chosen org id, then refreshes the page', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ activeOrgId: 'org-b' });
    const user = userEvent.setup();
    render(<OrgSwitcher orgs={TWO_ORGS} />);

    await user.click(screen.getByRole('button', { name: /switch organisation/i }));
    await user.click(screen.getByRole('menuitem', { name: /other ltd/i }));

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/orgs/switch', {
      body: { orgId: 'org-b' },
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    // Refresh follows the switch, never races it.
    expect(vi.mocked(apiClient.post).mock.invocationCallOrder[0]).toBeLessThan(
      refresh.mock.invocationCallOrder[0]
    );
  });

  it('shows the refusal and does not refresh when the switch fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new APIClientError('That organisation is suspended', 'FORBIDDEN', 403)
    );
    const user = userEvent.setup();
    render(<OrgSwitcher orgs={TWO_ORGS} />);

    await user.click(screen.getByRole('button', { name: /switch organisation/i }));
    await user.click(screen.getByRole('menuitem', { name: /other ltd/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That organisation is suspended');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lists a suspended org but does not offer it as a target', async () => {
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        orgs={{
          activeOrgId: 'org-a',
          orgs: [TWO_ORGS.orgs[0], { id: 'org-c', name: 'Paused Inc', status: 'SUSPENDED' }],
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /switch organisation/i }));
    const suspended = screen.getByRole('menuitem', { name: /paused inc/i });
    expect(suspended).toHaveTextContent('Suspended');
    expect(suspended).toHaveAttribute('data-disabled');
  });
});
