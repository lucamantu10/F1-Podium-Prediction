import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

import streamlit as st
import pandas as pd
import joblib

from src.data.database import load_from_db
from src.data_collection.fastf1_data import (
    get_race_results,
    get_qualifying_results,
    get_lap_times,
    get_tyre_strategy,
    get_weather_data,
    get_driver_telemetry,
    get_available_drivers
)


MODELS_PATH = BASE_DIR / "models"


st.set_page_config(
    page_title="F1 Podium Predictor",
    page_icon="🏎️",
    layout="wide"
)


def inject_css():
    st.markdown(
        """
        <style>
        .stApp {
            background: linear-gradient(135deg, #0b0f1a 0%, #111827 50%, #1f2937 100%);
            color: white;
        }

        .main-title {
            font-size: 42px;
            font-weight: 800;
            color: white;
            margin-bottom: 0;
        }

        .subtitle {
            font-size: 18px;
            color: #cbd5e1;
            margin-top: 0;
            margin-bottom: 20px;
        }

        .section-title {
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin-top: 20px;
            margin-bottom: 10px;
        }

        .app-card {
            background: rgba(255, 255, 255, 0.06);
            padding: 20px;
            border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            margin-bottom: 16px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            padding: 18px;
            border-radius: 16px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.08);
        }

        .stat-label {
            font-size: 14px;
            color: #94a3b8;
        }

        .stat-value {
            font-size: 26px;
            font-weight: 700;
            color: white;
        }

        .prediction-card {
            padding: 24px;
            border-radius: 18px;
            text-align: center;
            color: white;
            font-weight: 600;
            margin-bottom: 16px;
        }

        .small-note {
            color: #94a3b8;
            font-size: 13px;
        }

        .sidebar-title {
            font-size: 22px;
            font-weight: 700;
            color: white;
            margin-bottom: 10px;
        }

        .hero-box {
            background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(59,130,246,0.18));
            padding: 24px;
            border-radius: 22px;
            border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 24px;
        }

        .feature-badge {
            display: inline-block;
            padding: 8px 14px;
            margin: 6px 8px 0 0;
            border-radius: 999px;
            background: rgba(255,255,255,0.08);
            color: #e5e7eb;
            font-size: 13px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        </style>
        """,
        unsafe_allow_html=True
    )


@st.cache_data
def get_dataset():
    df = load_from_db()
    df["driver_full_name"] = df["forename"] + " " + df["surname"]
    return df


@st.cache_resource
def load_artifacts():
    artifacts = {
        "logistic_model": joblib.load(MODELS_PATH / "logistic_regression_model.pkl"),
        "logistic_scaler": joblib.load(MODELS_PATH / "logistic_regression_scaler.pkl"),
        "le_forename": joblib.load(MODELS_PATH / "le_forename.pkl"),
        "le_surname": joblib.load(MODELS_PATH / "le_surname.pkl"),
        "le_team": joblib.load(MODELS_PATH / "le_team.pkl"),
        "le_race": joblib.load(MODELS_PATH / "le_race.pkl"),
        "mlp_available": False
    }

    mlp_model_path = MODELS_PATH / "mlp_neural_network_model.pkl"
    mlp_scaler_path = MODELS_PATH / "mlp_neural_network_scaler.pkl"
    mlp_le_forename_path = MODELS_PATH / "mlp_le_forename.pkl"
    mlp_le_surname_path = MODELS_PATH / "mlp_le_surname.pkl"
    mlp_le_team_path = MODELS_PATH / "mlp_le_team.pkl"
    mlp_le_race_path = MODELS_PATH / "mlp_le_race.pkl"

    if (
        mlp_model_path.exists()
        and mlp_scaler_path.exists()
        and mlp_le_forename_path.exists()
        and mlp_le_surname_path.exists()
        and mlp_le_team_path.exists()
        and mlp_le_race_path.exists()
    ):
        artifacts["mlp_model"] = joblib.load(mlp_model_path)
        artifacts["mlp_scaler"] = joblib.load(mlp_scaler_path)
        artifacts["mlp_le_forename"] = joblib.load(mlp_le_forename_path)
        artifacts["mlp_le_surname"] = joblib.load(mlp_le_surname_path)
        artifacts["mlp_le_team"] = joblib.load(mlp_le_team_path)
        artifacts["mlp_le_race"] = joblib.load(mlp_le_race_path)
        artifacts["mlp_available"] = True

    return artifacts


def build_encoded_sample(df, driver_data, grid, driver_form, constructor_form, experience, encoders):
    X = df.drop(["podium", "positionOrder", "points", "driver_full_name"], axis=1).copy()

    X["forename"] = encoders["forename"].transform(X["forename"])
    X["surname"] = encoders["surname"].transform(X["surname"])
    X["name_x"] = encoders["team"].transform(X["name_x"])
    X["name_y"] = encoders["race"].transform(X["name_y"])

    sample = X.loc[driver_data.name].copy()

    sample["grid"] = grid
    sample["driver_form"] = driver_form
    sample["constructor_form"] = constructor_form
    sample["experience"] = experience

    sample_df = pd.DataFrame([sample], columns=X.columns)
    return sample_df


def predict_probability(sample_df, model, scaler):
    sample_scaled = scaler.transform(sample_df)
    probability = model.predict_proba(sample_scaled)[0][1]
    return probability


def probability_label(probability):
    if probability >= 0.70:
        return "Strong podium chance", "#16a34a"
    elif probability >= 0.50:
        return "Moderate podium chance", "#f59e0b"
    else:
        return "Low podium chance", "#ef4444"


def render_prediction_card(title, probability):
    label, color = probability_label(probability)

    st.markdown(
        f"""
        <div class="prediction-card" style="background: linear-gradient(135deg, {color}, #111827); border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 18px; opacity: 0.9;">{title}</div>
            <div style="font-size: 40px; font-weight: 800; margin-top: 10px;">{probability:.2%}</div>
            <div style="font-size: 15px; margin-top: 8px;">{label}</div>
        </div>
        """,
        unsafe_allow_html=True
    )


inject_css()

df = get_dataset()
artifacts = load_artifacts()

st.markdown(
    """
    <div class="hero-box">
        <div class="main-title">🏎️ F1 Podium Predictor</div>
        <div class="subtitle">
            A machine learning application that predicts whether a Formula 1 driver is likely
            to finish on the podium based on historical race performance, qualifying position,
            driver form, constructor form and experience.
        </div>
        <span class="feature-badge">Logistic Regression</span>
        <span class="feature-badge">MLP Neural Network</span>
        <span class="feature-badge">SQLite Database</span>
        <span class="feature-badge">FastF1 Integration</span>
        <span class="feature-badge">Streamlit Dashboard</span>
    </div>
    """,
    unsafe_allow_html=True
)

# ---------------- SIDEBAR ----------------
with st.sidebar:
    st.markdown('<div class="sidebar-title">⚙️ Control Center</div>', unsafe_allow_html=True)

    selected_driver = st.selectbox(
        "Select driver",
        sorted(df["driver_full_name"].unique())
    )

    driver_rows = df[df["driver_full_name"] == selected_driver].sort_values(["year", "raceId"])
    driver_data = driver_rows.iloc[-1]

    st.markdown("### Model Mode")
    model_mode = st.radio(
        "Choose prediction view",
        [
            "Compare both models",
            "Logistic Regression only",
            "MLP only"
        ]
    )

    if model_mode == "MLP only" and not artifacts["mlp_available"]:
        st.warning("MLP model files were not found. Falling back to Logistic Regression only.")
        model_mode = "Logistic Regression only"

    show_controls = st.toggle("Edit driver inputs", value=False)

    if show_controls:
        with st.expander("Advanced input controls", expanded=True):
            grid = st.slider("Grid Position", 1, 20, int(driver_data["grid"]))
            driver_form = st.slider("Driver Form", 1.0, 20.0, float(driver_data["driver_form"]))
            constructor_form = st.slider("Constructor Form", 1.0, 20.0, float(driver_data["constructor_form"]))
            experience = st.slider("Experience", 0, 400, int(driver_data["experience"]))
    else:
        grid = int(driver_data["grid"])
        driver_form = float(driver_data["driver_form"])
        constructor_form = float(driver_data["constructor_form"])
        experience = int(driver_data["experience"])

    predict_button = st.button("🚀 Run Prediction", use_container_width=True)

    st.markdown("### FastF1 Data")

    selected_year = st.selectbox(
        "Season",
        [2025, 2024, 2023, 2022, 2021],
        index=0
    )

    selected_race = st.text_input(
        "Race name",
        "Monaco Grand Prix"
    )

    selected_session = st.selectbox(
        "Session",
        ["R", "Q", "FP1", "FP2", "FP3"],
        index=0
    )

    fastf1_button = st.button(
        "📡 Load FastF1 Dashboard",
        use_container_width=True
    )

# ---------------- TABS ----------------
tab1, tab2, tab3 = st.tabs(["Prediction Center", "FastF1 Live Data", "Project Overview"])

# ---------------- TAB 1 ----------------
with tab1:
    st.markdown('<div class="section-title">Prediction Center</div>', unsafe_allow_html=True)

    col1, col2 = st.columns([1.2, 1.8])

    with col1:
        st.markdown('<div class="app-card">', unsafe_allow_html=True)
        st.subheader("Selected Driver")
        st.write(f"**Name:** {selected_driver}")
        st.write(f"**Team:** {driver_data['name_x']}")
        st.write(f"**Latest Race:** {driver_data['name_y']}")
        st.write(f"**Season:** {int(driver_data['year'])}")
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="app-card">', unsafe_allow_html=True)
        st.subheader("Current Feature Snapshot")

        metric_col1, metric_col2 = st.columns(2)
        with metric_col1:
            st.metric("Grid", grid)
            st.metric("Driver Form", f"{driver_form:.2f}")
        with metric_col2:
            st.metric("Constructor Form", f"{constructor_form:.2f}")
            st.metric("Experience", experience)
        st.markdown('</div>', unsafe_allow_html=True)

    with col2:
        st.markdown('<div class="app-card">', unsafe_allow_html=True)
        st.subheader("Recent Performance Trend")

        history_df = driver_rows.tail(10).copy()
        history_df = history_df[["grid", "positionOrder"]]
        history_df.index = range(1, len(history_df) + 1)

        st.line_chart(history_df)
        st.caption("Lower values are better because position 1 means first place.")
        st.markdown('</div>', unsafe_allow_html=True)

    if predict_button:
        results = {}

        logistic_sample = build_encoded_sample(
            df=df,
            driver_data=driver_data,
            grid=grid,
            driver_form=driver_form,
            constructor_form=constructor_form,
            experience=experience,
            encoders={
                "forename": artifacts["le_forename"],
                "surname": artifacts["le_surname"],
                "team": artifacts["le_team"],
                "race": artifacts["le_race"]
            }
        )

        logistic_prob = predict_probability(
            sample_df=logistic_sample,
            model=artifacts["logistic_model"],
            scaler=artifacts["logistic_scaler"]
        )

        results["logistic"] = logistic_prob

        if artifacts["mlp_available"]:
            mlp_sample = build_encoded_sample(
                df=df,
                driver_data=driver_data,
                grid=grid,
                driver_form=driver_form,
                constructor_form=constructor_form,
                experience=experience,
                encoders={
                    "forename": artifacts["mlp_le_forename"],
                    "surname": artifacts["mlp_le_surname"],
                    "team": artifacts["mlp_le_team"],
                    "race": artifacts["mlp_le_race"]
                }
            )

            mlp_prob = predict_probability(
                sample_df=mlp_sample,
                model=artifacts["mlp_model"],
                scaler=artifacts["mlp_scaler"]
            )

            results["mlp"] = mlp_prob

        st.session_state["prediction_results"] = results

    if "prediction_results" in st.session_state:
        results = st.session_state["prediction_results"]

        st.markdown('<div class="section-title">Prediction Results</div>', unsafe_allow_html=True)

        if model_mode == "Compare both models":
            pred_col1, pred_col2 = st.columns(2)

            with pred_col1:
                render_prediction_card("Logistic Regression", results["logistic"])

            with pred_col2:
                if "mlp" in results:
                    render_prediction_card("MLP Neural Network", results["mlp"])
                else:
                    st.info("MLP model is not available.")

        elif model_mode == "Logistic Regression only":
            render_prediction_card("Logistic Regression", results["logistic"])

        elif model_mode == "MLP only":
            if "mlp" in results:
                render_prediction_card("MLP Neural Network", results["mlp"])
            else:
                st.warning("MLP model is not available.")

        st.markdown('<div class="app-card">', unsafe_allow_html=True)
        st.subheader("Interpretation")
        st.write(
            "The prediction represents the estimated probability that the selected driver "
            "will finish on the podium based on the engineered features currently shown in the dashboard."
        )
        st.markdown('</div>', unsafe_allow_html=True)

    else:
        st.info("Run a prediction from the Control Center to see the model output.")

# ---------------- TAB 2 ----------------
with tab2:
    st.markdown('<div class="section-title">FastF1 Race Intelligence</div>', unsafe_allow_html=True)

    st.markdown(
        """
        <div class="app-card">
            This section uses FastF1 to analyze real Formula 1 session data:
            results, qualifying, lap times, tyre strategy, weather and telemetry.
        </div>
        """,
        unsafe_allow_html=True
    )

    if fastf1_button:
        try:
            with st.spinner("Loading FastF1 data. First load can take a while..."):

                race_results = get_race_results(selected_year, selected_race)
                lap_times = get_lap_times(selected_year, selected_race, selected_session)
                tyre_strategy = get_tyre_strategy(selected_year, selected_race)
                weather = get_weather_data(selected_year, selected_race, selected_session)
                qualifying = get_qualifying_results(selected_year, selected_race)
                available_drivers = get_available_drivers(selected_year, selected_race, selected_session)

                st.session_state["fastf1_loaded"] = True
                st.session_state["race_results"] = race_results
                st.session_state["lap_times"] = lap_times
                st.session_state["tyre_strategy"] = tyre_strategy
                st.session_state["weather"] = weather
                st.session_state["qualifying"] = qualifying
                st.session_state["available_drivers"] = available_drivers
                st.session_state["fastf1_year"] = selected_year
                st.session_state["fastf1_race"] = selected_race
                st.session_state["fastf1_session"] = selected_session

        except Exception as e:
            st.error("Could not load FastF1 data. Try another season/race/session.")
            st.write(e)

    if st.session_state.get("fastf1_loaded"):

        race_results = st.session_state["race_results"]
        lap_times = st.session_state["lap_times"]
        tyre_strategy = st.session_state["tyre_strategy"]
        weather = st.session_state["weather"]
        qualifying = st.session_state["qualifying"]
        available_drivers = st.session_state["available_drivers"]

        st.subheader(
            f"{st.session_state['fastf1_year']} - {st.session_state['fastf1_race']} - {st.session_state['fastf1_session']}"
        )

        summary_col1, summary_col2, summary_col3, summary_col4 = st.columns(4)

        with summary_col1:
            if not race_results.empty:
                st.metric("Winner", race_results.iloc[0]["driver"])
            else:
                st.metric("Winner", "N/A")

        with summary_col2:
            if not race_results.empty:
                st.metric("Top Team", race_results.iloc[0]["team"])
            else:
                st.metric("Top Team", "N/A")

        with summary_col3:
            if not lap_times.empty:
                st.metric("Total Laps", int(lap_times["LapNumber"].max()))
            else:
                st.metric("Total Laps", "N/A")

        with summary_col4:
            if not weather.empty and "TrackTemp" in weather.columns:
                st.metric("Avg Track Temp", f"{weather['TrackTemp'].mean():.1f}°C")
            else:
                st.metric("Avg Track Temp", "N/A")

        f1_tab1, f1_tab2, f1_tab3, f1_tab4, f1_tab5, f1_tab6 = st.tabs(
            [
                "Results",
                "Qualifying",
                "Lap Times",
                "Tyres",
                "Weather",
                "Telemetry"
            ]
        )

        with f1_tab1:
            st.subheader("Race Results")
            st.dataframe(race_results, use_container_width=True)

        with f1_tab2:
            st.subheader("Qualifying Results")
            st.dataframe(qualifying, use_container_width=True)

        with f1_tab3:
            st.subheader("Lap Time Analysis")

            if not lap_times.empty:
                driver_filter = st.multiselect(
                    "Select drivers for lap chart",
                    sorted(lap_times["Driver"].dropna().unique()),
                    default=sorted(lap_times["Driver"].dropna().unique())[:3]
                )

                filtered_laps = lap_times[lap_times["Driver"].isin(driver_filter)]

                chart_df = filtered_laps.pivot_table(
                    index="LapNumber",
                    columns="Driver",
                    values="LapTimeSeconds"
                )

                st.line_chart(chart_df)

                st.dataframe(
                    lap_times[[
                        "Driver",
                        "Team",
                        "LapNumber",
                        "LapTime",
                        "LapTimeSeconds",
                        "Compound",
                        "TyreLife"
                    ]],
                    use_container_width=True
                )
            else:
                st.info("No lap time data available.")

        with f1_tab4:
            st.subheader("Tyre Strategy")

            if not tyre_strategy.empty:
                st.dataframe(tyre_strategy, use_container_width=True)

                tyre_chart = tyre_strategy.pivot_table(
                    index="Driver",
                    columns="Compound",
                    values="laps",
                    aggfunc="sum",
                    fill_value=0
                )

                st.bar_chart(tyre_chart)
            else:
                st.info("No tyre data available.")

        with f1_tab5:
            st.subheader("Weather Data")

            if not weather.empty:
                st.dataframe(weather, use_container_width=True)

                weather_columns = [
                    col for col in ["AirTemp", "TrackTemp", "Humidity", "Rainfall"]
                    if col in weather.columns
                ]

                if weather_columns:
                    st.line_chart(weather[weather_columns])
            else:
                st.info("No weather data available.")

        with f1_tab6:
            st.subheader("Telemetry")

            if available_drivers:
                telemetry_driver = st.selectbox(
                    "Select driver for telemetry",
                    available_drivers
                )

                if st.button("Load Driver Telemetry"):
                    try:
                        telemetry_df = get_driver_telemetry(
                            st.session_state["fastf1_year"],
                            st.session_state["fastf1_race"],
                            telemetry_driver,
                            st.session_state["fastf1_session"]
                        )

                        if not telemetry_df.empty:
                            st.dataframe(telemetry_df, use_container_width=True)

                            telemetry_plot = telemetry_df.set_index("Distance")[
                                ["Speed", "Throttle", "Brake"]
                            ]

                            st.line_chart(telemetry_plot)
                        else:
                            st.info("No telemetry data available for this driver.")

                    except Exception as e:
                        st.error("Could not load telemetry.")
                        st.write(e)
            else:
                st.info("No drivers available.")
# ---------------- TAB 3 ----------------
with tab3:
    st.markdown('<div class="section-title">Project Overview</div>', unsafe_allow_html=True)

    overview_col1, overview_col2 = st.columns(2)

    with overview_col1:
        st.markdown('<div class="app-card">', unsafe_allow_html=True)
        st.subheader("What this app does")
        st.write(
            """
            - Loads historical Formula 1 data from SQLite  
            - Builds engineered features such as driver form, constructor form and experience  
            - Uses machine learning to estimate podium probability  
            - Supports both Logistic Regression and MLP Neural Network models  
            - Integrates FastF1 for real Formula 1 race data  
            """
        )
        st.markdown('</div>', unsafe_allow_html=True)

    with overview_col2:
        st.markdown('<div class="app-card">', unsafe_allow_html=True)
        st.subheader("Technology stack")
        st.write(
            """
            - **Python**
            - **Pandas**
            - **Scikit-learn**
            - **SQLite**
            - **FastF1**
            - **Streamlit**
            """
        )
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="app-card">', unsafe_allow_html=True)
    st.subheader("Modeling note")
    st.write(
        """
        The application currently includes a classic machine learning baseline
        (Logistic Regression) and a neural network model (MLPClassifier).
        This makes the project more robust and also allows model comparison in the UI.
        """
    )
    st.markdown('</div>', unsafe_allow_html=True)