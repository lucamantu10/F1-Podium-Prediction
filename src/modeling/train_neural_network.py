from pathlib import Path
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_PATH = BASE_DIR / "models"
MODELS_PATH.mkdir(parents=True, exist_ok=True)


def train_neural_network(df):
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
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    model = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        solver="adam",
        alpha=0.001,
        learning_rate_init=0.001,
        max_iter=700,
        early_stopping=True,
        validation_fraction=0.2,
        n_iter_no_change=30,
        random_state=42
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    print("\n--- Neural Network MLP ---")
    print("\nNN Accuracy:", accuracy_score(y_test, y_pred))

    print("\nNN Classification Report:")
    print(classification_report(y_test, y_pred))

    cm = confusion_matrix(y_test, y_pred)

    print("\nNN Confusion Matrix:")
    print(cm)

    joblib.dump(model, MODELS_PATH / "mlp_neural_network_model.pkl")
    joblib.dump(scaler, MODELS_PATH / "mlp_neural_network_scaler.pkl")

    joblib.dump(le_forename, MODELS_PATH / "mlp_le_forename.pkl")
    joblib.dump(le_surname, MODELS_PATH / "mlp_le_surname.pkl")
    joblib.dump(le_team, MODELS_PATH / "mlp_le_team.pkl")
    joblib.dump(le_race, MODELS_PATH / "mlp_le_race.pkl")

    print("\nMLP Neural Network model, scaler and encoders saved successfully.")