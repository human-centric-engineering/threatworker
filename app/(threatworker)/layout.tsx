import type { Metadata } from 'next';
import { MaintenanceWrapperWithAdminNotice } from '@/components/maintenance-wrapper';
import { AppShell } from '@/components/app/shell/app-shell';
import { loadShellOrgs } from '@/components/app/shell/shell-orgs';
import { BRAND } from '@/lib/brand';

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
 * (a route group alone gates nothing). Keeps Sunrise's maintenance wrapper.
 */
export default async function ThreatWorkerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgs = await loadShellOrgs();
  return (
    <MaintenanceWrapperWithAdminNotice>
      <AppShell orgs={orgs}>{children}</AppShell>
    </MaintenanceWrapperWithAdminNotice>
  );
}
