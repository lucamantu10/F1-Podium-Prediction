import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoadState, Page } from "@/components/kit";
import { useData, type IndexFile } from "@/lib/data";

export const Route = createFileRoute("/seasons/")({
  component: LatestSeason,
});

/** /seasons opens the current season. */
function LatestSeason() {
  const q = useData<IndexFile>("index.json");
  if (!q.data)
    return (
      <Page>
        <LoadState error={q.error} onRetry={() => q.refetch()} />
      </Page>
    );
  const year = q.data.nextRace?.year ?? q.data.latestRace.year;
  return <Navigate to="/seasons/$year" params={{ year: String(year) }} replace />;
}
