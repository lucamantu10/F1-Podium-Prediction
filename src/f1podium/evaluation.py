"""Race-aware probability post-processing and evaluation metrics."""

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score

from f1podium.config import PODIUM_SIZE


def normalize_per_race(
    probs: np.ndarray, race_ids: np.ndarray, total: float = PODIUM_SIZE, cap: float = 0.995
) -> np.ndarray:
    """Rescale probabilities so each race sums to ``total`` podium places.

    A model scores each driver independently, but exactly three drivers stand on the
    podium. Scaling is repeated with capping so no driver exceeds ``cap``.
    """
    out = np.asarray(probs, dtype=float).copy()
    races = pd.Series(race_ids)
    for _, idx in races.groupby(races).groups.items():
        p = out[idx]
        target = min(total, cap * len(p))
        for _ in range(20):
            free = p < cap
            room = target - p[~free].sum()
            if free.sum() == 0 or p[free].sum() == 0:
                break
            p[free] *= room / p[free].sum()
            if (p <= cap).all():
                break
            p = np.minimum(p, cap)
        out[idx] = p
    return out


def ranking_metrics(race_ids, y_true, scores) -> dict[str, float]:
    """How well the top-3 by score matches the real podium, race by race."""
    df = pd.DataFrame({"race": race_ids, "y": y_true, "s": scores})
    hits, top_pick, full = [], [], []
    for _, race in df.groupby("race"):
        top3 = race.nlargest(PODIUM_SIZE, "s")
        n_hits = top3["y"].sum()
        hits.append(n_hits / PODIUM_SIZE)
        full.append(float(n_hits == PODIUM_SIZE))
        top_pick.append(float(top3["y"].iloc[0] == 1))
    return {
        "podium_hit_rate": float(np.mean(hits)),
        "full_podium_rate": float(np.mean(full)),
        "top_pick_podium_rate": float(np.mean(top_pick)),
        "races": len(hits),
    }


def probability_metrics(y_true, probs) -> dict[str, float]:
    probs = np.clip(probs, 1e-6, 1 - 1e-6)
    return {
        "log_loss": float(log_loss(y_true, probs, labels=[0, 1])),
        "brier": float(brier_score_loss(y_true, probs)),
        "roc_auc": float(roc_auc_score(y_true, probs)),
        "avg_precision": float(average_precision_score(y_true, probs)),
    }


def evaluate(race_ids, y_true, probs) -> dict[str, float]:
    return probability_metrics(y_true, probs) | ranking_metrics(race_ids, y_true, probs)


def calibration_curve(y_true, probs, bins: int = 10) -> list[dict[str, float]]:
    """Mean predicted vs. observed podium rate per probability bucket."""
    df = pd.DataFrame({"y": y_true, "p": probs})
    df["bin"] = np.minimum((df["p"] * bins).astype(int), bins - 1)
    grouped = df.groupby("bin").agg(
        predicted=("p", "mean"), observed=("y", "mean"), n=("y", "size")
    )
    return [
        {"predicted": float(r.predicted), "observed": float(r.observed), "count": int(r.n)}
        for r in grouped.itertuples()
    ]
