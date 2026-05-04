import fastf1
from pathlib import Path

# cache (IMPORTANT pentru viteza)
cache_path = Path("cache")
cache_path.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(cache_path)


def get_latest_race_results(year=2023, race_name="Monaco Grand Prix"):
    session = fastf1.get_session(year, race_name, "R")
    session.load()

    results = session.results

    df = results[[
        "Abbreviation",
        "TeamName",
        "GridPosition",
        "Position",
        "Points"
    ]].copy()

    df.columns = [
        "driver",
        "team",
        "grid",
        "finish_position",
        "points"
    ]

    return df