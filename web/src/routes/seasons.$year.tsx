import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoadState, Page, Reveal, Select, Stripe } from "@/components/kit";
import { fmtDate, pct, useData, type IndexFile, type SeasonFile } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seasons/$year")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.year} season — Lights Out` },
      { name: "description", content: `Standings, calendar and how the model called every podium of the ${params.year} Formula 1 season.` },
    ],
  }),
  component: Season,
});

function Season() {
  const { year } = Route.useParams();
  const navigate = useNavigate();
  const q = useData<SeasonFile>(`seasons/${year}.json`);
  const { data: index } = useData<IndexFile>("index.json");
  const years = index ? [...index.seasons].reverse().map((s) => s.year) : [Number(year)];
  const s = q.data;
  const open = (round: number) => navigate({ to: "/predict", search: { year: Number(year), round } });
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal>
          <h1 className="display text-[clamp(44px,7vw,104px)]">{year} season</h1>
        </Reveal>
        <Select label="Season" value={year} onChange={(v) => navigate({ to: "/seasons/$year", params: { year: v } })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      {!s ? (
        <div className="mt-10">
          <LoadState error={q.error} onRetry={() => q.refetch()} rows={8} />
        </div>
      ) : (
        <>
          <Reveal i={1}>
            <p className="mt-6 max-w-3xl text-[19px]">
              {s.podiumHitRate != null ? (
                <>
                  The model called <b className="tnum">{pct(s.podiumHitRate, 1)}</b> of podium places this season. The first three on the grid called{" "}
                  <b className="tnum">{pct(s.gridPodiumHitRate, 1)}</b>.
                </>
              ) : (
                "No completed races to score yet."
              )}
            </p>
          </Reveal>
          <div className="mt-16 grid gap-16 lg:grid-cols-[2fr_3fr]">
            <Reveal i={2}>
              <h2 className="display text-4xl">Standings</h2>
              <table className="mt-6 w-full text-left text-[15px]">
                <thead className="text-[13px] text-muted-foreground">
                  <tr>
                    <th className="py-2 font-normal">Pos</th>
                    <th className="font-normal">Driver</th>
                    <th className="text-right font-normal">Points</th>
                    <th className="text-right font-normal">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {s.standings.map((r) => (
                    <tr key={r.driverId} className="border-t border-border hover:bg-raised">
                      <td className="py-2">{r.position}</td>
                      <td>
                        <Link to="/drivers/$id" params={{ id: String(r.driverId) }} className="flex items-center gap-2 hover:underline">
                          <Stripe team={r.team} />
                          <span className="font-semibold">{r.name}</span>
                          <span className="hidden text-muted-foreground sm:inline">{r.team}</span>
                        </Link>
                      </td>
                      <td className="text-right">{r.points}</td>
                      <td className="text-right">{r.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Reveal i={3}>
              <h2 className="display text-4xl">Calendar</h2>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[15px]">
                  <thead className="text-[13px] text-muted-foreground">
                    <tr>
                      <th className="py-2 font-normal">Rd</th>
                      <th className="font-normal">Race</th>
                      <th className="font-normal">Date</th>
                      <th className="font-normal">Winner</th>
                      <th className="font-normal">Top pick</th>
                      <th className="font-normal">Podium hits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.races.map((r) => {
                      const has = r.status !== "scheduled";
                      return (
                        <tr
                          key={r.round}
                          className={cn("border-t border-border", has && "cursor-pointer hover:bg-raised")}
                          onClick={has ? () => open(r.round) : undefined}
                          onKeyDown={
                            has
                              ? (e) => {
                                  if (e.key === "Enter") open(r.round);
                                }
                              : undefined
                          }
                          tabIndex={has ? 0 : undefined}
                          role={has ? "link" : undefined}
                        >
                          <td className="py-3">{r.round}</td>
                          <td className="font-semibold">{r.name.replace(" Grand Prix", " GP")}</td>
                          <td>{fmtDate(r.date)}</td>
                          <td>
                            {r.podium?.[0]?.code ??
                              (r.status === "completed" ? "–" : <span className="text-muted-foreground">{r.status === "scheduled" ? "Not yet" : "Next race"}</span>)}
                          </td>
                          <td>{r.predictedPodium?.[0] ?? "–"}</td>
                          <td>
                            {r.podiumHits != null ? (
                              <span className="flex gap-1" aria-label={`${r.podiumHits} of 3 podium places called`}>
                                {[0, 1, 2].map((i) => (
                                  <span key={i} className={cn("size-3 border", i < r.podiumHits! ? "border-primary bg-primary" : "border-muted-foreground")} />
                                ))}
                              </span>
                            ) : (
                              "–"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </>
      )}
    </Page>
  );
}
