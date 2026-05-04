import streamlit as st
import pandas as pd
import joblib
from pathlib import Path
from src.data_collection.fastf1_data import get_latest_race_results

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "processed" / "final_dataset.csv"
MODELS_PATH = BASE_DIR / "models"

df = pd.read_csv(DATA_PATH)

model = joblib.load(MODELS_PATH / "logistic_regression_model.pkl")
scaler = joblib.load(MODELS_PATH / "logistic_regression_scaler.pkl")

le_forename = joblib.load(MODELS_PATH / "le_forename.pkl")
le_surname = joblib.load(MODELS_PATH / "le_surname.pkl")
le_team = joblib.load(MODELS_PATH / "le_team.pkl")
le_race = joblib.load(MODELS_PATH / "le_race.pkl")

st.title("F1 Podium Prediction")

st.header("Real F1 Data")

year = st.selectbox("Select Year", [2023, 2022, 2021])
race = st.text_input("Race Name", "Monaco Grand Prix")

if st.button("Load Real Race Data"):

    try:
        real_df = get_latest_race_results(year, race)

        st.write("### Race Results")
        st.dataframe(real_df)

    except Exception as e:
        st.error("Error loading data. Check race name.")

drivers = df["forename"] + " " + df["surname"]
selected_driver = st.selectbox("Driver", drivers.unique())

driver_data = df[drivers == selected_driver].iloc[-1]

show_controls = st.toggle("Show Dashboard Controls")

if show_controls:
    with st.expander("Adjust Inputs", expanded=True):

        grid = st.slider("Grid", 1, 20, int(driver_data["grid"]))

        driver_form = st.slider(
            "Driver Form", 1.0, 20.0, float(driver_data["driver_form"])
        )

        constructor_form = st.slider(
            "Constructor Form", 1.0, 20.0, float(driver_data["constructor_form"])
        )

        experience = st.slider(
            "Experience", 0, 300, int(driver_data["experience"])
        )
else:
    grid = int(driver_data["grid"])
    driver_form = float(driver_data["driver_form"])
    constructor_form = float(driver_data["constructor_form"])
    experience = int(driver_data["experience"])


if st.button("Predict"):

    X = df.drop(["podium", "positionOrder", "points"], axis=1).copy()

    X["forename"] = le_forename.transform(X["forename"])
    X["surname"] = le_surname.transform(X["surname"])
    X["name_x"] = le_team.transform(X["name_x"])
    X["name_y"] = le_race.transform(X["name_y"])

    sample = X.loc[driver_data.name].copy()

    sample["grid"] = grid
    sample["driver_form"] = driver_form
    sample["constructor_form"] = constructor_form
    sample["experience"] = experience

    sample_scaled = scaler.transform([sample.values])

    probability = model.predict_proba(sample_scaled)[0][1]

    st.write(f"Probability: {probability:.2%}")

    if probability > 0.5:
        st.success("Podium likely")
    else:
        st.warning("Podium unlikely")