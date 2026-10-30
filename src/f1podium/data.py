"""Loading the Ergast-format CSV dump into a single race-entry table."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from f1podium.config import LIVE_DATA_DIR, RAW_DATA_DIR

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


def read_tables(directory: Path) -> RawData:
    tables = {name: pd.read_csv(directory / f"{name}.csv", na_values=["\\N"]) for name in TABLES}
    return RawData(**tables)


def load_raw(raw_dir: Path = RAW_DATA_DIR, live_dir: Path | None = LIVE_DATA_DIR) -> RawData:
    """The historical dump plus any newer seasons fetched from Jolpica."""
    base = read_tables(raw_dir)
    if live_dir is None or not (live_dir / "races.csv").exists():
        return base
    live = read_tables(live_dir)
    # The live calendar replaces any placeholder races of the same seasons in the dump.
    base.races = base.races[~base.races["year"].isin(live.races["year"])]
    merged = {
        name: pd.concat([getattr(base, name), getattr(live, name)], ignore_index=True)
        for name in TABLES
    }
    return RawData(**merged)


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


def build_entries(raw: RawData, include_next: bool = True) -> pd.DataFrame:
    """One row per driver per race with everything known before and after the race.

    Pre-race columns: grid, quali_position, quali_best_s.
    Outcome columns: finish_position, points, finished, podium (NaN if not raced yet).
    ``entry_status`` is "result" for completed races; with ``include_next`` the next
    race on the calendar is appended (see next_race_entries).
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
    finished_status = status.str.fullmatch(r"Finished|Lapped|\+\d+ Laps?")

    df = results.merge(
        quali[["raceId", "driverId", "quali_position", "quali_best_s"]],
        on=["raceId", "driverId"],
        how="left",
    )
    df["finished"] = df["statusId"].map(finished_status).fillna(False).astype(float)
    df = df.drop(columns="statusId")
    df["podium"] = (df["finish_position"] <= 3).astype(float)
    df["entry_status"] = "result"

    if include_next:
        upcoming = next_race_entries(raw, df, quali)
        if upcoming is not None:
            df = pd.concat([df, upcoming], ignore_index=True)

    return attach_context(df, raw)


def next_race_entries(raw: RawData, results: pd.DataFrame, quali: pd.DataFrame):
    """Entry list for the first calendar race after the last one with results.

    Once qualifying has run the entry list and grid come from it ("qualifying").
    Before that, the line-up of the last race is used and the grid is projected
    from each driver's average qualifying position over the last three races
    ("projected"). Returns None when the calendar has no further race.
    """
    calendar = race_calendar(raw)
    raced = calendar["raceId"].isin(results["raceId"])
    if raced.all() or not raced.any():
        return None
    last_seq = calendar.loc[raced, "race_seq"].max()
    upcoming = calendar[calendar["race_seq"] > last_seq]
    if upcoming.empty:
        return None
    race_id = upcoming.iloc[0]["raceId"]

    race_quali = quali[quali["raceId"] == race_id]
    if not race_quali.empty:
        teams = raw.qualifying.loc[
            raw.qualifying["raceId"] == race_id, ["driverId", "constructorId"]
        ]
        entries = race_quali.merge(teams.drop_duplicates("driverId"), on="driverId")
        entries["grid"] = entries["quali_position"]
        status = "qualifying"
    else:
        last_race = calendar.loc[calendar["race_seq"] == last_seq, "raceId"].item()
        entries = results.loc[results["raceId"] == last_race, ["driverId", "constructorId"]].copy()
        recent = calendar.loc[raced, "raceId"].iloc[-3:]
        avg_quali = quali[quali["raceId"].isin(recent)].groupby("driverId")["quali_position"].mean()
        entries["quali_position"] = (
            entries["driverId"].map(avg_quali).rank(method="first", na_option="bottom")
        )
        entries["grid"] = entries["quali_position"]
        entries["quali_best_s"] = np.nan
        status = "projected"

    entries = entries.assign(
        raceId=race_id,
        finish_position=np.nan,
        points=np.nan,
        finished=np.nan,
        podium=np.nan,
        entry_status=status,
    )
    return entries[results.columns]


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
