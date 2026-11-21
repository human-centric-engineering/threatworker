import type { Metadata } from 'next';
import { MaintenanceWrapperWithAdminNotice } from '@/components/maintenance-wrapper';
import { AppShell } from '@/components/app/shell/app-shell';
import { loadShellOrgs } from '@/components/app/shell/shell-orgs';
import { BRAND } from '@/lib/brand';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/config';
import { clearInvalidSession } from '@/lib/auth/clear-session';
import { AUTH_LANDING_ROUTE } from '@/lib/auth-landing/route';

export const metadata: Metadata = {
  title: {
    template: `%s - ${BRAND.name}`,
    default: BRAND.name,
  },
};

/**
 * ThreatWorker's signed-in frame.
 *
 * Its own route group because the design's side-navigation shell is a
 * different frame from Sunrise's `(protected)` top header (CUSTOMIZATION §6);
 * no platform layout is edited. Signed-out visitors are bounced to login by
 * the proxy, through the `/threatworker` prefix in `lib/app/protected-routes.ts`
 * (a route group alone gates nothing). The proxy only sees that a session
 * cookie exists, so the layout checks the session is real, as Sunrise's
 * protected pages do: an expired or revoked one is cleared and sent to login,
 * where the proxy would otherwise bounce it straight back here.
 *
 * It asks better-auth directly rather than through `getServerSession()`, which
 * turns a failed lookup into null: here that would clear a live session on a
 * database blip. A lookup that throws reaches the error boundary instead.
 * The cleared user returns to Overview, not the page they opened; there are no
 * deeper pages yet to lose. Keeps Sunrise's maintenance wrapper.
 */
export default async function ThreatWorkerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    clearInvalidSession(AUTH_LANDING_ROUTE);
  }
  const orgs = await loadShellOrgs();
  return (
    <MaintenanceWrapperWithAdminNotice>
      <AppShell orgs={orgs}>{children}</AppShell>
    </MaintenanceWrapperWithAdminNotice>
  );
}
