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
```

---

## Machine Learning Models

### Logistic Regression

The Logistic Regression model is used as a high-recall baseline.

It is more aggressive in detecting potential podium finishes, which means it can identify many real podium candidates but may also produce more false positives.

### MLP Neural Network

The MLP Neural Network is implemented with Scikit-learn's `MLPClassifier`.

It uses multiple hidden layers and is more conservative than Logistic Regression. It usually produces safer podium predictions, but it may miss more actual podium finishes.

Using both models gives a more realistic view of model behavior and allows comparison between a classic machine learning baseline and a neural network approach.

---

## Features Used by the Models

The models use a combination of race, driver, constructor, and performance-based features:

- race ID
- driver ID
- constructor ID
- starting grid position
- season/year
- driver identity
- constructor/team
- race name
- qualifying position
- driver form
- constructor form
- driver experience

The target variable is:

```text
podium = 1 if the driver finished in the top 3
podium = 0 otherwise
```

---

## Feature Engineering

The project builds additional features from the historical dataset.

### Driver Form

The driver's recent average finishing position based on previous races.

### Constructor Form

The constructor's recent average finishing position based on previous races.

### Experience

The number of previous race entries for a driver in the dataset.

These features help the model capture recent performance and driver experience instead of relying only on static race information.

---

## FastF1 Integration

The application integrates FastF1 to retrieve real Formula 1 session data.

FastF1 data used in the dashboard includes:

- race results
- qualifying results
- lap times
- sector times
- tyre compounds
- tyre life
- weather data
- driver telemetry

This allows the project to work not only as a static historical model, but also as a race intelligence dashboard.

---

## Streamlit Dashboard

The Streamlit application contains four main sections:

### Prediction Center

Allows the user to select a driver and run podium predictions using either Logistic Regression, MLP Neural Network, or both models.

It also includes race scenario presets such as:

- default historical profile
- strong qualifying
- midfield start
- bad qualifying / comeback
- custom manual inputs

### Race Predictor

Uses FastF1 race data and the trained models to generate a podium probability leaderboard for a selected real race.

It includes:

- single driver scenario prediction
- predicted podium
- actual podium
- prediction summary
- podium match score
- premium probability leaderboard

### FastF1 Intelligence

Provides real race analytics, including:

- race results
- qualifying results
- lap time analysis
- tyre strategy
- weather data
- telemetry

### Project Overview

Summarizes the purpose, technology stack, and modeling strategy of the project.

---

## How to Run the Project

### 1. Clone the repository

```bash
git clone https://github.com/lucamantu10/F1-Podium-Prediction.git
cd F1-Podium-Prediction
```

---

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it:

#### Windows

```bash
.venv\Scripts\activate
```

#### macOS / Linux

```bash
source .venv/bin/activate
```

---

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Run the training pipeline

```bash
python -m src.app.main
```

This will:

- load the raw data
- build the final dataset
- train the Logistic Regression model
- train the MLP Neural Network model
- save model artifacts locally
- save the processed dataset to SQLite

---

### 5. Run the Streamlit dashboard

```bash
streamlit run src/app/streamlit_app.py
```

---

## Generated Files

The following files and folders are generated locally and are not tracked in GitHub:

```text
models/
data/database/
data/processed/
cache/
```

These files can be recreated by running:

```bash
python -m src.app.main
```

FastF1 cache files are recreated automatically when FastF1 data is loaded.

---

## Requirements

The project uses a minimal `requirements.txt` to avoid dependency conflicts:

```text
pandas
numpy
scikit-learn
matplotlib
fastf1
streamlit
joblib
```

TensorFlow is not included in the final project dependencies.

The neural network model is implemented using Scikit-learn's `MLPClassifier` for better portability and stability.

---

## Current Limitations

This project predicts podium probability, not the exact final race classification.

The Race Predictor ranks drivers based on estimated podium probability. This means the predicted top 3 should be interpreted as the drivers most likely to finish on the podium, not guaranteed finishing positions.

Some limitations include:

- driver matching between FastF1 and historical data may not always be perfect
- model performance depends on the quality of historical features
- external race factors such as crashes, safety cars, penalties, strategy mistakes, and weather changes are difficult to predict
- telemetry is used for race analysis, not directly as a model feature yet

---

## Future Improvements

Potential improvements include:

- adding track-specific performance features
- adding weather-based model features
- improving driver/team matching between FastF1 and historical data
- adding feature importance or SHAP explainability
- adding local team logos and circuit visuals
- adding model calibration
- predicting full race finishing order with a separate ranking/regression model
- deploying the app online

---

## What I Learned

Through this project, I practiced:

- building a structured Python project
- working with historical sports data
- feature engineering for machine learning
- training and comparing multiple models
- saving and loading models with Joblib
- using SQLite as a local database
- integrating FastF1 real race data
- building an interactive Streamlit dashboard
- debugging dependency and environment issues
- improving a project from a basic script into a more complete data application

---

## Disclaimer

This project is built for educational and portfolio purposes.

Predictions are model-based estimates and should not be interpreted as guaranteed race outcomes.
