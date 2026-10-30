import pytest
from fastapi.testclient import TestClient

from f1podium.api.app import create_app
from f1podium.api.service import F1Service
from f1podium.train import run


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    artifacts = tmp_path_factory.mktemp("artifacts")
    run(artifacts_dir=artifacts, backtest_seasons=[2023, 2024], log=lambda *_: None)
    with TestClient(create_app(F1Service(artifacts))) as c:
        yield c


def test_meta(client):
    meta = client.get("/api/meta").json()
    assert meta["model"] == "race_simulator"
    assert 0.5 < meta["headline"]["roc_auc"] <= 1
    assert meta["latest_race"]["status"] == "completed"
    assert {s["year"] for s in meta["seasons"]} >= {2014, 2024}


def test_season_races(client):
    races = client.get("/api/seasons/2024/races").json()
    assert len(races) == 24
    assert all(r["status"] == "completed" for r in races)
    assert races[0]["winner"]["code"] == "VER"
    assert 0 <= races[0]["podium_hits"] <= 3


def test_race_prediction_is_out_of_sample_and_coherent(client):
    body = client.get("/api/races/2024/18").json()
    assert body["out_of_sample"] is True
    board = body["leaderboard"]
    assert sum(d["probability"] for d in board) == pytest.approx(3, abs=1e-6)
    assert sum(d["win_probability"] for d in board) == pytest.approx(1, abs=1e-6)
    assert board == sorted(board, key=lambda d: -d["probability"])
    assert len(board[0]["position_probabilities"]) == len(board)
    assert board[0]["explanation"]
    assert body["evaluation"]["actual_podium"] == ["NOR", "VER", "PIA"]


def test_scenario_moves_driver_to_pole(client):
    board = client.get("/api/races/2024/18").json()["leaderboard"]
    backmarker = max(board, key=lambda d: d["grid"])
    body = client.post(
        "/api/races/2024/18/scenario", json={"grid": {str(backmarker["driver_id"]): 1}}
    ).json()
    moved = next(d for d in body["leaderboard"] if d["driver_id"] == backmarker["driver_id"])
    assert moved["grid"] == 1
    assert moved["probability"] > backmarker["probability"]
    # The cached baseline prediction is untouched by the scenario.
    again = client.get("/api/races/2024/18").json()["leaderboard"]
    assert next(d for d in again if d["driver_id"] == backmarker["driver_id"])["grid"] > 1


def test_errors(client):
    assert client.get("/api/races/1990/1").status_code == 404
    assert client.get("/api/seasons/1990/races").status_code == 404
    scenario = client.post("/api/races/2024/18/scenario", json={"grid": {"999999": 1}})
    assert scenario.status_code == 422


def test_model_metrics(client):
    metrics = client.get("/api/model").json()
    assert set(metrics["models"]) >= {"race_simulator", "logistic_regression"}
    assert metrics["feature_importance"]
