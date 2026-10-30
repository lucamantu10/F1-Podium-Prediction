"""Project paths and modelling constants."""

import os
from pathlib import Path

ROOT_DIR = Path(os.environ.get("F1PODIUM_ROOT", Path(__file__).resolve().parents[2]))
RAW_DATA_DIR = ROOT_DIR / "data" / "raw"
ARTIFACTS_DIR = ROOT_DIR / "artifacts"

# Qualifying data in the Ergast dump starts in 1994. Earlier seasons are still used to
# warm up the rolling form features, but not as training rows.
TRAIN_START_YEAR = 2000

# Expanding-window backtest: each season is predicted by a model trained only on the
# seasons before it.
BACKTEST_SEASONS = list(range(2014, 2025))

# The race simulator is used for predictions: in the backtest it matches the best
# classifier on log loss and is the only model that yields win and finishing-position
# probabilities that are consistent across the whole field.
PRIMARY_MODEL = "race_simulator"

PODIUM_SIZE = 3
RANDOM_STATE = 42
