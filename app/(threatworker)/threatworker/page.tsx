import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Overview',
};

/**
 * Overview — where a signed-in user lands.
 *
 * A stand-in until the open-findings dashboard (`f-findings`) replaces it:
 * it says what will appear here rather than showing empty numbers.
 */
export default function OverviewPage(): React.ReactElement {
  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-[34px] leading-10 font-bold tracking-[-0.02em]">Overview</h1>
      <section
        aria-labelledby="overview-empty"
        className="border-border bg-card flex max-w-2xl flex-col gap-2 rounded-[14px] border px-5 py-5"
      >
        <h2 id="overview-empty" className="text-[15px] font-semibold">
          Your open findings will appear here
        </h2>
        <p className="text-muted-foreground text-sm leading-6">
          Once you add a target and run a scan, this page shows what is open across your targets, by
          severity, and anything past its fix-by date.
        </p>
      </section>
    </div>
  );
}
