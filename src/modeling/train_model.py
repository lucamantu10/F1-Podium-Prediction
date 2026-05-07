from pathlib import Path
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt


BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_PATH = BASE_DIR / "models"
MODELS_PATH.mkdir(exist_ok=True)


def train_model(df):

    df_model = df.copy()

    le_forename = LabelEncoder()
    le_surname = LabelEncoder()
    le_team = LabelEncoder()
    le_race = LabelEncoder()

    df_model["forename"] = le_forename.fit_transform(df_model["forename"])
    df_model["surname"] = le_surname.fit_transform(df_model["surname"])
    df_model["name_x"] = le_team.fit_transform(df_model["name_x"])
    df_model["name_y"] = le_race.fit_transform(df_model["name_y"])

    X = df_model.drop(["podium", "positionOrder", "points"], axis=1)
    y = df_model["podium"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    model = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        solver="lbfgs",
        C=0.5,
        random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    print("\nAccuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print("\nModel interpretation:")
    print("Accuracy shows overall correctness, but for this project the podium class is more important.")
    print("Precision tells how reliable podium predictions are.")
    print("Recall tells how many real podiums the model detects.")
    print("F1-score balances precision and recall.")

    cm = confusion_matrix(y_test, y_pred)

    print("\nConfusion Matrix:")
    print(cm)

    plt.imshow(cm)
    plt.show()

    joblib.dump(model, MODELS_PATH / "logistic_regression_model.pkl")
    joblib.dump(scaler, MODELS_PATH / "logistic_regression_scaler.pkl")

    joblib.dump(le_forename, MODELS_PATH / "le_forename.pkl")
    joblib.dump(le_surname, MODELS_PATH / "le_surname.pkl")
    joblib.dump(le_team, MODELS_PATH / "le_team.pkl")
    joblib.dump(le_race, MODELS_PATH / "le_race.pkl")