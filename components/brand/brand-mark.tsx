import Image from 'next/image';
import { BRAND } from '@/lib/brand';

/**
 * BrandMark — the header/footer brand slot, filled with ThreatWorker's mark.
 *
 * **Fork-owned scaffold** (CUSTOMIZATION.md §2): Sunrise ships this rendering
 * `BRAND.name` as text and never changes it after release, so this body merges
 * cleanly on upgrade.
 *
 * The canary mark is the design system's `threatworker-mark.svg`, copied
 * byte-for-byte to `public/brand/` (never redrawn). It is decorative here: the
 * wordmark beside it is `BRAND.name` itself, set lowercase by CSS only, so the
 * link's accessible name and text content stay exactly the brand name — which
 * is what the header and fork-surface tests read.
 */
export function BrandMark(): React.ReactNode {
  return (
    <span className="inline-flex items-center gap-2.5 align-middle">
      <Image
        src="/brand/threatworker-mark.svg"
        alt=""
        aria-hidden="true"
        width={30}
        height={30}
        unoptimized
        priority
        className="shrink-0"
      />
      <span className="font-display tracking-[-0.02em] lowercase">{BRAND.name}</span>
    </span>
  );
}
