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
    get_event_names,
    get_race_results,
    get_qualifying_results,
    get_lap_times,
    get_tyre_strategy,
    get_weather_data,
    get_driver_telemetry,
    get_available_drivers,
    get_real_race_prediction_data
)


MODELS_PATH = BASE_DIR / "models"


TEAM_COLORS = {
    "Ferrari": "#DC0000",
    "Red Bull": "#1E41FF",
    "Red Bull Racing": "#1E41FF",
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "Haas": "#B6BABD",
    "Kick Sauber": "#00FF00",
    "Sauber": "#00FF00",
    "RB": "#1534CB",
    "AlphaTauri": "#2B4562",
    "Toro Rosso": "#0032FF",
    "Renault": "#FFF500",
    "Racing Point": "#F596C8",
    "Force India": "#F596C8",
    "Lotus": "#FFB800",
    "Manor": "#ED1B2F",
    "Caterham": "#008000"
}


def get_team_color(team_name):
    if pd.isna(team_name):
        return "#dc2626"

    team_name = str(team_name)

    for key, color in TEAM_COLORS.items():
        if key.lower() in team_name.lower():
            return color

    return "#dc2626"


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
            background:
                radial-gradient(circle at top left, rgba(220, 38, 38, 0.18), transparent 30%),
                radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 30%),
                linear-gradient(135deg, #050711 0%, #0b1020 45%, #111827 100%);
            color: #f8fafc;
        }

        section[data-testid="stSidebar"] {
            background: rgba(2, 6, 23, 0.96);
            border-right: 1px solid rgba(255,255,255,0.08);
        }

        .block-container {
            padding-top: 2rem;
            padding-bottom: 3rem;
        }

        .premium-hero {
            position: relative;
            padding: 34px;
            border-radius: 30px;
            overflow: hidden;
            background:
                linear-gradient(120deg, rgba(15,23,42,0.94), rgba(17,24,39,0.86)),
                radial-gradient(circle at 75% 20%, rgba(239,68,68,0.35), transparent 35%);
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 24px 70px rgba(0,0,0,0.45);
            margin-bottom: 24px;
        }

        .premium-hero::after {
            content: "";
            position: absolute;
            right: -80px;
            top: -80px;
            width: 260px;
            height: 260px;
            border-radius: 50%;
            background: rgba(239,68,68,0.18);
            filter: blur(10px);
        }

        .eyebrow {
            color: #ef4444;
            font-size: 13px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            font-weight: 800;
            margin-bottom: 8px;
        }

        .hero-title {
            font-size: 54px;
            line-height: 1;
            font-weight: 950;
            color: #ffffff;
            margin-bottom: 10px;
        }

        .hero-subtitle {
            font-size: 18px;
            color: #cbd5e1;
            max-width: 760px;
        }

        .hero-meta {
            margin-top: 22px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .premium-badge {
            padding: 9px 14px;
            border-radius: 999px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.10);
            color: #e5e7eb;
            font-size: 13px;
            font-weight: 650;
        }

        .premium-card {
            padding: 22px;
            border-radius: 24px;
            background: rgba(255,255,255,0.065);
            border: 1px solid rgba(255,255,255,0.10);
            box-shadow: 0 18px 45px rgba(0,0,0,0.30);
            margin-bottom: 18px;
        }

        .driver-card {
            padding: 24px;
            border-radius: 26px;
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 18px 45px rgba(0,0,0,0.35);
            margin-bottom: 18px;
        }

        .card-title {
            font-size: 20px;
            font-weight: 850;
            color: #ffffff;
            margin-bottom: 8px;
        }

        .card-muted {
            color: #94a3b8;
            font-size: 14px;
        }

        .section-title {
            font-size: 30px;
            font-weight: 950;
            color: #ffffff;
            margin: 8px 0 16px 0;
        }

        .status-ok {
            color: #22c55e;
            font-weight: 800;
        }

        .status-warning {
            color: #f59e0b;
            font-weight: 800;
        }

        .prediction-card {
            padding: 30px;
            border-radius: 28px;
            color: white;
            text-align: center;
            box-shadow: 0 24px 60px rgba(0,0,0,0.38);
            border: 1px solid rgba(255,255,255,0.12);
            margin-bottom: 18px;
        }

        .prediction-title {
            font-size: 16px;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            opacity: 0.85;
            font-weight: 800;
        }

        .prediction-value {
            font-size: 52px;
            font-weight: 950;
            margin-top: 8px;
        }

        .prediction-label {
            font-size: 15px;
            margin-top: 10px;
            opacity: 0.95;
        }

        .podium-card {
            padding: 26px;
            border-radius: 28px;
            border: 1px solid rgba(255,255,255,0.12);
            text-align: center;
            box-shadow: 0 22px 55px rgba(0,0,0,0.40);
            min-height: 210px;
        }

        .podium-position {
            color: #fca5a5;
            font-size: 14px;
            letter-spacing: 0.18em;
            font-weight: 900;
        }

        .podium-driver {
            color: #ffffff;
            font-size: 42px;
            font-weight: 950;
            margin-top: 14px;
        }

        .podium-team {
            color: #cbd5e1;
            font-size: 15px;
            margin-top: 6px;
        }

        .podium-prob {
            color: #ffffff;
            font-size: 18px;
            font-weight: 800;
            margin-top: 18px;
        }

        .model-note {
            padding: 16px 18px;
            border-radius: 18px;
            background: rgba(255,255,255,0.055);
            border: 1px solid rgba(255,255,255,0.08);
            color: #cbd5e1;
            font-size: 14px;
            margin-bottom: 14px;
        }

        .race-hero {
            padding: 26px;
            border-radius: 28px;
            background:
                linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.76)),
                radial-gradient(circle at top right, rgba(59,130,246,0.22), transparent 40%);
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 20px 55px rgba(0,0,0,0.35);
            margin-bottom: 18px;
        }

        .race-title {
            font-size: 34px;
            font-weight: 950;
            color: white;
            margin-bottom: 6px;
        }

        .race-subtitle {
            color: #cbd5e1;
            font-size: 15px;
        }

        div[data-testid="stMetric"] {
            background: rgba(255,255,255,0.06);
            padding: 16px;
            border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.08);
        }

        .stTabs [data-baseweb="tab-list"] {
            gap: 10px;
        }

        .stTabs [data-baseweb="tab"] {
            background: rgba(255,255,255,0.06);
            border-radius: 999px;
            padding: 12px 18px;
            color: #cbd5e1;
            border: 1px solid rgba(255,255,255,0.08);
        }

        .stTabs [aria-selected="true"] {
            background: linear-gradient(135deg, #dc2626, #1d4ed8);
            color: white;
        }
        </style>
        """,
        unsafe_allow_html=True
    )


@st.cache_data
def get_dataset():
    data = load_from_db()
    data["driver_full_name"] = data["forename"] + " " + data["surname"]
    return data


@st.cache_resource
def load_artifacts():
    artifacts = {}

    artifacts["logistic_model"] = joblib.load(MODELS_PATH / "logistic_regression_model.pkl")
    artifacts["logistic_scaler"] = joblib.load(MODELS_PATH / "logistic_regression_scaler.pkl")
    artifacts["le_forename"] = joblib.load(MODELS_PATH / "le_forename.pkl")
    artifacts["le_surname"] = joblib.load(MODELS_PATH / "le_surname.pkl")
    artifacts["le_team"] = joblib.load(MODELS_PATH / "le_team.pkl")
    artifacts["le_race"] = joblib.load(MODELS_PATH / "le_race.pkl")

    artifacts["mlp_available"] = False

    mlp_paths = {
        "mlp_model": MODELS_PATH / "mlp_neural_network_model.pkl",
        "mlp_scaler": MODELS_PATH / "mlp_neural_network_scaler.pkl",
        "mlp_le_forename": MODELS_PATH / "mlp_le_forename.pkl",
        "mlp_le_surname": MODELS_PATH / "mlp_le_surname.pkl",
        "mlp_le_team": MODELS_PATH / "mlp_le_team.pkl",
        "mlp_le_race": MODELS_PATH / "mlp_le_race.pkl",
    }

    if all(path.exists() for path in mlp_paths.values()):
        for key, path in mlp_paths.items():
            artifacts[key] = joblib.load(path)
        artifacts["mlp_available"] = True

    return artifacts


def get_probability_label(probability):
    if probability >= 0.75:
        return "High podium chance", "#16a34a"
    if probability >= 0.50:
        return "Medium podium chance", "#f59e0b"
    return "Low podium chance", "#dc2626"


def render_prediction_card(model_name, probability, model_type):
    label, color = get_probability_label(probability)

    st.markdown(
        f"""
        <div class="prediction-card" style="background: linear-gradient(135deg, {color}, #111827);">
            <div class="prediction-title">{model_name}</div>
            <div class="prediction-value">{probability:.2%}</div>
            <div class="prediction-label">{label}</div>
            <div class="card-muted" style="margin-top: 10px;">{model_type}</div>
        </div>
        """,
        unsafe_allow_html=True
    )


def build_sample(df, driver_data, grid, driver_form, constructor_form, experience, encoders):
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
    return model.predict_proba(sample_scaled)[0][1]


def render_prediction_summary(predicted_top3, actual_top3):
    predicted_winner = predicted_top3.iloc[0]
    actual_winner = actual_top3.iloc[0]

    predicted_podium = set(predicted_top3["driver"].tolist())
    actual_podium = set(actual_top3["driver"].tolist())

    podium_hits = len(predicted_podium.intersection(actual_podium))
    winner_correct = predicted_winner["driver"] == actual_winner["driver"]
    match_score = podium_hits / 3

    st.markdown(
        f"""
        <div class="race-hero">
            <div class="eyebrow">Prediction Evaluation</div>
            <div class="race-title">Race Prediction Summary</div>
            <div class="race-subtitle">
                Predicted winner: <b>{predicted_winner['driver']}</b> ·
                Actual winner: <b>{actual_winner['driver']}</b>
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    c1, c2, c3, c4 = st.columns(4)

    with c1:
        st.metric("Predicted Winner", predicted_winner["driver"])

    with c2:
        st.metric("Actual Winner", actual_winner["driver"])

    with c3:
        st.metric("Podium Hits", f"{podium_hits}/3")

    with c4:
        st.metric("Match Score", f"{match_score:.0%}")

    if winner_correct:
        st.success("The model correctly predicted the race winner.")
    else:
        st.warning("The model did not predict the exact race winner, but podium overlap may still be useful.")


def render_premium_leaderboard(leaderboard):
    st.markdown('<div class="section-title">Full Prediction Leaderboard</div>', unsafe_allow_html=True)

    top_leaderboard = leaderboard.head(10).copy()

    for position, (_, row) in enumerate(top_leaderboard.iterrows(), start=1):
        team_color = get_team_color(row["team"])
        probability = float(row["average_probability"])

        st.markdown(
            f"""
            <div style="
                padding: 18px 20px;
                margin-bottom: 10px;
                border-radius: 20px;
                background: rgba(255,255,255,0.06);
                border: 1px solid {team_color}88;
                box-shadow: 0 12px 35px {team_color}22;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 20px; font-weight: 900; color: white;">
                            #{position} · {row['driver']} · {row['full_name']}
                        </div>
                        <div style="font-size: 14px; color: #94a3b8; margin-top: 4px;">
                            {row['team']} · Grid {row['grid']} · Qualifying {row['qualifying_position']}
                        </div>
                    </div>
                    <div style="font-size: 26px; font-weight: 950; color: white;">
                        {probability:.2%}
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

        st.progress(probability)

def render_model_status(artifacts):
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown(
            """
            <div class="premium-card">
                <div class="card-title">Logistic Regression</div>
                <div class="status-ok">Loaded</div>
                <div class="card-muted">High-recall podium detection model</div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with col2:
        if artifacts["mlp_available"]:
            status = "Loaded"
            status_class = "status-ok"
            note = "Stable neural network MLP model"
        else:
            status = "Missing"
            status_class = "status-warning"
            note = "Run training pipeline first"

        st.markdown(
            f"""
            <div class="premium-card">
                <div class="card-title">MLP Neural Network</div>
                <div class="{status_class}">{status}</div>
                <div class="card-muted">{note}</div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with col3:
        st.markdown(
            """
            <div class="premium-card">
                <div class="card-title">Race Intelligence</div>
                <div class="status-ok">SQLite + FastF1</div>
                <div class="card-muted">Historical data and real session analysis</div>
            </div>
            """,
            unsafe_allow_html=True
        )


inject_css()

try:
    df = get_dataset()
    artifacts = load_artifacts()
except Exception as e:
    st.error("Application failed to load required data or model files.")
    st.write(e)
    st.stop()


st.markdown(
    """
    <div class="premium-hero">
        <div class="eyebrow">Formula 1 Machine Learning Dashboard</div>
        <div class="hero-title">F1 Podium Predictor</div>
        <div class="hero-subtitle">
            Race intelligence, podium probability and FastF1 telemetry analysis in one premium dashboard.
        </div>
        <div class="hero-meta">
            <span class="premium-badge">Podium Prediction</span>
            <span class="premium-badge">MLP Neural Network</span>
            <span class="premium-badge">FastF1 Telemetry</span>
            <span class="premium-badge">SQLite Pipeline</span>
            <span class="premium-badge">Race Leaderboard</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True
)

render_model_status(artifacts)


with st.sidebar:
    st.markdown("## 🏁 Race Control")

    selected_driver = st.selectbox(
        "Driver",
        sorted(df["driver_full_name"].unique())
    )

    driver_rows = df[df["driver_full_name"] == selected_driver].sort_values(["year", "raceId"])
    driver_data = driver_rows.iloc[-1]

    st.markdown("### Prediction Model")

    available_modes = ["Compare both models", "Logistic Regression only"]

    if artifacts["mlp_available"]:
        available_modes.append("MLP only")

    model_mode = st.radio(
        "Mode",
        available_modes
    )

    st.markdown("### Race Scenario")

    scenario = st.selectbox(
        "Input mode",
        [
            "Default historical profile",
            "Strong qualifying",
            "Midfield start",
            "Bad qualifying / comeback",
            "Custom manual"
        ]
    )

    base_grid = int(driver_data["grid"])
    base_driver_form = float(driver_data["driver_form"])
    base_constructor_form = float(driver_data["constructor_form"])
    base_experience = int(driver_data["experience"])

    if scenario == "Default historical profile":
        grid = base_grid
        driver_form = base_driver_form
        constructor_form = base_constructor_form
        experience = base_experience

    elif scenario == "Strong qualifying":
        grid = 2
        driver_form = max(1.0, base_driver_form - 1.0)
        constructor_form = max(1.0, base_constructor_form - 1.0)
        experience = base_experience

    elif scenario == "Midfield start":
        grid = 10
        driver_form = base_driver_form
        constructor_form = base_constructor_form
        experience = base_experience

    elif scenario == "Bad qualifying / comeback":
        grid = 16
        driver_form = base_driver_form
        constructor_form = base_constructor_form
        experience = base_experience

    else:
        grid = st.slider(
            "Grid Position",
            1,
            20,
            base_grid,
            help="Starting position on the grid. Lower is better."
        )

        driver_form = st.slider(
            "Driver Form",
            1.0,
            20.0,
            base_driver_form,
            help="Average finishing position over recent races. Lower is better."
        )

        constructor_form = st.slider(
            "Constructor Form",
            1.0,
            20.0,
            base_constructor_form,
            help="Average recent performance of the constructor. Lower is better."
        )

        experience = st.slider(
            "Experience",
            0,
            400,
            base_experience,
            help="Number of previous races for the driver in the dataset."
        )

    st.markdown("#### Active Inputs")

    input_col1, input_col2 = st.columns(2)

    with input_col1:
        st.metric("Grid", grid)
        st.metric("Driver Form", f"{driver_form:.2f}")

    with input_col2:
        st.metric("Team Form", f"{constructor_form:.2f}")
        st.metric("Experience", experience)

    predict_button = st.button("🚀 Run Prediction", use_container_width=True)

    st.markdown("---")
    st.markdown("### FastF1 Intelligence")

    selected_year = st.selectbox(
        "Season",
        [2025, 2024, 2023, 2022, 2021],
        index=1
    )

    try:
        available_races = get_event_names(selected_year)
    except Exception:
        available_races = [
            "Monaco Grand Prix",
            "British Grand Prix",
            "Italian Grand Prix",
            "Bahrain Grand Prix"
        ]

    selected_race = st.selectbox(
        "Race",
        available_races
    )

    selected_session = st.selectbox(
        "Session",
        ["R", "Q", "FP1", "FP2", "FP3"],
        index=0
    )

    load_fastf1_button = st.button("📡 Load FastF1 Data", use_container_width=True)


tab1, tab2, tab3, tab4 = st.tabs(
    [
        "Prediction Center",
        "Race Predictor",
        "FastF1 Intelligence",
        "Project Overview"
    ]
)


with tab1:
    st.markdown('<div class="section-title">Prediction Center</div>', unsafe_allow_html=True)

    col1, col2 = st.columns([1.1, 1.9])

    with col1:
        team_color = get_team_color(driver_data["name_x"])

        st.markdown(
            f"""
            <div class="driver-card" style="
                background:
                    linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.84)),
                    radial-gradient(circle at top right, {team_color}55, transparent 42%);
                border: 1px solid {team_color}88;
                box-shadow: 0 20px 55px {team_color}33;
            ">
                <div class="eyebrow">Selected Driver</div>
                <div style="font-size: 34px; font-weight: 950; color: white; line-height: 1;">
                    {selected_driver}
                </div>
                <div style="color: #cbd5e1; margin-top: 10px; font-size: 16px;">
                    {driver_data["name_x"]}
                </div>
                <div style="
                    margin-top: 18px;
                    display: inline-block;
                    padding: 8px 14px;
                    border-radius: 999px;
                    background: {team_color}22;
                    border: 1px solid {team_color}88;
                    color: white;
                    font-size: 13px;
                    font-weight: 800;
                ">
                    Team Identity Active
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

        st.subheader("Driver Snapshot")

        c1, c2 = st.columns(2)

        with c1:
            st.metric("Latest Race", driver_data["name_y"])
            st.metric("Grid", grid)

        with c2:
            st.metric("Season", int(driver_data["year"]))
            st.metric("Experience", experience)

        st.subheader("Feature Snapshot")

        f1, f2 = st.columns(2)

        with f1:
            st.metric("Driver Form", f"{driver_form:.2f}")

        with f2:
            st.metric("Constructor Form", f"{constructor_form:.2f}")

    with col2:
        st.subheader("Recent Performance Trend")

        history = driver_rows.tail(10)[["grid", "positionOrder"]].copy()
        history.index = range(1, len(history) + 1)

        st.line_chart(history)
        st.caption("Lower values are better. Position 1 means first place.")

        st.markdown(
            """
            <div class="model-note">
                Logistic Regression is optimized for detecting as many podiums as possible.
                MLP is more conservative and usually gives safer but fewer podium predictions.
            </div>
            """,
            unsafe_allow_html=True
        )

    if predict_button:
        results = {}

        logistic_sample = build_sample(
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

        results["logistic"] = predict_probability(
            logistic_sample,
            artifacts["logistic_model"],
            artifacts["logistic_scaler"]
        )

        if artifacts["mlp_available"]:
            mlp_sample = build_sample(
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

            results["mlp"] = predict_probability(
                mlp_sample,
                artifacts["mlp_model"],
                artifacts["mlp_scaler"]
            )

        st.session_state["prediction_results"] = results

    if "prediction_results" in st.session_state:
        results = st.session_state["prediction_results"]

        st.markdown('<div class="section-title">Prediction Results</div>', unsafe_allow_html=True)

        if model_mode == "Compare both models":
            c1, c2 = st.columns(2)

            with c1:
                render_prediction_card(
                    "Logistic Regression",
                    results["logistic"],
                    "Aggressive model: high recall"
                )

            with c2:
                if "mlp" in results:
                    render_prediction_card(
                        "MLP Neural Network",
                        results["mlp"],
                        "Conservative model: higher precision"
                    )
                else:
                    st.info("MLP model is not available.")

        elif model_mode == "Logistic Regression only":
            render_prediction_card(
                "Logistic Regression",
                results["logistic"],
                "Aggressive model: high recall"
            )

        elif model_mode == "MLP only":
            if "mlp" in results:
                render_prediction_card(
                    "MLP Neural Network",
                    results["mlp"],
                    "Conservative model: higher precision"
                )

        st.markdown(
            """
            <div class="premium-card">
                <div class="card-title">Interpretation</div>
                <p>
                    The probability is based on historical race data and engineered features.
                    It should be interpreted as a model estimate, not a guaranteed result.
                </p>
            </div>
            """,
            unsafe_allow_html=True
        )
    else:
        st.info("Run a prediction from the sidebar to see model output.")


with tab2:
    st.markdown('<div class="section-title">Race Predictor</div>', unsafe_allow_html=True)

    st.markdown(
        f"""
        <div class="race-hero">
            <div class="eyebrow">Real Race Prediction</div>
            <div class="race-title">{selected_race}</div>
            <div class="race-subtitle">
                Season {selected_year} · Session {selected_session} · Generate podium probabilities for real race drivers.
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    if st.button("🏁 Generate Race Prediction Leaderboard"):
        try:
            with st.spinner("Loading real race data and generating predictions..."):
                real_race_df = get_real_race_prediction_data(
                    selected_year,
                    selected_race
                )

                leaderboard_rows = []

                drivers = df["driver_full_name"]

                for _, row in real_race_df.iterrows():
                    fastf1_full_name = row["full_name"]

                    matching_rows = df[drivers == fastf1_full_name]

                    if matching_rows.empty:
                        continue

                    selected_driver_data = matching_rows.sort_values(
                        ["year", "raceId"]
                    ).iloc[-1]

                    grid_value = int(row["grid"]) if pd.notna(row["grid"]) else int(selected_driver_data["grid"])
                    quali_value = int(row["qualifying_position"]) if pd.notna(row["qualifying_position"]) else int(selected_driver_data["position_y"])

                    logistic_sample = build_sample(
                        df=df,
                        driver_data=selected_driver_data,
                        grid=grid_value,
                        driver_form=float(selected_driver_data["driver_form"]),
                        constructor_form=float(selected_driver_data["constructor_form"]),
                        experience=int(selected_driver_data["experience"]),
                        encoders={
                            "forename": artifacts["le_forename"],
                            "surname": artifacts["le_surname"],
                            "team": artifacts["le_team"],
                            "race": artifacts["le_race"]
                        }
                    )

                    logistic_sample["position_y"] = quali_value

                    logistic_probability = predict_probability(
                        logistic_sample,
                        artifacts["logistic_model"],
                        artifacts["logistic_scaler"]
                    )

                    mlp_probability = None

                    if artifacts["mlp_available"]:
                        mlp_sample = build_sample(
                            df=df,
                            driver_data=selected_driver_data,
                            grid=grid_value,
                            driver_form=float(selected_driver_data["driver_form"]),
                            constructor_form=float(selected_driver_data["constructor_form"]),
                            experience=int(selected_driver_data["experience"]),
                            encoders={
                                "forename": artifacts["mlp_le_forename"],
                                "surname": artifacts["mlp_le_surname"],
                                "team": artifacts["mlp_le_team"],
                                "race": artifacts["mlp_le_race"]
                            }
                        )

                        mlp_sample["position_y"] = quali_value

                        mlp_probability = predict_probability(
                            mlp_sample,
                            artifacts["mlp_model"],
                            artifacts["mlp_scaler"]
                        )

                    leaderboard_rows.append({
                        "driver": row["driver"],
                        "full_name": row["full_name"],
                        "team": row["team"],
                        "grid": grid_value,
                        "qualifying_position": quali_value,
                        "finish_position": row["finish_position"],
                        "logistic_probability": logistic_probability,
                        "mlp_probability": mlp_probability
                    })

                leaderboard = pd.DataFrame(leaderboard_rows)

                if leaderboard.empty:
                    st.warning("No matching drivers were found between FastF1 and the historical dataset.")
                else:
                    if "mlp_probability" in leaderboard.columns and leaderboard["mlp_probability"].notna().any():
                        leaderboard["average_probability"] = (
                            leaderboard["logistic_probability"] + leaderboard["mlp_probability"]
                        ) / 2
                    else:
                        leaderboard["average_probability"] = leaderboard["logistic_probability"]

                    leaderboard = leaderboard.sort_values(
                        "average_probability",
                        ascending=False
                    )

                    st.session_state["leaderboard"] = leaderboard

        except Exception as e:
            st.error("Could not generate real race leaderboard.")
            st.write(e)

    if "leaderboard" in st.session_state:
        leaderboard = st.session_state["leaderboard"]

        st.markdown('<div class="section-title">Single Driver Scenario Prediction</div>', unsafe_allow_html=True)

        selected_real_driver = st.selectbox(
            "Select driver from this race",
            leaderboard["full_name"].tolist()
        )

        selected_driver_row = leaderboard[
            leaderboard["full_name"] == selected_real_driver
        ].iloc[0]

        scenario_mode = st.selectbox(
            "Race scenario",
            [
                "Use real race data",
                "Pole position scenario",
                "Front row scenario",
                "Midfield scenario",
                "Back of the grid scenario",
                "Custom scenario"
            ]
        )

        real_grid = int(selected_driver_row["grid"])
        real_qualifying = int(selected_driver_row["qualifying_position"])

        scenario_grid = real_grid
        scenario_qualifying = real_qualifying

        if scenario_mode == "Pole position scenario":
            scenario_grid = 1
            scenario_qualifying = 1

        elif scenario_mode == "Front row scenario":
            scenario_grid = 2
            scenario_qualifying = 2

        elif scenario_mode == "Midfield scenario":
            scenario_grid = 10
            scenario_qualifying = 10

        elif scenario_mode == "Back of the grid scenario":
            scenario_grid = 18
            scenario_qualifying = 18

        elif scenario_mode == "Custom scenario":
            c1, c2 = st.columns(2)

            with c1:
                scenario_grid = st.slider(
                    "Custom Grid Position",
                    1,
                    20,
                    real_grid,
                    help="Starting position in the race. Lower is better."
                )

            with c2:
                scenario_qualifying = st.slider(
                    "Custom Qualifying Position",
                    1,
                    20,
                    real_qualifying,
                    help="Qualifying result used by the model. Lower is better."
                )

        matching_rows = df[df["driver_full_name"] == selected_driver_row["full_name"]]

        if matching_rows.empty:
            st.warning("Selected driver could not be matched with the historical dataset.")
        else:
            scenario_driver_data = matching_rows.sort_values(["year", "raceId"]).iloc[-1]

            logistic_sample = build_sample(
                df=df,
                driver_data=scenario_driver_data,
                grid=scenario_grid,
                driver_form=float(scenario_driver_data["driver_form"]),
                constructor_form=float(scenario_driver_data["constructor_form"]),
                experience=int(scenario_driver_data["experience"]),
                encoders={
                    "forename": artifacts["le_forename"],
                    "surname": artifacts["le_surname"],
                    "team": artifacts["le_team"],
                    "race": artifacts["le_race"]
                }
            )

            logistic_sample["position_y"] = scenario_qualifying

            scenario_logistic_probability = predict_probability(
                logistic_sample,
                artifacts["logistic_model"],
                artifacts["logistic_scaler"]
            )

            scenario_mlp_probability = None

            if artifacts["mlp_available"]:
                mlp_sample = build_sample(
                    df=df,
                    driver_data=scenario_driver_data,
                    grid=scenario_grid,
                    driver_form=float(scenario_driver_data["driver_form"]),
                    constructor_form=float(scenario_driver_data["constructor_form"]),
                    experience=int(scenario_driver_data["experience"]),
                    encoders={
                        "forename": artifacts["mlp_le_forename"],
                        "surname": artifacts["mlp_le_surname"],
                        "team": artifacts["mlp_le_team"],
                        "race": artifacts["mlp_le_race"]
                    }
                )

                mlp_sample["position_y"] = scenario_qualifying

                scenario_mlp_probability = predict_probability(
                    mlp_sample,
                    artifacts["mlp_model"],
                    artifacts["mlp_scaler"]
                )

            if scenario_mlp_probability is not None:
                single_probability = (
                    scenario_logistic_probability + scenario_mlp_probability
                ) / 2
            else:
                single_probability = scenario_logistic_probability

            single_team_color = get_team_color(selected_driver_row["team"])
            single_label, _ = get_probability_label(single_probability)

            st.markdown(
                f"""
                <div class="prediction-card" style="
                    background: linear-gradient(135deg, {single_team_color}, #111827);
                    border: 1px solid {single_team_color}99;
                    box-shadow: 0 24px 60px {single_team_color}44;
                ">
                    <div class="prediction-title">{selected_driver_row['full_name']}</div>
                    <div class="prediction-value">{single_probability:.2%}</div>
                    <div class="prediction-label">{single_label}</div>
                    <div class="card-muted" style="margin-top: 10px;">
                        Scenario: {scenario_mode} · Grid: {scenario_grid} · Qualifying: {scenario_qualifying}
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )

            scenario_col1, scenario_col2, scenario_col3, scenario_col4 = st.columns(4)

            with scenario_col1:
                st.metric("Real Grid", real_grid)

            with scenario_col2:
                st.metric("Scenario Grid", scenario_grid)

            with scenario_col3:
                st.metric("Real Qualifying", real_qualifying)

            with scenario_col4:
                st.metric("Scenario Qualifying", scenario_qualifying)

            if single_probability >= 0.5:
                st.success("This driver is predicted as a podium candidate in this scenario.")
            else:
                st.warning("This driver is not predicted as a strong podium candidate in this scenario.")

        top3 = leaderboard.head(3)
        actual_top3 = leaderboard.sort_values("finish_position").head(3)

        render_prediction_summary(top3, actual_top3)

        st.markdown('<div class="section-title">Predicted Podium</div>', unsafe_allow_html=True)

        p1, p2, p3 = st.columns(3)

        podium_cards = [p1, p2, p3]
        podium_labels = ["P1", "P2", "P3"]

        for card, (_, row), label in zip(podium_cards, top3.iterrows(), podium_labels):
            team_color = get_team_color(row["team"])

            with card:
                st.markdown(
                    f"""
                    <div class="podium-card" style="
                        background: linear-gradient(135deg, {team_color}, #111827);
                        border: 1px solid {team_color}99;
                        box-shadow: 0 22px 60px {team_color}44;
                    ">
                        <div class="podium-position">{label}</div>
                        <div class="podium-driver">{row['driver']}</div>
                        <div class="podium-team">{row['team']}</div>
                        <div class="podium-prob">{row['average_probability']:.2%}</div>
                        <div class="card-muted" style="margin-top: 8px;">Podium probability</div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

        st.markdown('<div class="section-title">Actual Podium</div>', unsafe_allow_html=True)

        a1, a2, a3 = st.columns(3)

        actual_cards = [a1, a2, a3]
        actual_labels = ["P1", "P2", "P3"]

        for card, (_, row), label in zip(actual_cards, actual_top3.iterrows(), actual_labels):
            team_color = get_team_color(row["team"])

            with card:
                st.markdown(
                    f"""
                    <div class="podium-card" style="
                        background: linear-gradient(135deg, {team_color}, #111827);
                        border: 1px solid {team_color}99;
                        box-shadow: 0 22px 60px {team_color}44;
                    ">
                        <div class="podium-position">{label}</div>
                        <div class="podium-driver">{row['driver']}</div>
                        <div class="podium-team">{row['team']}</div>
                        <div class="podium-prob">Finished P{int(row['finish_position'])}</div>
                        <div class="card-muted" style="margin-top: 8px;">Actual race result</div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

        display_df = leaderboard.copy()

        display_df["logistic_probability"] = display_df["logistic_probability"].apply(
            lambda x: f"{x:.2%}"
        )

        if "mlp_probability" in display_df.columns:
            display_df["mlp_probability"] = display_df["mlp_probability"].apply(
                lambda x: f"{x:.2%}" if pd.notna(x) else "N/A"
            )

        display_df["average_probability"] = display_df["average_probability"].apply(
            lambda x: f"{x:.2%}"
        )

        render_premium_leaderboard(leaderboard)

        with st.expander("View raw prediction table"):
            st.dataframe(display_df, use_container_width=True)


with tab3:
    st.markdown('<div class="section-title">FastF1 Intelligence</div>', unsafe_allow_html=True)

    st.markdown(
        """
        <div class="premium-card">
            FastF1 provides real Formula 1 session data, including results, qualifying,
            lap times, tyre strategy, weather and telemetry.
        </div>
        """,
        unsafe_allow_html=True
    )

    if load_fastf1_button:
        try:
            with st.spinner("Loading FastF1 data. First load may take a while..."):
                race_results = get_race_results(selected_year, selected_race)
                qualifying = get_qualifying_results(selected_year, selected_race)
                lap_times = get_lap_times(selected_year, selected_race, selected_session)
                tyre_strategy = get_tyre_strategy(selected_year, selected_race)
                weather = get_weather_data(selected_year, selected_race, selected_session)
                available_drivers = get_available_drivers(selected_year, selected_race, selected_session)

                st.session_state["fastf1_loaded"] = True
                st.session_state["race_results"] = race_results
                st.session_state["qualifying"] = qualifying
                st.session_state["lap_times"] = lap_times
                st.session_state["tyre_strategy"] = tyre_strategy
                st.session_state["weather"] = weather
                st.session_state["available_drivers"] = available_drivers
                st.session_state["fastf1_year"] = selected_year
                st.session_state["fastf1_race"] = selected_race
                st.session_state["fastf1_session"] = selected_session

        except Exception as e:
            st.error("Could not load FastF1 data. Check season, race name or session.")
            st.write(e)

    if st.session_state.get("fastf1_loaded"):
        race_results = st.session_state["race_results"]
        qualifying = st.session_state["qualifying"]
        lap_times = st.session_state["lap_times"]
        tyre_strategy = st.session_state["tyre_strategy"]
        weather = st.session_state["weather"]
        available_drivers = st.session_state["available_drivers"]

        st.subheader(
            f"{st.session_state['fastf1_year']} - {st.session_state['fastf1_race']} - {st.session_state['fastf1_session']}"
        )

        s1, s2, s3, s4 = st.columns(4)

        with s1:
            if not race_results.empty:
                st.metric("Winner", race_results.iloc[0]["driver"])
            else:
                st.metric("Winner", "N/A")

        with s2:
            if not race_results.empty:
                st.metric("Top Team", race_results.iloc[0]["team"])
            else:
                st.metric("Top Team", "N/A")

        with s3:
            if not lap_times.empty:
                st.metric("Max Lap", int(lap_times["LapNumber"].max()))
            else:
                st.metric("Max Lap", "N/A")

        with s4:
            if not weather.empty and "TrackTemp" in weather.columns:
                st.metric("Avg Track Temp", f"{weather['TrackTemp'].mean():.1f}°C")
            else:
                st.metric("Avg Track Temp", "N/A")

        ftab1, ftab2, ftab3, ftab4, ftab5, ftab6 = st.tabs(
            [
                "Results",
                "Qualifying",
                "Lap Times",
                "Tyres",
                "Weather",
                "Telemetry"
            ]
        )

        with ftab1:
            st.subheader("Race Results")
            st.dataframe(race_results, use_container_width=True)

        with ftab2:
            st.subheader("Qualifying Results")
            st.dataframe(qualifying, use_container_width=True)

        with ftab3:
            st.subheader("Lap Time Analysis")

            if not lap_times.empty:
                drivers_for_chart = sorted(lap_times["Driver"].dropna().unique())

                selected_lap_drivers = st.multiselect(
                    "Drivers",
                    drivers_for_chart,
                    default=drivers_for_chart[:3]
                )

                filtered_laps = lap_times[lap_times["Driver"].isin(selected_lap_drivers)]

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

        with ftab4:
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

        with ftab5:
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

        with ftab6:
            st.subheader("Driver Telemetry")

            if available_drivers:
                telemetry_driver = st.selectbox(
                    "Telemetry driver",
                    available_drivers
                )

                if st.button("Load Telemetry"):
                    try:
                        telemetry_df = get_driver_telemetry(
                            st.session_state["fastf1_year"],
                            st.session_state["fastf1_race"],
                            telemetry_driver,
                            st.session_state["fastf1_session"]
                        )

                        if not telemetry_df.empty:
                            st.dataframe(telemetry_df, use_container_width=True)

                            telemetry_chart = telemetry_df.set_index("Distance")[
                                ["Speed", "Throttle", "Brake"]
                            ]

                            st.line_chart(telemetry_chart)
                        else:
                            st.info("No telemetry data available.")
                    except Exception as e:
                        st.error("Could not load telemetry.")
                        st.write(e)
            else:
                st.info("No telemetry drivers available.")


with tab4:
    st.markdown('<div class="section-title">Project Overview</div>', unsafe_allow_html=True)

    c1, c2 = st.columns(2)

    with c1:
        st.markdown(
            """
            <div class="premium-card">
                <div class="card-title">Application Purpose</div>
                <p>
                    This project predicts Formula 1 podium probability using historical data,
                    feature engineering and machine learning models.
                </p>
                <p>
                    It also integrates real Formula 1 session data through FastF1 for deeper race analysis.
                </p>
            </div>
            """,
            unsafe_allow_html=True
        )

    with c2:
        st.markdown(
            """
            <div class="premium-card">
                <div class="card-title">Technology Stack</div>
                <p>Python, Pandas, Scikit-learn, SQLite, FastF1, Streamlit</p>
                <p>Models: Logistic Regression and MLP Neural Network</p>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown(
        """
        <div class="premium-card">
            <div class="card-title">Model Strategy</div>
            <p>
                Logistic Regression is used as a high-recall baseline, while the MLP Neural Network
                provides a more conservative prediction style. Showing both models gives a more honest
                and realistic view of model behavior.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )