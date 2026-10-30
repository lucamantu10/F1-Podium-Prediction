import numpy as np
import pandas as pd
import pytest

from f1podium.data import lap_time_to_seconds
from f1podium.features import FEATURES, build_features


@pytest.mark.parametrize(
    ("value", "expected"),
    [("1:26.572", 86.572), ("58.123", 58.123), ("", np.nan), (np.nan, np.nan), ("DNF", np.nan)],
)
def test_lap_time_to_seconds(value, expected):
    assert lap_time_to_seconds(value) == pytest.approx(expected, nan_ok=True)


def test_races_are_in_calendar_order(entries):
    per_race = entries.drop_duplicates("raceId")
    assert per_race["date"].is_monotonic_increasing
    # raceId alone is not chronological in Ergast, which is why race_seq exists.
    assert not per_race["raceId"].is_monotonic_increasing


def test_features_do_not_see_the_race_outcome(raw, entries, features):
    """Scrambling a race's results must not change any feature of that race."""
    race_id = entries.loc[entries["year"] == 2023, "raceId"].iloc[0]
    tampered = entries.copy()
    in_race = tampered["raceId"] == race_id
    rng = np.random.default_rng(0)
    tampered.loc[in_race, "finish_position"] = rng.permutation(
        tampered.loc[in_race, "finish_position"].to_numpy()
    )
    tampered["podium"] = (tampered["finish_position"] <= 3).astype(float)
    tampered.loc[in_race, "finished"] = 0.0

    def race_features(frame):
        rows = frame[frame["raceId"] == race_id].sort_values("driverId")
        return rows[FEATURES].reset_index(drop=True)

    pd.testing.assert_frame_equal(
        race_features(features), race_features(build_features(tampered, raw))
    )


def test_upcoming_race_gets_features(raw, entries):
    """A race without results (an upcoming one) still gets a full feature row."""
    last = entries[entries["race_seq"] == entries["race_seq"].max()].copy()
    upcoming = last.assign(
        raceId=-1,
        race_seq=last["race_seq"] + 1,
        round=last["round"] + 1,
        finish_position=np.nan,
        points=np.nan,
        finished=np.nan,
        podium=np.nan,
    )
    out = build_features(pd.concat([entries, upcoming], ignore_index=True), raw)
    rows = out[out["raceId"] == -1]
    assert len(rows) == len(upcoming)
    assert rows["drv_avg_finish_5"].notna().all()
    assert rows["con_avg_finish_5"].notna().all()
    assert rows["drv_experience"].min() > 0


def test_pit_lane_start_is_back_of_grid(entries, features):
    race_id = entries.loc[(entries["grid"] == 0) & (entries["year"] > 2015), "raceId"].iloc[0]
    race = features[features["raceId"] == race_id]
    assert race["grid"].min() >= 1
    assert race["grid"].max() == len(race)


def test_race_relative_ranks(features):
    race = features[(features["year"] == 2024) & (features["round"] == 1)]
    best_team = race.loc[race["con_avg_finish_5"].idxmin()]
    assert best_team["con_form_rank"] <= 1.5
    assert best_team["con_form_gap"] == 0
