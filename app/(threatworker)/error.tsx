'use client';

/**
 * Error boundary for ThreatWorker's signed-in pages.
 *
 * The platform's route boundary, as `(protected)` uses it: it checks for an
 * expired session and offers a way back to Overview.
 */

import { LayoutDashboard } from 'lucide-react';
import { RouteErrorBoundary } from '@/components/errors/route-error-boundary';
import { AUTH_LANDING_LABEL, AUTH_LANDING_ROUTE } from '@/lib/auth-landing/route';

export default function ThreatWorkerError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): React.ReactElement {
  return (
    <RouteErrorBoundary
      error={error}
      retry={retry}
      boundaryName="ThreatWorkerError"
      tag="threatworker"
      title="Something went wrong"
      description="An error occurred while loading this page. This has been logged."
      checkSession
      fallback={{
        label: AUTH_LANDING_LABEL,
        href: AUTH_LANDING_ROUTE,
        icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
      }}
    />
  );
}
