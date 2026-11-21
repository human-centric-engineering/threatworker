'use client';

/**
 * The active org, and a switch between orgs for a user in more than one.
 *
 * The first UI caller of `POST /api/v1/orgs/switch`. The switch re-issues the
 * session cookie with the new org; `router.refresh()` then re-renders the
 * server components, so the shell and the page re-read under that org. A user
 * in one org (every user at `TENANCY_MODE=single`) sees its name and no
 * control, because there is nothing to choose.
 *
 * @see components/app/shell/shell-orgs.ts · app/api/v1/orgs/switch/route.ts
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { apiClient, APIClientError } from '@/lib/api/client';
import { API } from '@/lib/api/endpoints';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ShellOrgs } from '@/components/app/shell/shell-orgs';

interface OrgSwitcherProps {
  /** The user's orgs, or `null` when they could not be loaded. */
  orgs: ShellOrgs | null;
}

const BOX =
  'border-border bg-card text-foreground flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2.5 text-left text-sm font-medium';

export function OrgSwitcher({ orgs }: OrgSwitcherProps): React.ReactElement {
  const router = useRouter();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!orgs) {
    return <p className={`${BOX} text-muted-foreground`}>Organisation unavailable</p>;
  }

  const active = orgs.orgs.find((org) => org.id === orgs.activeOrgId) ?? null;
  const activeName = active?.name ?? 'No organisation';

  if (orgs.orgs.length <= 1) {
    return (
      <p className={BOX}>
        <span className="sr-only">Organisation: </span>
        <span className="truncate">{activeName}</span>
      </p>
    );
  }

  async function switchTo(orgId: string): Promise<void> {
    setSwitchingTo(orgId);
    setError(null);
    try {
      await apiClient.post(API.ORGS.SWITCH, { body: { orgId } });
      router.refresh();
    } catch (err) {
      setError(err instanceof APIClientError ? err.message : 'Could not switch organisation');
    } finally {
      setSwitchingTo(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${BOX} focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none`}
          disabled={switchingTo !== null}
        >
          <span className="truncate">
            <span className="sr-only">Organisation: </span>
            {switchingTo ? 'Switching…' : activeName}
          </span>
          <ChevronDown aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="sr-only">, switch organisation</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuLabel>Switch organisation</DropdownMenuLabel>
          {orgs.orgs.map((org) => {
            const isActive = org.id === orgs.activeOrgId;
            const suspended = org.status !== 'ACTIVE';
            return (
              <DropdownMenuItem
                key={org.id}
                disabled={isActive || suspended}
                onSelect={() => void switchTo(org.id)}
                className="min-h-11"
              >
                <span className="flex-1 truncate">{org.name}</span>
                {suspended && <span className="text-muted-foreground text-xs">Suspended</span>}
                {isActive && <Check aria-label="Current" className="h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
