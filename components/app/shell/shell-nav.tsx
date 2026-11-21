'use client';

/**
 * The shell's main navigation.
 *
 * Overview and Settings only for now; each feature adds its own item as its
 * page lands (the design's full list is Overview, Targets, Runs, Findings,
 * Schedules, History, Settings). Settings is Sunrise's own settings page.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AUTH_LANDING_ROUTE } from '@/lib/auth-landing/route';

interface ShellNavItem {
  label: string;
  href: string;
  /** Also current on pages below `href`. Overview is the root, so it matches exactly. */
  nested: boolean;
}

export const SHELL_NAV_ITEMS: readonly ShellNavItem[] = [
  { label: 'Overview', href: AUTH_LANDING_ROUTE, nested: false },
  { label: 'Settings', href: '/settings', nested: true },
];

function isCurrent(item: ShellNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return item.nested && pathname.startsWith(`${item.href}/`);
}

export function ShellNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-row flex-wrap gap-0.5 md:flex-col">
      {SHELL_NAV_ITEMS.map((item) => {
        const current = isCurrent(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={
              'focus-visible:ring-ring flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none ' +
              (current
                ? 'bg-background text-foreground font-semibold dark:bg-(--color-surface-raised)'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
