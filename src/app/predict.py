from pathlib import Path
import joblib
import pandas as pd
import numpy as np

# path proiect
BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_PATH = BASE_DIR / "models"

# load model + scaler
model = joblib.load(MODELS_PATH / "logistic_regression_model.pkl")
scaler = joblib.load(MODELS_PATH / "logistic_regression_scaler.pkl")


def predict_podium(features):
    features = np.array(features).reshape(1, -1)
    features_scaled = scaler.transform(features)
    prediction = model.predict(features_scaled)
    return int(prediction[0])


if __name__ == "__main__":
    data_path = BASE_DIR / "data" / "processed" / "final_dataset.csv"

    df = pd.read_csv(data_path)

    X = df.drop(["podium", "positionOrder", "points"], axis=1)

    # refacem encoding EXACT ca la training
    from sklearn.preprocessing import LabelEncoder

    le = LabelEncoder()

    X["forename"] = le.fit_transform(X["forename"])
    X["surname"] = le.fit_transform(X["surname"])
    X["name_x"] = le.fit_transform(X["name_x"])
    X["name_y"] = le.fit_transform(X["name_y"])

    sample = X.iloc[0]

    result = predict_podium(sample.values)

    print("\nPrediction:", result)