/**
 * The orgs the side-navigation shell's switcher shows.
 *
 * Loaded on the server from `GET /api/v1/orgs` (the member view's entry point)
 * and validated here, so the switcher receives a typed list or an honest
 * "could not load" rather than a cast. Fork-owned (`components/app/`).
 *
 * @see app/api/v1/orgs/route.ts · components/app/shell/org-switcher.tsx
 */

import { z } from 'zod';
import { API } from '@/lib/api/endpoints';
import { loadServerData } from '@/lib/api/server-load';
import { logger } from '@/lib/logging';

const shellOrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** `ACTIVE` or `SUSPENDED`; a suspended org is listed but cannot be switched to. */
  status: z.string(),
});

const shellOrgsSchema = z.object({
  activeOrgId: z.string().nullable(),
  orgs: z.array(shellOrgSchema),
});

export type ShellOrg = z.infer<typeof shellOrgSchema>;
export type ShellOrgs = z.infer<typeof shellOrgsSchema>;

/**
 * The signed-in user's orgs and the one the session acts in, or `null` when
 * they could not be read. A failed load is logged (by `loadServerData`, or
 * here for a body of the wrong shape) and shown as such by the switcher; it
 * never reads as "no orgs".
 */
export async function loadShellOrgs(): Promise<ShellOrgs | null> {
  const result = await loadServerData<unknown>(API.ORGS.LIST);
  if (!result.ok) return null;

  const parsed = shellOrgsSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.error('Shell org list has an unexpected shape', parsed.error, {
      path: API.ORGS.LIST,
    });
    return null;
  }
  return parsed.data;
}
