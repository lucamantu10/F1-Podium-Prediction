from src.data_collection.load_raw_data import load_data
from src.feature_engineering.build_features import build_features
from src.modeling.train_model import train_model
from src.modeling.train_neural_network import train_neural_network
from src.data.database import save_to_db


def main():
    data = load_data()
    df = build_features(data)

    train_model(df)
    train_neural_network(df)

    save_to_db(df)

    print("\nTraining pipeline completed successfully.")


if __name__ == "__main__":
    main()