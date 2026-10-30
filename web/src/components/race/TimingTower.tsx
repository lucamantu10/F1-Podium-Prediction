import type { DriverPrediction } from "@/lib/api";
import { pct } from "@/lib/format";
import { teamColor } from "@/lib/teams";

/** Every driver ordered by podium chance, styled after the broadcast timing tower. */
export function TimingTower({
  drivers,
  topPickId,
  selectedId,
  showResult,
  onSelect,
}: {
  drivers: DriverPrediction[];
  topPickId: number;
  selectedId: number;
  showResult: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="type-condensed tabular w-full min-w-[34rem] text-sm">
        <caption className="sr-only">All drivers ordered by podium probability</caption>
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-2 font-medium">Driver</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Grid</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Win</th>
            <th scope="col" className="w-2/5 px-2 py-2 font-medium">Podium</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Expected</th>
            {showResult && (
              <th scope="col" className="py-2 pl-2 text-right font-medium">Finished</th>
            )}
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr
              key={d.driver_id}
              className={`border-b border-line/60 ${d.driver_id === selectedId ? "bg-asphalt-2" : ""}`}
            >
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                <button
                  type="button"
                  onClick={() => onSelect(d.driver_id)}
                  className="flex items-center gap-2.5 rounded-sm py-0.5 hover:text-paint"
                >
                  <span aria-hidden className="h-4 w-1 rounded-full" style={{ background: teamColor(d.team) }} />
                  <span className="text-base font-bold text-paint">{d.code}</span>
                  <span className="hidden text-ink-2 sm:inline">{d.name}</span>
                </button>
              </th>
              <td className="px-2 text-right text-ink-2">{d.grid}</td>
              <td className="px-2 text-right">{pct(d.win_probability)}</td>
              <td className="px-2">
                <span className="flex items-center gap-2">
                  <span className="w-10 text-right font-semibold">{pct(d.probability)}</span>
                  <span aria-hidden className="h-1.5 flex-1 rounded-full bg-asphalt-2">
                    <span
                      className={`block h-full rounded-full ${d.driver_id === topPickId ? "bg-purple" : "bg-paint/60"}`}
                      style={{ width: `${Math.max(d.probability * 100, 0.5)}%` }}
                    />
                  </span>
                </span>
              </td>
              <td className="px-2 text-right text-ink-2">
                {d.expected_position ? `P${d.expected_position.toFixed(1)}` : "–"}
              </td>
              {showResult && (
                <td className="pl-2 text-right font-semibold">
                  {d.finish_position ? `P${d.finish_position}` : "–"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
