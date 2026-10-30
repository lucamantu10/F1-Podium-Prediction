"""Candidate models behind one interface: ``fit(frame)`` and ``predict_podium(frame)``.

``frame`` is a feature table (see features.py) with one row per driver per race.
"""

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import logsumexp
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from f1podium.config import PODIUM_SIZE, RANDOM_STATE
from f1podium.evaluation import normalize_per_race
from f1podium.features import FEATURES


class PodiumClassifier:
    """A per-driver binary classifier: does this driver finish in the top 3?"""

    def __init__(self, estimator, normalize: bool = False):
        self.estimator = estimator
        # Rescale each race to sum to three podium places (chosen by the backtest).
        self.normalize = normalize

    def fit(self, frame: pd.DataFrame) -> "PodiumClassifier":
        self.estimator.fit(frame[FEATURES], frame["podium"].astype(int))
        return self

    def predict_podium_raw(self, frame: pd.DataFrame) -> np.ndarray:
        return self.estimator.predict_proba(frame[FEATURES])[:, 1]

    def predict_podium(self, frame: pd.DataFrame) -> np.ndarray:
        probs = self.predict_podium_raw(frame)
        if self.normalize:
            probs = normalize_per_race(probs, frame["raceId"].to_numpy())
        return probs


class RaceSimulator:
    """Plackett-Luce ranking model with Monte Carlo race simulation.

    Each driver gets a strength ``u = w . x`` (standardised features). The finishing
    order is drawn by repeatedly picking the next finisher with probability
    ``softmax(u)`` over the drivers not yet placed; ``w`` is fitted by maximising the
    likelihood of the observed top three. Sampling ``u + Gumbel noise`` and sorting
    reproduces that process, so simulating many races gives win, podium and
    finishing-position probabilities that are consistent across the whole field.
    """

    def __init__(self, l2: float = 10.0, stages: int = PODIUM_SIZE, n_sims: int = 10_000):
        self.l2 = l2
        self.stages = stages
        self.n_sims = n_sims

    # --- data packing ------------------------------------------------------------
    def _standardize(self, frame: pd.DataFrame) -> np.ndarray:
        return self.scaler_.transform(self.imputer_.transform(frame[FEATURES]))

    @staticmethod
    def _pack(frame: pd.DataFrame, X: np.ndarray):
        """Pad rows into a [race, driver, feature] tensor. Returns tensor, mask, row index."""
        race_idx = pd.factorize(frame["raceId"])[0]
        slot = pd.Series(race_idx).groupby(race_idx).cumcount().to_numpy()
        n_races, n_slots = race_idx.max() + 1, slot.max() + 1
        tensor = np.zeros((n_races, n_slots, X.shape[1]))
        mask = np.zeros((n_races, n_slots), dtype=bool)
        tensor[race_idx, slot] = X
        mask[race_idx, slot] = True
        return tensor, mask, (race_idx, slot)

    # --- training ----------------------------------------------------------------
    def fit(self, frame: pd.DataFrame) -> "RaceSimulator":
        self.imputer_ = SimpleImputer(strategy="median").fit(frame[FEATURES])
        self.scaler_ = StandardScaler().fit(self.imputer_.transform(frame[FEATURES]))
        A, mask, (r, s) = self._pack(frame, self._standardize(frame))

        finish = np.full(mask.shape, np.inf)
        finish[r, s] = frame["finish_position"].to_numpy()
        order = np.argsort(finish, axis=1)[:, : self.stages]
        rows = np.arange(A.shape[0])

        def objective(w):
            u = np.where(mask, A @ w, -np.inf)
            remaining = mask.copy()
            loglik, grad = 0.0, np.zeros_like(w)
            for k in range(self.stages):
                chosen = order[:, k]
                masked = np.where(remaining, u, -np.inf)
                lse = logsumexp(masked, axis=1)
                loglik += np.sum(u[rows, chosen] - lse)
                p = np.exp(masked - lse[:, None])
                grad += A[rows, chosen].sum(0) - np.einsum("rn,rnf->f", p, A)
                remaining[rows, chosen] = False
            return -loglik + self.l2 * w @ w / 2, -grad + self.l2 * w

        self.coef_ = minimize(objective, np.zeros(A.shape[2]), jac=True, method="L-BFGS-B").x
        return self

    # --- inference ---------------------------------------------------------------
    def strengths(self, frame: pd.DataFrame) -> np.ndarray:
        return self._standardize(frame) @ self.coef_

    def contributions(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Per-feature contribution to each driver's strength, relative to the field average."""
        parts = self._standardize(frame) * self.coef_
        parts = pd.DataFrame(parts, columns=FEATURES, index=frame.index)
        return parts - parts.groupby(frame["raceId"].to_numpy()).transform("mean")

    def simulate(self, frame: pd.DataFrame, n_sims: int | None = None, seed: int = RANDOM_STATE):
        """Return (position_probs[rows, positions], win, podium) for every row of ``frame``."""
        n_sims = n_sims or self.n_sims
        A, mask, (r, s) = self._pack(frame, self._standardize(frame))
        u = np.where(mask, A @ self.coef_, -np.inf)
        n_races, n_slots = u.shape
        counts = np.zeros((n_races, n_slots, n_slots))
        rng = np.random.default_rng(seed)
        batch = 500
        for start in range(0, n_sims, batch):
            size = min(batch, n_sims - start)
            noisy = u[None] + rng.gumbel(size=(size, n_races, n_slots))
            rank = np.argsort(np.argsort(-noisy, axis=2), axis=2)
            counts += (rank[..., None] == np.arange(n_slots)).sum(0)
        positions = counts[r, s] / n_sims
        return positions, positions[:, 0], positions[:, :PODIUM_SIZE].sum(1)

    def predict_podium(self, frame: pd.DataFrame) -> np.ndarray:
        return self.simulate(frame, n_sims=4000)[2]


def logistic_regression() -> PodiumClassifier:
    return PodiumClassifier(
        make_pipeline(
            SimpleImputer(strategy="median", add_indicator=True),
            StandardScaler(),
            LogisticRegression(C=0.3, max_iter=2000),
        )
    )


def neural_network() -> PodiumClassifier:
    return PodiumClassifier(
        make_pipeline(
            SimpleImputer(strategy="median", add_indicator=True),
            StandardScaler(),
            MLPClassifier(
                hidden_layer_sizes=(64, 32),
                alpha=1e-3,
                early_stopping=True,
                n_iter_no_change=20,
                max_iter=500,
                random_state=RANDOM_STATE,
            ),
        )
    )


def gradient_boosting() -> PodiumClassifier:
    # Handles missing values natively (first race of a season, rookies, new circuits).
    return PodiumClassifier(
        HistGradientBoostingClassifier(
            learning_rate=0.05,
            max_iter=300,
            max_leaf_nodes=15,
            min_samples_leaf=40,
            l2_regularization=1.0,
            random_state=RANDOM_STATE,
        )
    )


MODELS = {
    "race_simulator": ("Race Simulator (Plackett-Luce)", RaceSimulator),
    "logistic_regression": ("Logistic Regression", logistic_regression),
    "gradient_boosting": ("Gradient Boosting", gradient_boosting),
    "neural_network": ("Neural Network (MLP)", neural_network),
}
