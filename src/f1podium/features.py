"""Pre-race features.

Every feature for a race is computed only from information available before the
lights go out: the starting grid and qualifying of that race, plus outcomes of
strictly earlier races (``shift(1)`` in chronological ``race_seq`` order).
"""

import numpy as np
import pandas as pd

from f1podium.data import RawData

FEATURE_INFO: dict[str, tuple[str, str]] = {
    "grid": ("Grid position", "Starting position; pit-lane starts count as the back of the grid."),
    "quali_position": ("Qualifying position", "Classified qualifying result."),
    "quali_gap_pct": (
        "Gap to pole",
        "Best qualifying lap vs. the fastest lap of the session, in %.",
    ),
    "teammate_quali_delta": (
        "Qualifying vs. teammate",
        "Qualifying position minus the teammate's; negative means ahead.",
    ),
    "grid_penalty": ("Grid penalty", "Grid position minus qualifying position."),
    "drv_avg_finish_5": ("Driver form", "Average finishing position over the last 5 races."),
    "drv_podium_rate_10": ("Driver podium rate", "Share of podiums over the last 10 races."),
    "drv_dnf_rate_10": ("Driver DNF rate", "Share of non-finishes over the last 10 races."),
    "drv_positions_gained_10": (
        "Racecraft",
        "Average places gained from grid to flag over the last 10 races.",
    ),
    "drv_circuit_avg_finish": (
        "Track record",
        "Average finish at this circuit over the last 5 visits.",
    ),
    "drv_experience": ("Experience", "Number of previous Grand Prix starts."),
    "drv_points_share": (
        "Championship share",
        "Season points before this race relative to the championship leader.",
    ),
    "drv_champ_position": ("Championship position", "Drivers' standings before this race."),
    "con_avg_finish_5": ("Team form", "Average finish of the team's cars over the last 5 races."),
    "con_podium_rate_10": (
        "Team podium rate",
        "Share of team entries on the podium, last 10 races.",
    ),
    "con_dnf_rate_10": ("Team DNF rate", "Share of team entries not finishing, last 10 races."),
    "con_points_share": (
        "Constructors' share",
        "Team season points before this race relative to the leading team.",
    ),
    # Race-relative features: a driver's chance depends on who else is on the grid.
    "drv_podium_rate_rank": ("Podium-rate rank", "Rank of driver podium rate within this field."),
    "drv_form_rank": ("Driver-form rank", "Rank of driver form within this field."),
    "drv_points_rank": ("Championship-share rank", "Rank of championship share in this field."),
    "con_form_rank": ("Team-form rank", "Rank of team form within this field."),
    "con_podium_rate_rank": ("Team podium-rate rank", "Rank of team podium rate in this field."),
    "con_points_rank": ("Constructors'-share rank", "Rank of constructors' share in this field."),
    "quali_gap_rank": ("Pace rank", "Rank of qualifying gap to pole within this field."),
    "con_form_gap": ("Team form gap", "Team form minus the best team form in this field."),
    "drv_podium_rate_gap": (
        "Podium-rate gap",
        "Best driver podium rate in this field minus this driver's.",
    ),
}

FEATURES = list(FEATURE_INFO)

# feature -> rank ascending (lower value is better)
_RANKED = {
    "drv_podium_rate_10": ("drv_podium_rate_rank", False),
    "drv_avg_finish_5": ("drv_form_rank", True),
    "drv_points_share": ("drv_points_rank", False),
    "con_avg_finish_5": ("con_form_rank", True),
    "con_podium_rate_10": ("con_podium_rate_rank", False),
    "con_points_share": ("con_points_rank", False),
    "quali_gap_pct": ("quali_gap_rank", True),
}


def _prior_rolling(df: pd.DataFrame, keys, column: str, window: int) -> pd.Series:
    return df.groupby(keys, sort=False)[column].transform(
        lambda s: s.shift(1).rolling(window, min_periods=1).mean()
    )


def _standings_before_race(raw: RawData, calendar: pd.DataFrame) -> tuple[pd.DataFrame, ...]:
    """Driver and constructor standings after the previous round of the same season."""
    prev = calendar[["raceId", "year", "round"]].copy()
    prev["round"] += 1
    prev = prev.rename(columns={"raceId": "prev_raceId"})
    race_to_prev = calendar[["raceId", "year", "round"]].merge(prev, on=["year", "round"])
    race_to_prev = race_to_prev[["raceId", "prev_raceId"]]

    def before(standings: pd.DataFrame, key: str, prefix: str) -> pd.DataFrame:
        s = standings[["raceId", key, "points", "position"]].copy()
        s["leader_points"] = s.groupby("raceId")["points"].transform("max")
        s[f"{prefix}_points_share"] = np.where(
            s["leader_points"] > 0, s["points"] / s["leader_points"], 0.0
        )
        s = s.rename(columns={"raceId": "prev_raceId", "position": f"{prefix}_champ_position"})
        out = race_to_prev.merge(s, on="prev_raceId")
        return out[["raceId", key, f"{prefix}_points_share", f"{prefix}_champ_position"]]

    return (
        before(raw.driver_standings, "driverId", "drv"),
        before(raw.constructor_standings, "constructorId", "con"),
    )


def add_grid_features(df: pd.DataFrame) -> pd.DataFrame:
    """Features derived from grid and qualifying positions (in place).

    Kept separate, like add_race_relative_features, so what-if scenarios can recompute
    them after editing a grid.
    """
    team = df.groupby(["raceId", "constructorId"])["quali_position"]
    team_sum, team_count = team.transform("sum"), team.transform("count")
    teammate_avg = (team_sum - df["quali_position"]) / (team_count - 1)
    df["teammate_quali_delta"] = (df["quali_position"] - teammate_avg).where(team_count > 1)
    df["grid_penalty"] = df["grid"] - df["quali_position"]
    return df


def add_race_relative_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compare each driver with the rest of the same field (in place)."""
    by_race = df.groupby("raceId")
    for source, (target, ascending) in _RANKED.items():
        df[target] = by_race[source].rank(ascending=ascending, method="average")
    df["con_form_gap"] = df["con_avg_finish_5"] - by_race["con_avg_finish_5"].transform("min")
    df["drv_podium_rate_gap"] = (
        by_race["drv_podium_rate_10"].transform("max") - df["drv_podium_rate_10"]
    )
    return df


def build_features(entries: pd.DataFrame, raw: RawData) -> pd.DataFrame:
    """Return ``entries`` with all FEATURES added. Rows must already carry ``race_seq``.

    Entries for races that have not happened yet (outcome columns NaN) get valid
    features too, which is how upcoming races are predicted.
    """
    df = entries.sort_values(["race_seq", "driverId"]).reset_index(drop=True).copy()

    # --- Known before the race -------------------------------------------------
    field_size = df.groupby("raceId")["driverId"].transform("count")
    df["grid"] = np.where(df["grid"] > 0, df["grid"], field_size).astype(float)
    df["quali_position"] = df["quali_position"].fillna(df["grid"])

    pole_time = df.groupby("raceId")["quali_best_s"].transform("min")
    df["quali_gap_pct"] = ((df["quali_best_s"] / pole_time - 1) * 100).clip(0, 10)

    add_grid_features(df)

    # --- Driver history --------------------------------------------------------
    df["dnf"] = 1 - df["finished"].where(df["finish_position"].notna())
    df["positions_gained"] = df["grid"] - df["finish_position"]

    df["drv_avg_finish_5"] = _prior_rolling(df, "driverId", "finish_position", 5)
    df["drv_podium_rate_10"] = _prior_rolling(df, "driverId", "podium", 10)
    df["drv_dnf_rate_10"] = _prior_rolling(df, "driverId", "dnf", 10)
    df["drv_positions_gained_10"] = _prior_rolling(df, "driverId", "positions_gained", 10)
    df["drv_circuit_avg_finish"] = _prior_rolling(
        df, ["driverId", "circuitId"], "finish_position", 5
    )
    df["drv_experience"] = df.groupby("driverId").cumcount().astype(float)

    # --- Constructor history (aggregated per team per race first) ---------------
    team_races = (
        df.groupby(["constructorId", "race_seq"], as_index=False)
        .agg(
            team_finish=("finish_position", "mean"),
            team_podium=("podium", "mean"),
            team_dnf=("dnf", "mean"),
        )
        .sort_values("race_seq")
    )
    team_races["con_avg_finish_5"] = _prior_rolling(team_races, "constructorId", "team_finish", 5)
    team_races["con_podium_rate_10"] = _prior_rolling(
        team_races, "constructorId", "team_podium", 10
    )
    team_races["con_dnf_rate_10"] = _prior_rolling(team_races, "constructorId", "team_dnf", 10)
    df = df.merge(
        team_races[
            [
                "constructorId",
                "race_seq",
                "con_avg_finish_5",
                "con_podium_rate_10",
                "con_dnf_rate_10",
            ]
        ],
        on=["constructorId", "race_seq"],
        how="left",
    )

    # --- Championship standings before the race ---------------------------------
    calendar = df[["raceId", "year", "round"]].drop_duplicates()
    drv_standings, con_standings = _standings_before_race(raw, calendar)
    df = df.merge(drv_standings, on=["raceId", "driverId"], how="left")
    df = df.merge(con_standings, on=["raceId", "constructorId"], how="left")

    add_race_relative_features(df)

    return (
        df.drop(columns=["dnf", "positions_gained"])
        .sort_values(["race_seq", "grid"])
        .reset_index(drop=True)
    )
