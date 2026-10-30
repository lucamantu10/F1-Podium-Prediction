import json

import joblib
import numpy as np
import pytest

from f1podium.export import export
from f1podium.features import FEATURES
from f1podium.train import run


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    artifacts = tmp_path_factory.mktemp("artifacts")
    out = tmp_path_factory.mktemp("bundle")
    run(artifacts_dir=artifacts, backtest_seasons=[2024, 2025], log=lambda *_: None)
    export(out, artifacts_dir=artifacts, log=lambda *_: None)
    return out, artifacts


@pytest.fixture(scope="module")
def bundle(exported):
    return exported[0]


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_index_points_at_existing_races(bundle):
    index = read(bundle / "index.json")
    for key in ("latestRace", "nextRace"):
        race = index[key]
        assert (bundle / "races" / f"{race['year']}-{race['round']}.json").exists()
    assert index["latestRace"]["status"] == "completed"


def test_race_files_carry_features_in_model_order(bundle):
    model = read(bundle / "model.json")
    assert [f["name"] for f in model["features"]] == FEATURES
    race = read(bundle / "races" / "2025-24.json")
    assert race["model"] == "2025"  # the fold that never saw 2025
    assert race["outOfSample"] is True
    assert all(len(e["features"]) == len(FEATURES) for e in race["entries"])
    assert [e["grid"] for e in race["entries"]] == sorted(e["grid"] for e in race["entries"])


def test_simulator_params_reproduce_python_strengths(exported, features):
    """Strengths computed from the exported numbers match the Python fold model."""
    bundle, artifacts = exported
    model = read(bundle / "model.json")
    race = read(bundle / "races" / "2025-24.json")
    params = model["folds"]["2025"]
    x = np.array([[np.nan if v is None else v for v in e["features"]] for e in race["entries"]])
    x = np.where(np.isnan(x), params["median"], x)
    exported_strengths = ((x - params["mean"]) / np.array(params["scale"])) @ np.array(
        params["coef"]
    )

    fold = joblib.load(artifacts / "models" / "race_simulator_folds.joblib")[2025]
    frame = features[features["raceId"] == race["raceId"]].set_index("driverId")
    frame = frame.loc[[e["driverId"] for e in race["entries"]]].reset_index()
    np.testing.assert_allclose(exported_strengths, fold.strengths(frame), atol=1e-3)


def test_driver_pages(bundle):
    drivers = read(bundle / "drivers" / "index.json")
    assert drivers[0]["active"] is True
    ver = read(bundle / "drivers" / "830.json")
    assert ver["code"] == "VER"
    assert ver["career"]["wins"] >= 60
    assert ver["seasons"][-1]["year"] >= 2025
    assert len(ver["recentRaces"]) == 24


def test_files_are_utf8(bundle):
    race = read(bundle / "races" / "2026-19.json")
    assert race["circuit"]["name"] == "Autódromo Hermanos Rodríguez"
