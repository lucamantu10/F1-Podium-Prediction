"""Bring the dataset up to date from the Jolpica API (the successor of Ergast).

New seasons are converted to the Ergast CSV schema and written to ``data/live``.
The historical dump in ``data/raw`` is never modified; ``load_raw`` merges both.
"""

import json
import time
from collections.abc import Iterable
from hashlib import sha1
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from f1podium.config import LIVE_DATA_DIR, RAW_DATA_DIR
from f1podium.data import TABLES, RawData, read_tables

BASE_URL = "https://api.jolpi.ca/ergast/f1"
PAGE_SIZE = 100
# Jolpica allows 4 requests per second and 500 per hour.
REQUEST_INTERVAL_S = 0.3


class JolpicaClient:
    def __init__(self, cache_dir: Path | None = None, session: requests.Session | None = None):
        self.cache_dir = cache_dir
        self.session = session or requests.Session()
        self._last_request = 0.0

    def get(self, path: str, cache: bool = False) -> dict:
        """GET one page. ``cache=True`` stores it on disk (only for finished seasons)."""
        cache_file = None
        if cache and self.cache_dir:
            cache_file = self.cache_dir / f"{sha1(path.encode()).hexdigest()}.json"
            if cache_file.exists():
                return json.loads(cache_file.read_text())

        wait = REQUEST_INTERVAL_S - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            self._last_request = time.monotonic()
            response = self.session.get(f"{BASE_URL}/{path}", timeout=30)
            if response.status_code == 429:
                time.sleep(2 ** (attempt + 1))
                continue
            response.raise_for_status()
            break
        data = response.json()["MRData"]

        if cache_file:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(data))
        return data

    def races(self, path: str, cache: bool = False) -> list[dict]:
        """All races of a paginated endpoint, with per-race lists merged across pages."""
        merged: dict[str, dict] = {}
        offset, total = 0, None
        while total is None or offset < total:
            sep = "&" if "?" in path else "?"
            page = self.get(f"{path}{sep}limit={PAGE_SIZE}&offset={offset}", cache=cache)
            total = int(page["total"])
            for race in page["RaceTable"]["Races"]:
                key = race["round"]
                if key not in merged:
                    merged[key] = race
                    continue
                for field, value in race.items():
                    if isinstance(value, list):
                        merged[key].setdefault(field, []).extend(value)
            offset += PAGE_SIZE
        return list(merged.values())


class _Ids:
    """Maps Jolpica string refs to the numeric ids of the Ergast schema."""

    def __init__(self, table: pd.DataFrame, id_col: str, ref_col: str):
        self.id_col, self.ref_col = id_col, ref_col
        self.by_ref = dict(zip(table[ref_col], table[id_col], strict=True))
        self.next_id = int(table[id_col].max()) + 1
        self.new_rows: list[dict] = []

    def get(self, ref: str, **row) -> int:
        if ref not in self.by_ref:
            self.by_ref[ref] = self.next_id
            self.new_rows.append({self.id_col: self.next_id, self.ref_col: ref, **row})
            self.next_id += 1
        return self.by_ref[ref]


def _num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return np.nan


def fetch_seasons(
    seasons: Iterable[int],
    base: RawData,
    client: JolpicaClient,
    current_season: int,
    log=print,
) -> dict[str, pd.DataFrame]:
    """Download ``seasons`` and convert them into Ergast-schema tables of new rows."""
    drivers = _Ids(base.drivers, "driverId", "driverRef")
    constructors = _Ids(base.constructors, "constructorId", "constructorRef")
    circuits = _Ids(base.circuits, "circuitId", "circuitRef")
    status_ids = dict(zip(base.status["status"], base.status["statusId"], strict=True))
    new_status: list[dict] = []

    def status_id(text: str) -> int:
        if text not in status_ids:
            status_ids[text] = max(status_ids.values()) + 1
            new_status.append({"statusId": status_ids[text], "status": text})
        return status_ids[text]

    def driver_id(d: dict) -> int:
        return drivers.get(
            d["driverId"],
            number=d.get("permanentNumber"),
            code=d.get("code"),
            forename=d["givenName"],
            surname=d["familyName"],
            dob=d.get("dateOfBirth"),
            nationality=d.get("nationality"),
            url=d.get("url"),
        )

    def constructor_id(c: dict) -> int:
        return constructors.get(
            c["constructorId"], name=c["name"], nationality=c.get("nationality"), url=c.get("url")
        )

    next_race_id = int(base.races["raceId"].max()) + 1
    rows = {t: [] for t in ("races", "results", "qualifying")}
    rows |= {"driver_standings": [], "constructor_standings": []}

    for season in seasons:
        cache = season < current_season  # finished seasons never change
        calendar = client.races(f"{season}/races/", cache=cache)
        log(f"  {season}: {len(calendar)} races on the calendar")
        race_ids = {}
        for race in calendar:
            circuit = race["Circuit"]
            loc = circuit["Location"]
            race_ids[race["round"]] = next_race_id
            rows["races"].append(
                {
                    "raceId": next_race_id,
                    "year": season,
                    "round": int(race["round"]),
                    "circuitId": circuits.get(
                        circuit["circuitId"],
                        name=circuit["circuitName"],
                        location=loc.get("locality"),
                        country=loc.get("country"),
                        lat=_num(loc.get("lat")),
                        lng=_num(loc.get("long")),
                        url=circuit.get("url"),
                    ),
                    "name": race["raceName"],
                    "date": race["date"],
                    "time": race.get("time", "").rstrip("Z") or None,
                    "url": race.get("url"),
                }
            )
            next_race_id += 1

        results = client.races(f"{season}/results/", cache=cache)
        for race in results:
            for order, r in enumerate(race.get("Results", []), start=1):
                rows["results"].append(
                    {
                        "raceId": race_ids[race["round"]],
                        "driverId": driver_id(r["Driver"]),
                        "constructorId": constructor_id(r["Constructor"]),
                        "number": _num(r.get("number")),
                        "grid": _num(r.get("grid")),
                        "position": _num(r.get("position")),
                        "positionText": r.get("positionText"),
                        "positionOrder": order,
                        "points": _num(r.get("points")),
                        "laps": _num(r.get("laps")),
                        "time": r.get("Time", {}).get("time"),
                        "milliseconds": _num(r.get("Time", {}).get("millis")),
                        "statusId": status_id(r.get("status", "")),
                    }
                )

        for race in client.races(f"{season}/qualifying/", cache=cache):
            for q in race.get("QualifyingResults", []):
                rows["qualifying"].append(
                    {
                        "raceId": race_ids[race["round"]],
                        "driverId": driver_id(q["Driver"]),
                        "constructorId": constructor_id(q["Constructor"]),
                        "number": _num(q.get("number")),
                        "position": _num(q.get("position")),
                        "q1": q.get("Q1"),
                        "q2": q.get("Q2"),
                        "q3": q.get("Q3"),
                    }
                )

        completed = sorted(int(race["round"]) for race in results if race.get("Results"))
        for rnd in completed:
            race_id = race_ids[str(rnd)]
            page = client.get(f"{season}/{rnd}/driverstandings/?limit=100", cache=cache)
            for lst in page["StandingsTable"]["StandingsLists"]:
                for s in lst["DriverStandings"]:
                    rows["driver_standings"].append(
                        {
                            "raceId": race_id,
                            "driverId": driver_id(s["Driver"]),
                            "points": _num(s["points"]),
                            "position": _num(s.get("position")),
                            "positionText": s.get("positionText"),
                            "wins": _num(s.get("wins")),
                        }
                    )
            page = client.get(f"{season}/{rnd}/constructorstandings/?limit=100", cache=cache)
            for lst in page["StandingsTable"]["StandingsLists"]:
                for s in lst["ConstructorStandings"]:
                    rows["constructor_standings"].append(
                        {
                            "raceId": race_id,
                            "constructorId": constructor_id(s["Constructor"]),
                            "points": _num(s["points"]),
                            "position": _num(s.get("position")),
                            "positionText": s.get("positionText"),
                            "wins": _num(s.get("wins")),
                        }
                    )
        log(f"  {season}: {len(completed)} races with results")

    tables = {name: pd.DataFrame(r) for name, r in rows.items()}
    tables["drivers"] = pd.DataFrame(drivers.new_rows)
    tables["constructors"] = pd.DataFrame(constructors.new_rows)
    tables["circuits"] = pd.DataFrame(circuits.new_rows)
    tables["status"] = pd.DataFrame(new_status)
    _assign_row_ids(tables, base)
    return tables


def _assign_row_ids(tables: dict[str, pd.DataFrame], base: RawData) -> None:
    for name, id_col in [
        ("results", "resultId"),
        ("qualifying", "qualifyId"),
        ("driver_standings", "driverStandingsId"),
        ("constructor_standings", "constructorStandingsId"),
    ]:
        df = tables[name]
        start = int(getattr(base, name)[id_col].max()) + 1
        df.insert(0, id_col, np.arange(start, start + len(df)))


def update(
    current_season: int | None = None,
    raw_dir: Path = RAW_DATA_DIR,
    live_dir: Path = LIVE_DATA_DIR,
    client: JolpicaClient | None = None,
    log=print,
) -> dict[str, int]:
    """Fetch every season after the historical dump up to ``current_season``."""
    base = read_tables(raw_dir)
    first = int(base.races.loc[base.races["raceId"].isin(base.results["raceId"]), "year"].max()) + 1
    current_season = current_season or pd.Timestamp.now().year
    client = client or JolpicaClient(cache_dir=live_dir / ".cache")
    log(f"Fetching seasons {first}-{current_season} from Jolpica...")
    tables = fetch_seasons(range(first, current_season + 1), base, client, current_season, log)

    live_dir.mkdir(parents=True, exist_ok=True)
    for name in TABLES:
        tables[name].to_csv(live_dir / f"{name}.csv", index=False)
    counts = {name: len(df) for name, df in tables.items()}
    log(f"Wrote {counts['results']} results across {counts['races']} races to {live_dir}")
    return counts
