import pandas as pd

from f1podium.config import RAW_DATA_DIR
from f1podium.data import read_tables
from f1podium.jolpica import fetch_seasons

VER = {
    "driverId": "max_verstappen",
    "code": "VER",
    "givenName": "Max",
    "familyName": "Verstappen",
}
ROOKIE = {"driverId": "new_rookie", "code": "ROO", "givenName": "New", "familyName": "Rookie"}
RED_BULL = {"constructorId": "red_bull", "name": "Red Bull"}
NEW_TEAM = {"constructorId": "new_team", "name": "New Team"}
CIRCUIT = {
    "circuitId": "albert_park",
    "circuitName": "Albert Park",
    "Location": {"locality": "Melbourne", "country": "Australia", "lat": "-37.8", "long": "145"},
}


class FakeClient:
    def races(self, path, cache=False):
        if path.endswith("/races/"):
            return [
                {
                    "round": "1",
                    "raceName": "Australian GP",
                    "date": "2030-03-08",
                    "Circuit": CIRCUIT,
                },
                {"round": "2", "raceName": "Next GP", "date": "2030-03-22", "Circuit": CIRCUIT},
            ]
        if path.endswith("/results/"):
            results = [
                {"Driver": ROOKIE, "Constructor": NEW_TEAM, "grid": "2", "position": "1",
                 "points": "25", "status": "Finished"},
                {"Driver": VER, "Constructor": RED_BULL, "grid": "1", "position": "2",
                 "points": "18", "status": "Lapped"},
            ]  # fmt: skip
            return [{"round": "1", "Results": results}]
        if path.endswith("/qualifying/"):
            quali = [
                {"Driver": VER, "Constructor": RED_BULL, "position": "1", "Q1": "1:20.000"},
                {"Driver": ROOKIE, "Constructor": NEW_TEAM, "position": "2", "Q1": "1:20.500"},
            ]
            return [{"round": "1", "QualifyingResults": quali}]
        raise AssertionError(path)

    def get(self, path, cache=False):
        if "driverstandings" in path:
            standings = [
                {"Driver": ROOKIE, "points": "25", "position": "1"},
                {"Driver": VER, "points": "18", "position": "2"},
            ]
            return {"StandingsTable": {"StandingsLists": [{"DriverStandings": standings}]}}
        standings = [{"Constructor": NEW_TEAM, "points": "25", "position": "1"}]
        return {"StandingsTable": {"StandingsLists": [{"ConstructorStandings": standings}]}}


def test_fetch_seasons_maps_to_ergast_schema():
    raw = read_tables(RAW_DATA_DIR)  # the historical dump only, as update() uses
    tables = fetch_seasons([2030], raw, FakeClient(), current_season=2030, log=lambda *_: None)

    races = tables["races"]
    assert list(races["round"]) == [1, 2]
    assert races["raceId"].min() > raw.races["raceId"].max()

    # Known refs reuse historical ids, new ones get fresh ids and a row.
    ver_id = raw.drivers.loc[raw.drivers["driverRef"] == "max_verstappen", "driverId"].item()
    results = tables["results"].set_index("positionOrder")
    assert results.loc[2, "driverId"] == ver_id
    assert results.loc[1, "driverId"] > raw.drivers["driverId"].max()
    assert list(tables["drivers"]["driverRef"]) == ["new_rookie"]
    assert list(tables["constructors"]["constructorRef"]) == ["new_team"]
    assert list(tables["circuits"]) == []  # albert_park already exists

    lapped = tables["status"]
    assert list(lapped["status"]) == ["Lapped"]
    assert results.loc[2, "statusId"] == lapped["statusId"].item()

    # Standings only for the round that has results; ids continue the dump's.
    assert set(tables["driver_standings"]["raceId"]) == {races["raceId"].iloc[0]}
    assert tables["results"]["resultId"].min() == raw.results["resultId"].max() + 1
    assert pd.isna(tables["qualifying"].loc[0, "q2"])
