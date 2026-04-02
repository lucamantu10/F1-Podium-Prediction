import pandas as pd

def build_features(results_full):

    df = results_full[[
        "raceId",
        "driverId",
        "constructorId_x",
        "grid",
        "positionOrder",
        "points",
        "year",
        "forename",
        "surname",
        "name_y",
        "name_x",
        "position_y"
    ]]

    df = df.sort_values(by=["driverId", "year", "raceId"])

    df["driver_form"] = (
        df.groupby("driverId")["positionOrder"]
        .transform(lambda x: x.shift(1).rolling(5).mean())
    )

    df["constructor_form"] = (
        df.groupby("constructorId_x")["positionOrder"]
        .transform(lambda x: x.shift(1).rolling(5).mean())
    )

    df["experience"] = df.groupby("driverId").cumcount()

    df = df.dropna()

    df["positionOrder"] = pd.to_numeric(df["positionOrder"], errors="coerce")
    df["grid"] = pd.to_numeric(df["grid"], errors="coerce")
    df["position_y"] = pd.to_numeric(df["position_y"], errors="coerce")

    df = df.dropna()

    df["podium"] = df["positionOrder"].apply(lambda x: 1 if x <= 3 else 0)

    return df