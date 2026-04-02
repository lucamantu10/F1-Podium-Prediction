import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report
from tensorflow.nn import relu


def train_neural_network(df):
    df_model = df.copy()

    le = LabelEncoder()

    df_model["forename"] = le.fit_transform(df_model["forename"])
    df_model["surname"] = le.fit_transform(df_model["surname"])
    df_model["name_x"] = le.fit_transform(df_model["name_x"])
    df_model["name_y"] = le.fit_transform(df_model["name_y"])

    X = df_model.drop(["podium", "positionOrder", "points"], axis=1)
    y = df_model["podium"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()

    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid")
    ])

    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

    model.fit(X_train, y_train, epochs=20, batch_size=32, validation_split=0.2)

    loss, accuracy = model.evaluate(X_test, y_test)

    print("\n Neural Network Training Results: ", accuracy)

    y_pred = model.predict(X_test)
    y_pred = (y_pred > 0.5).astype(int).ravel()


    print("\n Neural Network Classification Report:")
    print(classification_report(y_test, y_pred))
