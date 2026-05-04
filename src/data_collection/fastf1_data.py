import fastf1
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
CACHE_PATH = BASE_DIR / "cache"

CACHE_PATH.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_PATH))


def load_session(year, race_name, session_type):
    session = fastf1.get_session(year, race_name, session_type)
    session.load()
    return session


def get_race_results(year=2023, race_name="Monaco Grand Prix"):
    session = load_session(year, race_name, "R")

    results = session.results

    df = results[[
        "Abbreviation",
        "FullName",
        "TeamName",
        "GridPosition",
        "Position",
        "Points",
        "Status"
    ]].copy()

    df.columns = [
        "driver",
        "full_name",
        "team",
        "grid",
        "finish_position",
        "points",
        "status"
    ]

    return df


def get_qualifying_results(year=2023, race_name="Monaco Grand Prix"):
    session = load_session(year, race_name, "Q")

    results = session.results

    columns = [
        "Abbreviation",
        "FullName",
        "TeamName",
        "Position"
    ]

    optional_columns = ["Q1", "Q2", "Q3"]

    existing_optional = [
        col for col in optional_columns
        if col in results.columns
    ]

    df = results[columns + existing_optional].copy()

    rename_map = {
        "Abbreviation": "driver",
        "FullName": "full_name",
        "TeamName": "team",
        "Position": "qualifying_position",
        "Q1": "q1",
        "Q2": "q2",
        "Q3": "q3"
    }

    df = df.rename(columns=rename_map)

    return df


def get_lap_times(year=2023, race_name="Monaco Grand Prix", session_type="R"):
    session = load_session(year, race_name, session_type)

    laps = session.laps.copy()

    df = laps[[
        "Driver",
        "Team",
        "LapNumber",
        "LapTime",
        "Sector1Time",
        "Sector2Time",
        "Sector3Time",
        "Compound",
        "TyreLife",
        "PitOutTime",
        "PitInTime"
    ]].copy()

    df["LapTimeSeconds"] = df["LapTime"].dt.total_seconds()
    df["Sector1Seconds"] = df["Sector1Time"].dt.total_seconds()
    df["Sector2Seconds"] = df["Sector2Time"].dt.total_seconds()
    df["Sector3Seconds"] = df["Sector3Time"].dt.total_seconds()

    return df


def get_tyre_strategy(year=2023, race_name="Monaco Grand Prix"):
    laps_df = get_lap_times(year, race_name, "R")

    tyre_df = (
        laps_df
        .dropna(subset=["Compound"])
        .groupby(["Driver", "Compound"])
        .agg(
            first_lap=("LapNumber", "min"),
            last_lap=("LapNumber", "max"),
            laps=("LapNumber", "count"),
            avg_lap_time=("LapTimeSeconds", "mean")
        )
        .reset_index()
    )

    return tyre_df


def get_weather_data(year=2023, race_name="Monaco Grand Prix", session_type="R"):
    session = load_session(year, race_name, session_type)

    weather = session.weather_data.copy()

    if weather.empty:
        return pd.DataFrame()

    return weather


def get_driver_telemetry(year=2023, race_name="Monaco Grand Prix", driver="VER", session_type="R"):
    session = load_session(year, race_name, session_type)

    driver_laps = session.laps.pick_driver(driver)

    if driver_laps.empty:
        return pd.DataFrame()

    fastest_lap = driver_laps.pick_fastest()
    telemetry = fastest_lap.get_telemetry()

    telemetry_df = telemetry[[
        "Speed",
        "Throttle",
        "Brake",
        "nGear",
        "RPM",
        "DRS",
        "Distance"
    ]].copy()

    return telemetry_df


def get_available_drivers(year=2023, race_name="Monaco Grand Prix", session_type="R"):
    session = load_session(year, race_name, session_type)
    drivers = session.results["Abbreviation"].dropna().tolist()
    return drivers