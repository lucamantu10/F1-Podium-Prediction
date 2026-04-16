from pathlib import Path
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt


BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_PATH = BASE_DIR / "models"


def train_model(df):
    df_model = df.copy()

    le = LabelEncoder()

    df_model["forename"] = le.fit_transform(df_model["forename"])
    df_model["surname"] = le.fit_transform(df_model["surname"])
    df_model["name_x"] = le.fit_transform(df_model["name_x"])
    df_model["name_y"] = le.fit_transform(df_model["name_y"])

    X = df_model.drop(["podium", "positionOrder", "points"], axis=1)
    y = df_model["podium"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    model = LogisticRegression(max_iter=2000, class_weight="balanced")
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    print("\nAccuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    cm = confusion_matrix(y_test, y_pred)

    print("\nConfusion Matrix:")
    print(cm)

    plt.imshow(cm, cmap="Blues")
    plt.title("Confusion Matrix")
    plt.xticks([0, 1], ["No Podium", "Podium"])
    plt.yticks([0, 1], ["No Podium", "Podium"])
    plt.xlabel("Predicted")
    plt.ylabel("Actual")

    for i in range(2):
        for j in range(2):
            plt.text(j, i, cm[i][j], ha="center", va="center", color="red")

    plt.show()

    MODELS_PATH.mkdir(exist_ok=True)

    joblib.dump(model, MODELS_PATH / "logistic_regression_model.pkl")
    joblib.dump(scaler, MODELS_PATH / "logistic_regression_scaler.pkl")

    print("\nLogistic Regression model and scaler saved successfully.")