# F1 Podium Predictor

A production-style Formula 1 machine learning dashboard that predicts podium probability using historical race data, engineered performance features, FastF1 real race data, SQLite, and an interactive Streamlit interface.

The goal of this project is to go beyond a simple machine learning script and build an end-to-end data product that combines data processing, model training, race analytics, prediction simulation, and visual dashboard design.

---

## Overview

F1 Podium Predictor estimates whether a Formula 1 driver is likely to finish on the podium.

The application uses historical Formula 1 race data to train machine learning models and combines it with FastF1 data to analyze real race sessions. The dashboard allows users to select drivers, simulate race scenarios, compare model outputs, and generate podium prediction leaderboards for real races.

---

## Main Features

- Historical Formula 1 data processing
- Feature engineering for driver and constructor performance
- Logistic Regression model
- MLP Neural Network model
- Model comparison inside the dashboard
- SQLite database integration
- FastF1 real race data integration
- Race results, qualifying data, lap times, tyre strategy, weather data, and telemetry
- Real race podium prediction leaderboard
- Single-driver race scenario simulation
- Predicted podium vs actual podium comparison
- Premium Streamlit dashboard UI

---

## Tech Stack

- Python
- Pandas
- Scikit-learn
- SQLite
- FastF1
- Streamlit
- Joblib
- Matplotlib

---

## Project Structure

```text
F1-Podium-Prediction/
│
├── data/
│   ├── raw/
│   ├── processed/
│   └── database/
│
├── models/
│
├── src/
│   ├── app/
│   │   ├── main.py
│   │   ├── predict.py
│   │   └── streamlit_app.py
│   │
│   ├── data/
│   │   └── database.py
│   │
│   ├── data_collection/
│   │   ├── load_raw_data.py
│   │   └── fastf1_data.py
│   │
│   ├── feature_engineering/
│   │   └── build_features.py
│   │
│   └── modeling/
│       ├── train_model.py
│       └── train_neural_network.py
│
├── requirements.txt
├── README.md
└── .gitignore
