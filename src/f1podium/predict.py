"""Race predictions from trained artifacts, including what-if grid scenarios."""

from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from f1podium.config import ARTIFACTS_DIR, PRIMARY_MODEL
from f1podium.data import build_entries, load_raw
from f1podium.features import (
    FEATURE_INFO,
    add_grid_features,
    add_race_relative_features,
    build_features,
)
from f1podium.models import RaceSimulator

DISPLAY_COLUMNS = [
    "raceId", "year", "round", "race_name", "date", "driverId", "driver_code", "driver_name",
    "constructorId", "team_name", "grid", "quali_position", "finish_position",
]  # fmt: skip


class RaceNotFound(LookupError):
    pass


@dataclass
class Predictor:
    bundle: dict
    features: pd.DataFrame
    # season -> model trained only on earlier seasons (from the backtest)
    fold_models: dict = field(default_factory=dict)

    @classmethod
    def load(
        cls, artifacts_dir: Path = ARTIFACTS_DIR, model: str | None = None, features=None
    ) -> "Predictor":
        name = model or PRIMARY_MODEL
        bundle = joblib.load(artifacts_dir / "models" / f"{name}.joblib")
        folds_path = artifacts_dir / "models" / f"{name}_folds.joblib"
        fold_models = joblib.load(folds_path) if folds_path.exists() else {}
        if features is None:
            raw = load_raw()
            features = build_features(build_entries(raw), raw)
        return cls(bundle=bundle, features=features, fold_models=fold_models)

    def model_for(self, season: int):
        """The model that had not seen ``season``, so past races are true out-of-sample.

        Seasons after the training data (upcoming races) use the final model.
        """
        if season in self.fold_models:
            return self.fold_models[season], True
        trained_through = int(self.bundle["trained_through"][:4])
        return self.bundle["model"], season > trained_through

    def race_frame(self, season: int, round_: int) -> pd.DataFrame:
        race = self.features[(self.features["year"] == season) & (self.features["round"] == round_)]
        if race.empty:
            raise RaceNotFound(f"No entry list for {season} round {round_}")
        return race.copy()

    def predict_race(
        self, season: int, round_: int, grid_overrides: dict[int, int] | None = None
    ) -> pd.DataFrame:
        """Leaderboard for one race, sorted by podium probability.

        ``grid_overrides`` maps driverId -> new grid slot. Drivers displaced by a move
        shift by one place, like on a real grid, and qualifying positions follow the
        grid so the scenario stays internally consistent.
        """
        race = self.race_frame(season, round_)
        if grid_overrides:
            race = apply_grid_overrides(race, grid_overrides)
        return self.predict_frame(race)

    def predict_frame(self, race: pd.DataFrame) -> pd.DataFrame:
        """Predict a single race. ``board.attrs['out_of_sample']`` says whether the
        model was trained without that season."""
        board = race[DISPLAY_COLUMNS].copy()
        model, out_of_sample = self.model_for(int(race["year"].iloc[0]))
        board.attrs["out_of_sample"] = out_of_sample
        if isinstance(model, RaceSimulator):
            positions, win, podium = model.simulate(race)
            board["probability"] = podium
            board["win_probability"] = win
            board["expected_position"] = positions @ np.arange(1, positions.shape[1] + 1)
            board["position_probabilities"] = [row.round(4).tolist() for row in positions]
            board["explanation"] = explain(model.contributions(race))
        else:
            board["probability"] = model.predict_podium(race)
        board = board.sort_values("probability", ascending=False).reset_index(drop=True)
        board.attrs["out_of_sample"] = out_of_sample
        return board


def apply_grid_overrides(race: pd.DataFrame, grid_overrides: dict[int, int]) -> pd.DataFrame:
    order = race.sort_values("grid")["driverId"].tolist()
    for driver_id, slot in grid_overrides.items():
        if driver_id not in order:
            raise KeyError(f"Driver {driver_id} is not in this race")
        order.remove(driver_id)
        order.insert(max(0, min(int(slot) - 1, len(order))), driver_id)
    new_grid = {driver_id: i + 1.0 for i, driver_id in enumerate(order)}
    race = race.copy()
    race["grid"] = race["driverId"].map(new_grid)
    race["quali_position"] = race["grid"]
    add_grid_features(race)
    add_race_relative_features(race)
    return race


def explain(contributions: pd.DataFrame, top: int = 4) -> list[list[dict]]:
    """Largest feature contributions per driver, as a list of {feature, label, impact}."""
    out = []
    for _, row in contributions.iterrows():
        strongest = row.reindex(row.abs().sort_values(ascending=False).index)[:top]
        out.append(
            [
                {"feature": f, "label": FEATURE_INFO[f][0], "impact": round(float(v), 4)}
                for f, v in strongest.items()
            ]
        )
    return out
