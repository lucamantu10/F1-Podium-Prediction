"""Static JSON bundle for the web app.

The web app has no server: it reads these files and runs the race simulator in the
browser. The model ships as plain numbers (imputer medians, scaler, weights) per
backtest fold, so past races stay out-of-sample and what-if grids work offline.

Layout under ``out_dir``::

    index.json                 seasons, latest and next race, headline metrics
    model.json                 features, simulator parameters per fold, backtest metrics
    seasons/{year}.json        calendar with winners and the model's podium calls
    races/{year}-{round}.json  entry list with raw pre-race features and results
    drivers/index.json         every driver who raced since the first backtest season
    drivers/{driverId}.json    profile, career and season stats, recent races
    teams/index.json           every team that raced since the first backtest season
    teams/{constructorId}.json seasons, totals, drivers and recent races
    championship.json          current standings and remaining calendar (mid-season only)
"""

import json
import math
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from f1podium import __version__
from f1podium.config import ARTIFACTS_DIR, BACKTEST_START_YEAR, PODIUM_SIZE, PRIMARY_MODEL, ROOT_DIR
from f1podium.data import build_entries, load_raw, race_calendar
from f1podium.features import FEATURE_INFO, FEATURES, build_features
from f1podium.models import RaceSimulator

DEFAULT_OUT_DIR = ROOT_DIR / "web" / "public" / "data"


def _clean(value):
    """JSON-safe scalars: NaN -> None, numpy -> python, floats rounded."""
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_clean(v) for v in value]
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, float | np.floating):
        if math.isnan(value) or math.isinf(value):
            return None
        return int(value) if float(value).is_integer() else round(float(value), 5)
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    return value


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_clean(payload), separators=(",", ":"), ensure_ascii=False), encoding="utf-8"
    )


def simulator_params(model: RaceSimulator) -> dict:
    return {
        "median": model.imputer_.statistics_.tolist(),
        "mean": model.scaler_.mean_.tolist(),
        "scale": model.scaler_.scale_.tolist(),
        "coef": model.coef_.tolist(),
    }


class Exporter:
    def __init__(self, artifacts_dir: Path = ARTIFACTS_DIR):
        self.raw = load_raw()
        self.features = build_features(build_entries(self.raw), self.raw)
        self.metrics = json.loads((artifacts_dir / "metrics.json").read_text())
        models_dir = artifacts_dir / "models"
        self.final = joblib.load(models_dir / f"{PRIMARY_MODEL}.joblib")["model"]
        self.folds = joblib.load(models_dir / f"{PRIMARY_MODEL}_folds.joblib")
        self.backtest = pd.read_csv(artifacts_dir / "backtest_predictions.csv")

        circuits = self.raw.circuits.rename(columns={"name": "circuit_name"})
        self.calendar = race_calendar(self.raw).merge(
            circuits[["circuitId", "circuit_name", "location", "country", "lat", "lng"]],
            on="circuitId",
            how="left",
        )
        status = self.features.groupby("raceId")["entry_status"].first()
        self.calendar["status"] = (
            self.calendar["raceId"].map(status).fillna("scheduled").replace({"result": "completed"})
        )
        self.calendar = self.calendar[self.calendar["year"] >= BACKTEST_START_YEAR]

        drivers = self.raw.drivers.set_index("driverId")
        self.driver_info = drivers
        result_status = self.raw.results.merge(self.raw.status, on="statusId")
        # A few old races list a driver twice (shared cars); keep the first entry.
        self.status_text = result_status.drop_duplicates(["raceId", "driverId"]).set_index(
            ["raceId", "driverId"]
        )["status"]
        # Recent entries feed driver pages; restrict to drivers seen since the backtest start.
        self.recent = self.features[self.features["year"] >= BACKTEST_START_YEAR]

        # Race distance in laps (the winner's lap count) for the replay animation.
        laps = self.raw.results.groupby("raceId")["laps"].max()
        all_races = race_calendar(self.raw)
        all_races["laps"] = all_races["raceId"].map(laps)
        self.race_laps = all_races.set_index("raceId")["laps"]
        self.circuit_laps = (
            all_races.dropna(subset=["laps"])
            .sort_values("race_seq")
            .groupby("circuitId")["laps"]
            .last()
        )

    # --- helpers ------------------------------------------------------------------
    def _circuit(self, race) -> dict:
        return {
            "name": race["circuit_name"],
            "location": race["location"],
            "country": race["country"],
            "lat": race["lat"],
            "lng": race["lng"],
        }

    def _driver_ref(self, row) -> dict:
        return {
            "driverId": int(row["driverId"]),
            "code": row["driver_code"],
            "name": row["driver_name"],
            "team": row["team_name"],
            "constructorId": int(row["constructorId"]),
        }

    # --- files --------------------------------------------------------------------
    def model(self) -> dict:
        return {
            "features": [
                {"name": f, "label": label, "description": desc}
                for f, (label, desc) in FEATURE_INFO.items()
            ],
            "final": simulator_params(self.final),
            "folds": {str(season): simulator_params(m) for season, m in self.folds.items()},
            "trainedThrough": self.metrics["trained_through"],
            "trainStartYear": self.metrics["train_start_year"],
            "backtestSeasons": self.metrics["backtest_seasons"],
            "selectedModel": self.metrics["selected_model"],
            "models": self.metrics["models"],
            "baseline": self.metrics["baseline"],
            "featureImportance": self.metrics["feature_importance"],
        }

    def race(self, race) -> dict:
        entries = self.features[self.features["raceId"] == race["raceId"]].sort_values("grid")
        completed = race["status"] == "completed"
        fold = int(race["year"]) if completed and int(race["year"]) in self.folds else None
        rows = []
        for _, e in entries.iterrows():
            info = self.driver_info.loc[e["driverId"]]
            rows.append(
                {
                    **self._driver_ref(e),
                    "number": info["number"],
                    "nationality": info["nationality"],
                    "grid": e["grid"],
                    "qualiPosition": e["quali_position"],
                    "finishPosition": e["finish_position"],
                    "points": e["points"],
                    "status": self.status_text.get((e["raceId"], e["driverId"])),
                    "features": [e[f] for f in FEATURES],
                }
            )
        return {
            "raceId": int(race["raceId"]),
            "year": int(race["year"]),
            "round": int(race["round"]),
            "name": race["race_name"],
            "date": race["date"],
            "circuit": self._circuit(race),
            "status": race["status"],
            # Which simulator parameters to use: the backtest fold that never saw this
            # season for completed races, the final model for upcoming ones.
            "model": str(fold) if fold else "final",
            "outOfSample": bool(fold) or not completed,
            "laps": self._laps(race),
            "entries": rows,
        }

    def _laps(self, race) -> int:
        laps = self.race_laps.get(race["raceId"])
        if laps is None or pd.isna(laps):
            laps = self.circuit_laps.get(race["circuitId"], 58)
        return int(laps)

    # --- teams ----------------------------------------------------------------------
    def _team_entries(self, constructor_id: int) -> pd.DataFrame:
        return self.recent[
            (self.recent["constructorId"] == constructor_id)
            & self.recent["finish_position"].notna()
        ].sort_values("race_seq")

    def _constructor_final_standing(self, constructor_id: int, year: int):
        races = race_calendar(self.raw)
        races = races[
            (races["year"] == year) & races["raceId"].isin(self.raw.constructor_standings["raceId"])
        ]
        if races.empty:
            return None, None
        last = races.iloc[-1]["raceId"]
        row = self.raw.constructor_standings[
            (self.raw.constructor_standings["raceId"] == last)
            & (self.raw.constructor_standings["constructorId"] == constructor_id)
        ]
        if row.empty:
            return None, None
        return int(row["position"].iloc[0]), float(row["points"].iloc[0])

    def teams_index(self) -> list[dict]:
        latest_year = int(self.recent["year"].max())
        out = []
        for cid, g in self.recent[self.recent["finish_position"].notna()].groupby("constructorId"):
            g = g.sort_values("race_seq")
            last = g.iloc[-1]
            out.append(
                {
                    "constructorId": int(cid),
                    "name": last["team_name"],
                    "firstSeason": int(g["year"].min()),
                    "lastSeason": int(last["year"]),
                    "active": int(last["year"]) == latest_year,
                    "starts": int(g["raceId"].nunique()),
                    "wins": int((g["finish_position"] == 1).sum()),
                    "podiums": int((g["finish_position"] <= 3).sum()),
                    "drivers": [
                        self._driver_ref(r)
                        for _, r in g[g["year"] == last["year"]]
                        .drop_duplicates("driverId")
                        .iterrows()
                    ],
                }
            )
        return sorted(out, key=lambda t: (not t["active"], -t["wins"], -t["podiums"], t["name"]))

    def team(self, constructor_id: int) -> dict:
        g = self._team_entries(constructor_id)
        nationality = self.raw.constructors.set_index("constructorId")["nationality"].get(
            constructor_id
        )
        seasons = []
        for year, y in g.groupby("year"):
            position, points = self._constructor_final_standing(constructor_id, int(year))
            drivers = []
            for _, r in y.drop_duplicates("driverId").iterrows():
                scored = float(y.loc[y["driverId"] == r["driverId"], "points"].sum())
                drivers.append({**self._driver_ref(r), "points": scored})
            seasons.append(
                {
                    "year": int(year),
                    "name": y["team_name"].iloc[-1],
                    "championshipPosition": position,
                    "points": points if points is not None else float(y["points"].sum()),
                    "wins": int((y["finish_position"] == 1).sum()),
                    "podiums": int((y["finish_position"] <= 3).sum()),
                    "poles": int((y["quali_position"] == 1).sum()),
                    "dnfs": int((y["finished"] == 0).sum()),
                    "drivers": drivers,
                }
            )
        recent = []
        for _, r in list(g.groupby("raceId", sort=False))[-24:]:
            best = r.sort_values("finish_position").iloc[0]
            recent.append(
                {
                    "year": int(best["year"]),
                    "round": int(best["round"]),
                    "race": best["race_name"],
                    "bestFinish": best["finish_position"],
                    "points": float(r["points"].sum()),
                    "finishes": [
                        {
                            "code": x["driver_code"],
                            "finishPosition": x["finish_position"],
                            "grid": x["grid"],
                        }
                        for _, x in r.iterrows()
                    ],
                }
            )
        last = g.iloc[-1] if len(g) else None
        one_twos = g.groupby("raceId")["finish_position"].apply(lambda s: {1, 2} <= set(s)).sum()
        current = g[g["year"] == g["year"].max()].drop_duplicates("driverId") if len(g) else g
        return {
            "constructorId": constructor_id,
            "name": last["team_name"] if last is not None else None,
            "nationality": nationality,
            "seasons": seasons,
            "totals": {
                "starts": int(g["raceId"].nunique()),
                "wins": int((g["finish_position"] == 1).sum()),
                "podiums": int((g["finish_position"] <= 3).sum()),
                "poles": int((g["quali_position"] == 1).sum()),
                "points": float(g["points"].sum()),
                "oneTwos": int(one_twos),
            },
            "recentRaces": recent,
            "currentDrivers": [self._driver_ref(r) for _, r in current.iterrows()],
        }

    # --- championship ------------------------------------------------------------------
    def championship(self) -> dict | None:
        """Current standings and the remaining calendar of the latest season."""
        season = self.calendar[self.calendar["year"] == self.calendar["year"].max()]
        remaining = season[season["status"] != "completed"]
        upcoming = season[season["status"].isin(["qualifying", "projected"])]
        if remaining.empty or upcoming.empty:
            return None
        year = int(season["year"].iloc[0])
        completed = season[season["status"] == "completed"]
        teams = []
        if not completed.empty:
            last = completed.iloc[-1]["raceId"]
            table = self.raw.constructor_standings[self.raw.constructor_standings["raceId"] == last]
            names = self.raw.constructors.set_index("constructorId")["name"]
            teams = [
                {
                    "constructorId": int(r.constructorId),
                    "name": names.get(r.constructorId),
                    "points": float(r.points),
                    "position": int(r.position),
                }
                for r in table.sort_values("position").itertuples()
            ]
        nxt = upcoming.iloc[0]
        return {
            "year": year,
            "afterRound": int(completed["round"].max()) if not completed.empty else 0,
            # Every remaining round is simulated from the next race's entry list.
            "entryListRace": f"{year}-{int(nxt['round'])}",
            "pointsSystem": [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
            "remaining": [
                {
                    "round": int(r["round"]),
                    "name": r["race_name"],
                    "date": r["date"],
                    "circuit": self._circuit(r),
                }
                for _, r in remaining.iterrows()
            ],
            "drivers": self._standings(year),
            "teams": teams,
        }

    def season(self, year: int, races: pd.DataFrame) -> dict:
        out = []
        for _, race in races.iterrows():
            item = {
                "round": int(race["round"]),
                "name": race["race_name"],
                "date": race["date"],
                "circuit": self._circuit(race),
                "status": race["status"],
            }
            entries = self.features[self.features["raceId"] == race["raceId"]]
            if race["status"] == "completed":
                podium = entries[entries["finish_position"] <= PODIUM_SIZE].sort_values(
                    "finish_position"
                )
                item["podium"] = [self._driver_ref(r) for _, r in podium.iterrows()]
                predicted = self.backtest[self.backtest["raceId"] == race["raceId"]]
                if not predicted.empty:
                    top3 = predicted.nlargest(PODIUM_SIZE, f"prob_{PRIMARY_MODEL}")
                    item["predictedPodium"] = top3["driver_code"].tolist()
                    item["podiumHits"] = int((top3["finish_position"] <= PODIUM_SIZE).sum())
            out.append(item)
        per_season = self.metrics["models"][PRIMARY_MODEL]["per_season"].get(str(year))
        baseline = self.metrics["baseline"]["per_season"].get(str(year))
        return {
            "year": year,
            "races": out,
            "podiumHitRate": per_season["podium_hit_rate"] if per_season else None,
            "gridPodiumHitRate": baseline["podium_hit_rate"] if baseline else None,
            "standings": self._standings(year),
        }

    def _standings(self, year: int) -> list[dict]:
        season_races = self.calendar[
            (self.calendar["year"] == year) & (self.calendar["status"] == "completed")
        ]
        if season_races.empty:
            return []
        last = season_races.iloc[-1]["raceId"]
        table = self.raw.driver_standings[self.raw.driver_standings["raceId"] == last]
        table = table.sort_values("position").merge(
            self.raw.drivers[["driverId", "code", "forename", "surname"]], on="driverId"
        )
        teams = (
            self.features[
                (self.features["year"] == year) & self.features["finish_position"].notna()
            ]
            .sort_values("race_seq")
            .groupby("driverId")
            .last()[["team_name", "constructorId"]]
        )
        return [
            {
                "position": r.position,
                "driverId": r.driverId,
                "code": r.code,
                "name": f"{r.forename} {r.surname}",
                "points": r.points,
                "wins": r.wins,
                "team": teams["team_name"].get(r.driverId),
                "constructorId": teams["constructorId"].get(r.driverId),
            }
            for r in table.itertuples()
        ]

    def driver(self, driver_id: int) -> dict:
        info = self.driver_info.loc[driver_id]
        history = self.features[
            (self.features["driverId"] == driver_id) & self.features["finish_position"].notna()
        ].sort_values("race_seq")
        modern = history[history["year"] >= BACKTEST_START_YEAR]
        probs = self.backtest.set_index(["raceId", "driverId"])[f"prob_{PRIMARY_MODEL}"]

        def summary(frame: pd.DataFrame) -> dict:
            return {
                "starts": len(frame),
                "wins": int((frame["finish_position"] == 1).sum()),
                "podiums": int((frame["finish_position"] <= 3).sum()),
                "poles": int((frame["quali_position"] == 1).sum()),
                "points": float(frame["points"].sum()),
                "dnfs": int((frame["finished"] == 0).sum()),
                "avgFinish": frame["finish_position"].mean() if len(frame) else None,
                "avgGrid": frame["grid"].mean() if len(frame) else None,
                "bestFinish": frame["finish_position"].min() if len(frame) else None,
            }

        seasons = []
        for year, g in history.groupby("year"):
            standing = self._champ_position(driver_id, int(year))
            seasons.append(
                {
                    "year": int(year),
                    "team": g["team_name"].mode().iloc[0],
                    "constructorId": int(g["constructorId"].mode().iloc[0]),
                    "championshipPosition": standing,
                    **summary(g),
                }
            )

        recent = []
        for _, r in modern.tail(24).iterrows():
            recent.append(
                {
                    "year": int(r["year"]),
                    "round": int(r["round"]),
                    "race": r["race_name"],
                    "team": r["team_name"],
                    "grid": r["grid"],
                    "qualiPosition": r["quali_position"],
                    "finishPosition": r["finish_position"],
                    "points": r["points"],
                    "status": self.status_text.get((r["raceId"], driver_id)),
                    "predictedPodium": probs.get((r["raceId"], driver_id)),
                }
            )

        circuits = (
            history.groupby("race_name")
            .agg(
                starts=("finish_position", "size"),
                wins=("finish_position", lambda s: int((s == 1).sum())),
                podiums=("finish_position", lambda s: int((s <= 3).sum())),
                avgFinish=("finish_position", "mean"),
                best=("finish_position", "min"),
            )
            .reset_index()
            .rename(columns={"race_name": "race"})
            .sort_values(["podiums", "avgFinish"], ascending=[False, True])
        )

        latest = history.iloc[-1] if len(history) else None
        form = (
            {f: latest[f] for f in FEATURES if f.startswith(("drv_", "con_"))}
            if latest is not None
            else {}
        )
        return {
            "driverId": driver_id,
            "code": info["code"],
            "name": f"{info['forename']} {info['surname']}",
            "forename": info["forename"],
            "surname": info["surname"],
            "number": info["number"],
            "nationality": info["nationality"],
            "dateOfBirth": info["dob"],
            "currentTeam": latest["team_name"] if latest is not None else None,
            "constructorId": int(latest["constructorId"]) if latest is not None else None,
            "firstRace": {
                "year": int(history.iloc[0]["year"]),
                "race": history.iloc[0]["race_name"],
            }
            if len(history)
            else None,
            "career": summary(history),
            "seasons": seasons,
            "recentRaces": recent,
            "circuits": circuits.head(12).to_dict("records"),
            "form": form,
            "teammate": self._teammate(driver_id, history),
        }

    def _champ_position(self, driver_id: int, year: int):
        races = self.calendar[
            (self.calendar["year"] == year) & (self.calendar["status"] == "completed")
        ]
        if races.empty:
            races = race_calendar(self.raw)
            races = races[races["year"] == year]
            races = races[races["raceId"].isin(self.raw.driver_standings["raceId"])]
        if races.empty:
            return None
        last = races.iloc[-1]["raceId"]
        row = self.raw.driver_standings[
            (self.raw.driver_standings["raceId"] == last)
            & (self.raw.driver_standings["driverId"] == driver_id)
        ]
        return int(row["position"].iloc[0]) if not row.empty else None

    def _teammate(self, driver_id: int, history: pd.DataFrame):
        """Head-to-head with teammates in the driver's latest season."""
        if history.empty:
            return None
        year = int(history["year"].max())
        mine = history[history["year"] == year][
            ["raceId", "constructorId", "quali_position", "finish_position"]
        ]
        others = self.features[
            (self.features["year"] == year)
            & (self.features["driverId"] != driver_id)
            & self.features["finish_position"].notna()
        ][
            [
                "raceId",
                "constructorId",
                "driverId",
                "driver_name",
                "quali_position",
                "finish_position",
            ]
        ]
        pairs = mine.merge(others, on=["raceId", "constructorId"], suffixes=("", "_mate"))
        if pairs.empty:
            return None
        mate = pairs["driver_name"].mode().iloc[0]
        pairs = pairs[pairs["driver_name"] == mate]
        return {
            "year": year,
            "name": mate,
            "driverId": int(pairs["driverId"].iloc[0]),
            "races": len(pairs),
            "qualiAhead": int((pairs["quali_position"] < pairs["quali_position_mate"]).sum()),
            "raceAhead": int((pairs["finish_position"] < pairs["finish_position_mate"]).sum()),
        }

    def index(self, driver_ids: list[int]) -> dict:
        completed = self.calendar[self.calendar["status"] == "completed"]
        upcoming = self.calendar[self.calendar["status"].isin(["qualifying", "projected"])]
        primary = self.metrics["models"][self.metrics["selected_model"]]["overall"]
        seasons = [
            {
                "year": int(y),
                "races": len(g),
                "completed": int((g["status"] == "completed").sum()),
            }
            for y, g in self.calendar.groupby("year")
        ]

        def ref(race):
            return {
                "year": int(race["year"]),
                "round": int(race["round"]),
                "name": race["race_name"],
                "date": race["date"],
                "status": race["status"],
                "circuit": self._circuit(race),
            }

        return {
            "version": __version__,
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "trainedThrough": self.metrics["trained_through"],
            "modelLabel": "Race Simulator (Plackett-Luce)",
            "seasons": seasons,
            "latestRace": ref(completed.iloc[-1]) if not completed.empty else None,
            "nextRace": ref(upcoming.iloc[0]) if not upcoming.empty else None,
            "headline": {
                "podiumHitRate": primary["podium_hit_rate"],
                "topPickPodiumRate": primary["top_pick_podium_rate"],
                "rocAuc": primary["roc_auc"],
                "logLoss": primary["log_loss"],
                "gridPodiumHitRate": self.metrics["baseline"]["overall"]["podium_hit_rate"],
                "racesBacktested": primary["races"],
            },
            "driverCount": len(driver_ids),
        }

    def drivers_index(self, driver_ids: list[int]) -> list[dict]:
        latest_year = int(self.recent["year"].max())
        out = []
        for driver_id in driver_ids:
            history = self.recent[
                (self.recent["driverId"] == driver_id) & self.recent["finish_position"].notna()
            ]
            if history.empty:
                continue
            last = history.sort_values("race_seq").iloc[-1]
            info = self.driver_info.loc[driver_id]
            out.append(
                {
                    "driverId": driver_id,
                    "code": info["code"],
                    "name": f"{info['forename']} {info['surname']}",
                    "number": info["number"],
                    "nationality": info["nationality"],
                    "team": last["team_name"],
                    "constructorId": int(last["constructorId"]),
                    "lastSeason": int(last["year"]),
                    "active": int(last["year"]) == latest_year,
                    "starts": len(history),
                    "wins": int((history["finish_position"] == 1).sum()),
                    "podiums": int((history["finish_position"] <= 3).sum()),
                }
            )
        return sorted(out, key=lambda d: (not d["active"], -d["podiums"], d["name"]))


def export(out_dir: Path = DEFAULT_OUT_DIR, artifacts_dir: Path = ARTIFACTS_DIR, log=print) -> dict:
    log("Building export...")
    ex = Exporter(artifacts_dir)
    driver_ids = sorted(
        int(d) for d in ex.recent.loc[ex.recent["finish_position"].notna(), "driverId"].unique()
    )

    _write(out_dir / "model.json", ex.model())
    counts = {"races": 0, "seasons": 0, "drivers": 0}
    for year, races in ex.calendar.groupby("year"):
        _write(out_dir / "seasons" / f"{int(year)}.json", ex.season(int(year), races))
        counts["seasons"] += 1
        for _, race in races.iterrows():
            if race["status"] == "scheduled":
                continue
            _write(out_dir / "races" / f"{int(year)}-{int(race['round'])}.json", ex.race(race))
            counts["races"] += 1
    drivers_index = ex.drivers_index(driver_ids)
    _write(out_dir / "drivers" / "index.json", drivers_index)
    for d in drivers_index:
        _write(out_dir / "drivers" / f"{d['driverId']}.json", ex.driver(d["driverId"]))
        counts["drivers"] += 1
    teams_index = ex.teams_index()
    _write(out_dir / "teams" / "index.json", teams_index)
    for t in teams_index:
        _write(out_dir / "teams" / f"{t['constructorId']}.json", ex.team(t["constructorId"]))
    counts["teams"] = len(teams_index)
    championship = ex.championship()
    if championship:
        _write(out_dir / "championship.json", championship)
    _write(out_dir / "index.json", ex.index([d["driverId"] for d in drivers_index]))
    log(f"Exported {counts} to {out_dir}")
    return counts
