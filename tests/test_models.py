import numpy as np
import pandas as pd
import pytest

from f1podium.evaluation import normalize_per_race, ranking_metrics
from f1podium.features import FEATURES
from f1podium.models import RaceSimulator, logistic_regression
from f1podium.predict import apply_grid_overrides
from f1podium.train import backtest, summarize, training_frame


def synthetic_races(n_races=150, field=12, seed=0) -> pd.DataFrame:
    """Races where the 'grid' feature fully drives skill plus noise."""
    rng = np.random.default_rng(seed)
    rows = []
    for race in range(n_races):
        grid = rng.permutation(field) + 1
        skill = -grid + rng.normal(0, 2, field)
        finish = np.argsort(np.argsort(-skill)) + 1
        for g, f in zip(grid, finish, strict=True):
            row = dict.fromkeys(FEATURES, 0.0)
            row.update(raceId=race, grid=float(g), finish_position=f, podium=float(f <= 3))
            rows.append(row)
    df = pd.DataFrame(rows)
    df["quali_position"] = df["grid"]
    return df


def test_normalize_per_race_sums_to_podium_size():
    probs = np.array([0.9, 0.9, 0.9, 0.9, 0.1, 0.2, 0.3])
    races = np.array([1, 1, 1, 1, 2, 2, 2])
    out = normalize_per_race(probs, races)
    assert out[:4].sum() == pytest.approx(3)
    assert out[4:].sum() == pytest.approx(2.985)  # three drivers, each capped at 0.995
    assert out.max() <= 0.995 + 1e-9


def test_ranking_metrics():
    races = [1, 1, 1, 1, 2, 2, 2, 2]
    y = [1, 1, 1, 0, 1, 1, 1, 0]
    scores = [4, 3, 2, 1, 1, 3, 2, 4]  # race 1 perfect, race 2 top pick wrong
    m = ranking_metrics(races, y, scores)
    assert m["podium_hit_rate"] == pytest.approx((1 + 2 / 3) / 2)
    assert m["full_podium_rate"] == 0.5
    assert m["top_pick_podium_rate"] == 0.5


def test_race_simulator_learns_order_and_is_coherent():
    df = synthetic_races()
    model = RaceSimulator(n_sims=2000).fit(df)
    grid_weight = model.coef_[FEATURES.index("grid")]
    assert grid_weight < 0  # starting further back lowers strength

    race = df[df["raceId"] == 0]
    positions, win, podium = model.simulate(race)
    assert win.sum() == pytest.approx(1)
    assert podium.sum() == pytest.approx(3)
    assert np.allclose(positions.sum(1), 1)
    assert win[race["grid"].to_numpy().argmin()] == win.max()


def test_classifier_interface():
    df = synthetic_races()
    model = logistic_regression().fit(df)
    model.normalize = True
    probs = model.predict_podium(df[df["raceId"] < 5])
    assert probs.reshape(5, -1).sum(1) == pytest.approx(np.full(5, 3.0))


def test_grid_override_shifts_the_field(features):
    race = features[(features["year"] == 2024) & (features["round"] == 1)]
    last = race.sort_values("grid").iloc[-1]
    moved = apply_grid_overrides(race, {int(last["driverId"]): 1})
    assert moved.loc[moved["driverId"] == last["driverId"], "grid"].item() == 1
    assert sorted(moved["grid"]) == list(range(1, len(race) + 1))
    old_pole = race.sort_values("grid").iloc[0]["driverId"]
    assert moved.loc[moved["driverId"] == old_pole, "grid"].item() == 2


def test_backtest_trains_only_on_the_past(features):
    data = training_frame(features)
    data = data[data["year"] >= 2018]
    bt, fold_models = backtest(data, seasons=[2023], log=lambda *_: None)
    assert set(bt["year"]) == {2023}
    assert set(fold_models) == {2023}
    summary = summarize(bt)
    for metrics in summary["models"].values():
        assert 0.5 < metrics["overall"]["roc_auc"] <= 1
