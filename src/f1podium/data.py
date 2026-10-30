"""Loading the Ergast-format CSV dump into a single race-entry table."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from f1podium.config import RAW_DATA_DIR

TABLES = (
    "races",
    "results",
    "qualifying",
    "drivers",
    "constructors",
    "circuits",
    "status",
    "driver_standings",
    "constructor_standings",
)


@dataclass
class RawData:
    races: pd.DataFrame
    results: pd.DataFrame
    qualifying: pd.DataFrame
    drivers: pd.DataFrame
    constructors: pd.DataFrame
    circuits: pd.DataFrame
    status: pd.DataFrame
    driver_standings: pd.DataFrame
    constructor_standings: pd.DataFrame


def load_raw(raw_dir: Path = RAW_DATA_DIR) -> RawData:
    tables = {name: pd.read_csv(raw_dir / f"{name}.csv", na_values=["\\N"]) for name in TABLES}
    return RawData(**tables)


def lap_time_to_seconds(value) -> float:
    """Parse an Ergast lap time such as '1:26.572' or '58.123' into seconds."""
    if not isinstance(value, str) or not value.strip():
        return np.nan
    try:
        minutes, _, seconds = value.strip().rpartition(":")
        return (int(minutes) * 60 if minutes else 0) + float(seconds)
    except ValueError:
        return np.nan


def race_calendar(raw: RawData) -> pd.DataFrame:
    """Races in true chronological order. raceId is *not* chronological in Ergast."""
    races = raw.races[["raceId", "year", "round", "circuitId", "name", "date"]].copy()
    races["date"] = pd.to_datetime(races["date"])
    races = races.sort_values(["date", "raceId"]).reset_index(drop=True)
    races["race_seq"] = np.arange(len(races))
    return races.rename(columns={"name": "race_name"})


def build_entries(raw: RawData) -> pd.DataFrame:
    """One row per driver per race with everything known before and after the race.

    Pre-race columns: grid, quali_position, quali_best_s.
    Outcome columns: finish_position, points, finished, podium.
    """
    results = raw.results[
        ["raceId", "driverId", "constructorId", "grid", "positionOrder", "points", "statusId"]
    ].rename(columns={"positionOrder": "finish_position"})

    quali = raw.qualifying[["raceId", "driverId", "position", "q1", "q2", "q3"]].copy()
    quali["quali_best_s"] = (
        quali[["q1", "q2", "q3"]].apply(lambda col: col.map(lap_time_to_seconds)).min(axis=1)
    )
    quali = quali.rename(columns={"position": "quali_position"})
    quali = quali.drop_duplicates(["raceId", "driverId"])

    status = raw.status.set_index("statusId")["status"]
    finished_status = status.str.fullmatch(r"Finished|\+\d+ Laps?")

    df = results.merge(
        quali[["raceId", "driverId", "quali_position", "quali_best_s"]],
        on=["raceId", "driverId"],
        how="left",
    )
    df["finished"] = df["statusId"].map(finished_status).fillna(False).astype(float)
    df = df.drop(columns="statusId")
    df["podium"] = (df["finish_position"] <= 3).astype(float)

    return attach_context(df, raw)


def attach_context(entries: pd.DataFrame, raw: RawData) -> pd.DataFrame:
    """Add calendar order and display names to a frame keyed by raceId/driverId/constructorId."""
    drivers = raw.drivers[["driverId", "code", "forename", "surname"]].copy()
    drivers["driver_name"] = drivers["forename"] + " " + drivers["surname"]
    drivers = drivers.rename(columns={"code": "driver_code"})[
        ["driverId", "driver_code", "driver_name"]
    ]
    constructors = raw.constructors[["constructorId", "name"]].rename(columns={"name": "team_name"})

    df = entries.merge(race_calendar(raw), on="raceId", how="inner")
    df = df.merge(drivers, on="driverId", how="left").merge(
        constructors, on="constructorId", how="left"
    )
    return df.sort_values(["race_seq", "grid"]).reset_index(drop=True)
