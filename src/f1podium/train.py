"""Season-by-season backtest, model selection and artifact export."""

import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from f1podium import __version__
from f1podium.config import (
    ARTIFACTS_DIR,
    BACKTEST_SEASONS,
    PRIMARY_MODEL,
    RANDOM_STATE,
    TRAIN_START_YEAR,
)
from f1podium.data import build_entries, load_raw
from f1podium.evaluation import (
    calibration_curve,
    evaluate,
    normalize_per_race,
    probability_metrics,
    ranking_metrics,
)
from f1podium.features import FEATURE_INFO, FEATURES, build_features
from f1podium.models import MODELS

PREDICTION_COLUMNS = [
    "raceId", "year", "round", "race_name", "date", "driverId", "driver_code", "driver_name",
    "team_name", "grid", "quali_position", "finish_position", "podium",
]  # fmt: skip


def training_frame(features: pd.DataFrame) -> pd.DataFrame:
    """Completed races from TRAIN_START_YEAR onwards."""
    return features[
        (features["year"] >= TRAIN_START_YEAR) & features["finish_position"].notna()
    ].reset_index(drop=True)


def fit(model_name: str, train: pd.DataFrame):
    return MODELS[model_name][1]().fit(train)


def raw_podium_probs(model, frame: pd.DataFrame) -> np.ndarray:
    """Classifier output before race normalisation (the simulator is already coherent)."""
    return getattr(model, "predict_podium_raw", model.predict_podium)(frame)


def backtest(data: pd.DataFrame, seasons=BACKTEST_SEASONS, log=print):
    """Predict each season with models trained only on earlier seasons.

    Returns the test rows with one raw-probability column per model, and the
    primary model of each fold keyed by season.
    """
    folds, fold_models = [], {}
    for season in seasons:
        train, test = data[data["year"] < season], data[data["year"] == season].copy()
        if test.empty:
            continue
        for name in MODELS:
            model = fit(name, train)
            test[f"raw_{name}"] = raw_podium_probs(model, test)
            if name == PRIMARY_MODEL:
                fold_models[int(season)] = model
        folds.append(test)
        log(f"  backtest {season}: {test['raceId'].nunique()} races")
    return pd.concat(folds, ignore_index=True), fold_models


def summarize(bt: pd.DataFrame) -> dict:
    """Metrics per model (raw and race-normalised) overall and per season, plus baseline.

    Also adds a ``prob_<model>`` column to ``bt`` holding the better-scoring variant.
    """
    y, races = bt["podium"].to_numpy(), bt["raceId"].to_numpy()
    summary = {"models": {}, "baseline": {}}

    for name, (label, _) in MODELS.items():
        raw = bt[f"raw_{name}"].to_numpy()
        variants = {"raw": raw, "normalized": normalize_per_race(raw, races)}
        scores = {v: evaluate(races, y, p) for v, p in variants.items()}
        best = min(scores, key=lambda v: scores[v]["log_loss"])
        bt[f"prob_{name}"] = variants[best]

        per_season = {
            int(season): evaluate(g["raceId"], g["podium"], g[f"prob_{name}"])
            for season, g in bt.groupby("year")
        }
        summary["models"][name] = {
            "label": label,
            "normalize": best == "normalized",
            "overall": scores[best],
            "raw_vs_normalized_log_loss": {v: s["log_loss"] for v, s in scores.items()},
            "per_season": per_season,
            "calibration": calibration_curve(y, variants[best]),
        }

    # Naive baseline: the podium is the first three on the grid.
    summary["baseline"] = {
        "label": "Top 3 on the grid",
        "overall": ranking_metrics(races, y, -bt["grid"].to_numpy()),
        "per_season": {
            int(season): ranking_metrics(g["raceId"], g["podium"], -g["grid"].to_numpy())
            for season, g in bt.groupby("year")
        },
    }
    return summary


def feature_importance(model_name: str, data: pd.DataFrame) -> list[dict]:
    """Permutation importance on the last backtest season, model trained on prior seasons.

    Importance is the increase in log loss when one feature is shuffled.
    """
    season = max(BACKTEST_SEASONS)
    train, test = data[data["year"] < season], data[data["year"] == season]
    model = fit(model_name, train)
    y = test["podium"].to_numpy()
    base = probability_metrics(y, model.predict_podium(test))["log_loss"]
    rng = np.random.default_rng(RANDOM_STATE)
    rows = []
    for feature in FEATURES:
        losses = []
        for _ in range(3):
            shuffled = test.copy()
            shuffled[feature] = rng.permutation(shuffled[feature].to_numpy())
            losses.append(probability_metrics(y, model.predict_podium(shuffled))["log_loss"])
        increase = np.array(losses) - base
        rows.append(
            {
                "feature": feature,
                "label": FEATURE_INFO[feature][0],
                "importance": float(increase.mean()),
                "std": float(increase.std()),
            }
        )
    return sorted(rows, key=lambda r: r["importance"], reverse=True)


def run(artifacts_dir: Path = ARTIFACTS_DIR, log=print) -> dict:
    log("Loading data and building features...")
    raw = load_raw()
    features = build_features(build_entries(raw), raw)
    data = training_frame(features)
    log(f"  {len(data)} training rows, {data['year'].min()}-{data['year'].max()}")

    log("Running season backtest...")
    bt, fold_models = backtest(data, log=log)
    summary = summarize(bt)
    best = min(summary["models"], key=lambda m: summary["models"][m]["overall"]["log_loss"])
    log(f"Primary model: {PRIMARY_MODEL} (lowest backtest log loss: {best})")

    log("Computing feature importance...")
    importance = feature_importance(PRIMARY_MODEL, data)

    log("Fitting final models on all seasons...")
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    (artifacts_dir / "models").mkdir(exist_ok=True)
    trained_through = str(data["date"].max().date())
    for name in MODELS:
        model = fit(name, data)
        if hasattr(model, "normalize"):
            model.normalize = summary["models"][name]["normalize"]
        joblib.dump(
            {
                "name": name,
                "label": MODELS[name][0],
                "model": model,
                "features": FEATURES,
                "trained_through": trained_through,
                "version": __version__,
            },
            artifacts_dir / "models" / f"{name}.joblib",
        )
        if name == "race_simulator":
            coefficients = sorted(
                (
                    {"feature": f, "label": FEATURE_INFO[f][0], "weight": float(w)}
                    for f, w in zip(FEATURES, model.coef_, strict=True)
                ),
                key=lambda c: abs(c["weight"]),
                reverse=True,
            )

    # Historical races are served by the fold model that never saw that season.
    joblib.dump(fold_models, artifacts_dir / "models" / f"{PRIMARY_MODEL}_folds.joblib")

    prob_cols = [f"prob_{name}" for name in MODELS]
    bt[PREDICTION_COLUMNS + prob_cols].to_csv(
        artifacts_dir / "backtest_predictions.csv", index=False, float_format="%.5f"
    )

    metrics = {
        "version": __version__,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "selected_model": PRIMARY_MODEL,
        "best_log_loss_model": best,
        "train_start_year": TRAIN_START_YEAR,
        "trained_through": trained_through,
        "backtest_seasons": sorted(int(s) for s in bt["year"].unique()),
        "features": [
            {"name": f, "label": label, "description": desc}
            for f, (label, desc) in FEATURE_INFO.items()
        ],
        "feature_importance": importance,
        "simulator_coefficients": coefficients,
        **summary,
    }
    (artifacts_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    log(f"Artifacts written to {artifacts_dir}")
    return metrics
