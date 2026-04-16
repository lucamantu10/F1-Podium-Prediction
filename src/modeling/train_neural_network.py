from pathlib import Path
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt


BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_PATH = BASE_DIR / "models"


def train_neural_network(df):
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

    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=3,
        restore_best_weights=True
    )

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(1, activation="sigmoid")
    ])

    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"]
    )

    history = model.fit(
        X_train,
        y_train,
        epochs=30,
        batch_size=32,
        validation_split=0.2,
        callbacks=[early_stopping]
    )

    loss, accuracy = model.evaluate(X_test, y_test)

    print("\nNeural Network Test Accuracy:", accuracy)

    y_pred = model.predict(X_test)
    y_pred = (y_pred > 0.5).astype(int).ravel()

    print("\nNeural Network Classification Report:")
    print(classification_report(y_test, y_pred))

    cm = confusion_matrix(y_test, y_pred)

    print("\nNeural Network Confusion Matrix:")
    print(cm)

    plt.figure(figsize=(6, 5))
    plt.imshow(cm, cmap="Blues")
    plt.title("Neural Network Confusion Matrix")
    plt.xticks([0, 1], ["No Podium", "Podium"])
    plt.yticks([0, 1], ["No Podium", "Podium"])
    plt.xlabel("Predicted")
    plt.ylabel("Actual")

    for i in range(2):
        for j in range(2):
            plt.text(j, i, cm[i][j], ha="center", va="center", color="red")

    plt.show()

    plt.figure(figsize=(8, 5))
    plt.plot(history.history["loss"], label="Training Loss")
    plt.plot(history.history["val_loss"], label="Validation Loss")
    plt.title("Neural Network Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.legend()
    plt.show()

    plt.figure(figsize=(8, 5))
    plt.plot(history.history["accuracy"], label="Training Accuracy")
    plt.plot(history.history["val_accuracy"], label="Validation Accuracy")
    plt.title("Neural Network Accuracy")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.legend()
    plt.show()

    MODELS_PATH.mkdir(exist_ok=True)
    model.save(MODELS_PATH / "neural_network_model.keras")

    print("\nNeural Network model saved successfully.")