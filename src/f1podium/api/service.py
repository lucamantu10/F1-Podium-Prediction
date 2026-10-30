"""Loads data and artifacts once and answers the questions the API exposes."""

import json
import math
from functools import cached_property
from pathlib import Path

import pandas as pd

from f1podium import __version__
from f1podium.api import schemas
from f1podium.config import ARTIFACTS_DIR, BACKTEST_START_YEAR, PODIUM_SIZE, PRIMARY_MODEL
from f1podium.data import build_entries, load_raw, race_calendar
from f1podium.features import build_features
from f1podium.predict import Predictor, RaceNotFound


class RaceNotPredictable(LookupError):
    """The race exists but its entry list is not known yet."""


def _num(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return value


def _int(value):
    value = _num(value)
    return None if value is None else int(value)


class F1Service:
    def __init__(self, artifacts_dir: Path = ARTIFACTS_DIR):
        self.raw = load_raw()
        self.features = build_features(build_entries(self.raw), self.raw)
        self.predictor = Predictor.load(artifacts_dir, features=self.features)
        self.metrics = json.loads((artifacts_dir / "metrics.json").read_text())
        backtest = pd.read_csv(artifacts_dir / "backtest_predictions.csv")
        self.backtest = backtest.rename(columns={f"prob_{PRIMARY_MODEL}": "probability"})
        self._predictions: dict[tuple[int, int], schemas.RacePrediction] = {}

    # --- calendar ---------------------------------------------------------------
    @cached_property
    def calendar(self) -> pd.DataFrame:
        circuits = self.raw.circuits.rename(columns={"name": "circuit_name"})
        cal = race_calendar(self.raw).merge(
            circuits[["circuitId", "circuit_name", "location", "country", "lat", "lng"]],
            on="circuitId",
            how="left",
        )
        cal = cal[cal["year"] >= BACKTEST_START_YEAR]
        entry_status = self.features.groupby("raceId")["entry_status"].first()
        cal["status"] = cal["raceId"].map(entry_status).fillna("scheduled")
        cal["status"] = cal["status"].replace({"result": "completed"})
        return cal.reset_index(drop=True)

    def _race_row(self, year: int, round_: int) -> pd.Series:
        row = self.calendar[(self.calendar["year"] == year) & (self.calendar["round"] == round_)]
        if row.empty:
            raise RaceNotFound(f"No race {year} round {round_}")
        return row.iloc[0]

    @staticmethod
    def _driver(row) -> schemas.DriverRef:
        return schemas.DriverRef(
            driver_id=int(row["driverId"]),
            code=_num(row["driver_code"]),
            name=row["driver_name"],
            team=_num(row["team_name"]),
        )

    def _summary(self, race: pd.Series, with_prediction: bool = True) -> schemas.RaceSummary:
        summary = schemas.RaceSummary(
            year=int(race["year"]),
            round=int(race["round"]),
            name=race["race_name"],
            date=race["date"].date().isoformat(),
            circuit=schemas.Circuit(
                name=race["circuit_name"],
                location=_num(race["location"]),
                country=_num(race["country"]),
                lat=_num(race["lat"]),
                lng=_num(race["lng"]),
            ),
            status=race["status"],
        )
        if race["status"] == "completed":
            entries = self.features[self.features["raceId"] == race["raceId"]]
            winner = entries[entries["finish_position"] == 1]
            if not winner.empty:
                summary.winner = self._driver(winner.iloc[0])
            predicted = self.backtest[self.backtest["raceId"] == race["raceId"]]
            if with_prediction and not predicted.empty:
                top3 = predicted.nlargest(PODIUM_SIZE, "probability")
                summary.predicted_winner = self._driver(top3.iloc[0])
                summary.podium_hits = int((top3["finish_position"] <= PODIUM_SIZE).sum())
        elif with_prediction and race["status"] in ("qualifying", "projected"):
            top = self.race_prediction(int(race["year"]), int(race["round"])).leaderboard[0]
            summary.predicted_winner = schemas.DriverRef(
                driver_id=top.driver_id, code=top.code, name=top.name, team=top.team
            )
        return summary

    def seasons(self) -> list[schemas.Season]:
        grouped = self.calendar.groupby("year")["status"]
        return [
            schemas.Season(year=int(year), races=len(s), completed=int((s == "completed").sum()))
            for year, s in grouped
        ]

    def races(self, year: int) -> list[schemas.RaceSummary]:
        season = self.calendar[self.calendar["year"] == year]
        if season.empty:
            raise RaceNotFound(f"No season {year}")
        return [self._summary(race) for _, race in season.iterrows()]

    # --- predictions ------------------------------------------------------------
    def race_prediction(
        self, year: int, round_: int, grid: dict[int, int] | None = None
    ) -> schemas.RacePrediction:
        key = (year, round_)
        if not grid and key in self._predictions:
            return self._predictions[key]
        race = self._race_row(year, round_)
        if race["status"] == "scheduled":
            raise RaceNotPredictable(
                f"{race['race_name']} {year}: the entry list is not available yet"
            )
        board = self.predictor.predict_race(year, round_, grid_overrides=grid)
        result = schemas.RacePrediction(
            race=self._summary(race, with_prediction=False),
            model=self.predictor.bundle["label"],
            out_of_sample=board.attrs["out_of_sample"],
            leaderboard=[self._prediction_row(r) for r in board.to_dict("records")],
            evaluation=self._evaluation(board) if race["status"] == "completed" else None,
        )
        if not grid:
            self._predictions[key] = result
        return result

    @staticmethod
    def _prediction_row(r: dict) -> schemas.DriverPrediction:
        return schemas.DriverPrediction(
            driver_id=int(r["driverId"]),
            code=_num(r["driver_code"]),
            name=r["driver_name"],
            team=_num(r["team_name"]),
            team_id=int(r["constructorId"]),
            grid=int(r["grid"]),
            quali_position=_int(r["quali_position"]),
            probability=float(r["probability"]),
            win_probability=_num(r.get("win_probability")),
            expected_position=_num(r.get("expected_position")),
            position_probabilities=r.get("position_probabilities"),
            explanation=r.get("explanation"),
            finish_position=_int(r["finish_position"]),
        )

    @staticmethod
    def _evaluation(board: pd.DataFrame) -> schemas.Evaluation:
        predicted = board.head(PODIUM_SIZE)
        actual = board[board["finish_position"] <= PODIUM_SIZE].sort_values("finish_position")
        hits = set(predicted["driverId"]) & set(actual["driverId"])
        winner = actual[actual["finish_position"] == 1]["driverId"].tolist()
        return schemas.Evaluation(
            predicted_podium=predicted["driver_code"].tolist(),
            actual_podium=actual["driver_code"].tolist(),
            podium_hits=len(hits),
            winner_on_predicted_podium=bool(winner and winner[0] in set(predicted["driverId"])),
            top_pick_on_podium=bool(predicted.iloc[0]["finish_position"] <= PODIUM_SIZE),
        )

    # --- overview ---------------------------------------------------------------
    def meta(self) -> schemas.Meta:
        completed = self.calendar[self.calendar["status"] == "completed"]
        upcoming = self.calendar[self.calendar["status"].isin(["qualifying", "projected"])]
        primary = self.metrics["models"][self.metrics["selected_model"]]["overall"]
        baseline = self.metrics["baseline"]["overall"]
        return schemas.Meta(
            version=__version__,
            model=self.metrics["selected_model"],
            model_label=self.predictor.bundle["label"],
            trained_through=self.metrics["trained_through"],
            seasons=self.seasons(),
            latest_race=self._summary(completed.iloc[-1]) if not completed.empty else None,
            next_race=self._summary(upcoming.iloc[0]) if not upcoming.empty else None,
            headline={
                "podium_hit_rate": primary["podium_hit_rate"],
                "top_pick_podium_rate": primary["top_pick_podium_rate"],
                "roc_auc": primary["roc_auc"],
                "log_loss": primary["log_loss"],
                "baseline_podium_hit_rate": baseline["podium_hit_rate"],
                "races_backtested": primary["races"],
            },
        )
