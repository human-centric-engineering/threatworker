/**
 * ThreatWorker's signed-in frame: a side navigation and a fluid main area.
 *
 * The aside holds the mark, the active org, the main navigation, and the
 * account controls (theme, user menu, Cookie Preferences). From `md` up it is
 * a 220px column beside the content; below that it stacks above it, so a phone
 * never scrolls sideways. Design: the canvas's D-App boards.
 *
 * Presentational: the layout loads the orgs and passes them in.
 *
 * @see app/(threatworker)/layout.tsx
 */

import Link from 'next/link';
import { BrandMark } from '@/components/brand/brand-mark';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserButton } from '@/components/auth/user-button';
import { AUTH_LANDING_ROUTE } from '@/lib/auth-landing/route';
import { OrgSwitcher } from '@/components/app/shell/org-switcher';
import { ShellNav } from '@/components/app/shell/shell-nav';
import { CookiePreferencesButton } from '@/components/app/shell/cookie-preferences-button';
import type { ShellOrgs } from '@/components/app/shell/shell-orgs';

interface AppShellProps {
  orgs: ShellOrgs | null;
  children: React.ReactNode;
}

export function AppShell({ orgs, children }: AppShellProps): React.ReactElement {
  return (
    <div
      data-testid="app-shell"
      className="bg-background text-foreground flex min-h-screen flex-col md:flex-row"
    >
      <aside
        data-testid="app-shell-aside"
        className="border-border flex flex-col gap-6 border-b bg-(--color-nav) px-4 py-5 md:w-[220px] md:shrink-0 md:border-r md:border-b-0"
      >
        <Link
          href={AUTH_LANDING_ROUTE}
          className="focus-visible:ring-ring rounded-lg px-2 text-[19px] font-bold focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandMark />
        </Link>
        <OrgSwitcher orgs={orgs} />
        <ShellNav />
        <div className="flex flex-wrap items-center gap-2 md:mt-auto">
          <ThemeToggle />
          <UserButton />
          <CookiePreferencesButton />
        </div>
      </aside>
      <main data-testid="app-shell-main" className="min-w-0 flex-1 px-4 pt-7 pb-14 md:px-10">
        {children}
      </main>
    </div>
  );
}
