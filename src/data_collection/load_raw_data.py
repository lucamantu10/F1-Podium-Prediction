from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "raw"

def load_data():
    drivers = pd.read_csv(DATA_PATH / "drivers.csv")
    constructors = pd.read_csv(DATA_PATH / "constructors.csv")
    races = pd.read_csv(DATA_PATH / "races.csv")
    results = pd.read_csv(DATA_PATH / "results.csv")
    qualifying = pd.read_csv(DATA_PATH / "qualifying.csv")

    results_drivers = results.merge(drivers, on="driverId")
    results_full = results_drivers.merge(constructors, on="constructorId")
    results_full = results_full.merge(races, on="raceId")

    results_full = results_full.merge(
        qualifying,
        on=["raceId", "driverId"],
        how="left"
    )

    return results_full

