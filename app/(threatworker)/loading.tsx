/**
 * Loading state for ThreatWorker's signed-in pages: a heading-shaped skeleton
 * inside the shell, which stays in place while a page streams in.
 */
export default function ThreatWorkerLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <div className="bg-muted h-10 w-48 animate-pulse rounded" />
      <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded" />
    </div>
  );
}
