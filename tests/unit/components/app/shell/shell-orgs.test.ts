/**
 * loadShellOrgs: the shell's org list, validated, or an honest null.
 *
 * @see components/app/shell/shell-orgs.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadShellOrgs } from '@/components/app/shell/shell-orgs';
import { loadServerData } from '@/lib/api/server-load';
import { logger } from '@/lib/logging';

vi.mock('@/lib/api/server-load', () => ({ loadServerData: vi.fn() }));
vi.mock('@/lib/logging', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

beforeEach(() => {
  vi.mocked(loadServerData).mockReset();
  vi.mocked(logger.error).mockReset();
});

describe('loadShellOrgs', () => {
  it('reads GET /api/v1/orgs and returns the active org and the list', async () => {
    vi.mocked(loadServerData).mockResolvedValue({
      ok: true,
      meta: undefined,
      data: {
        activeOrgId: 'org-a',
        orgs: [
          {
            id: 'org-a',
            slug: 'example-co',
            name: 'Example Co',
            status: 'ACTIVE',
            role: 'OWNER',
            joinedAt: '2026-11-01T00:00:00.000Z',
            active: true,
          },
        ],
      },
    });

    await expect(loadShellOrgs()).resolves.toEqual({
      activeOrgId: 'org-a',
      orgs: [{ id: 'org-a', name: 'Example Co', status: 'ACTIVE' }],
    });
    expect(loadServerData).toHaveBeenCalledWith('/api/v1/orgs');
  });

  it('returns null when the load failed (loadServerData has logged it)', async () => {
    vi.mocked(loadServerData).mockResolvedValue({
      ok: false,
      failure: { kind: 'failed', status: 500, code: null },
    });
    await expect(loadShellOrgs()).resolves.toBeNull();
  });

  it('returns null and logs when the body has the wrong shape', async () => {
    vi.mocked(loadServerData).mockResolvedValue({
      ok: true,
      meta: undefined,
      data: { orgs: 'not a list' },
    });
    await expect(loadShellOrgs()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Shell org list has an unexpected shape',
      expect.anything(),
      { path: '/api/v1/orgs' }
    );
  });
});
