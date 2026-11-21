'use client';

/**
 * Cookie Preferences, for a frame without the platform footer.
 *
 * Consent has to be reachable from every page, and the platform footer is
 * where Sunrise renders it; the shell does not use that footer, so it renders
 * this instead (CUSTOMIZATION §6, "Two rules if you take your own frame").
 */

import { useConsent } from '@/lib/consent';

export function CookiePreferencesButton(): React.ReactElement {
  const { openPreferences } = useConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring min-h-11 rounded-lg px-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      Cookie Preferences
    </button>
  );
}
