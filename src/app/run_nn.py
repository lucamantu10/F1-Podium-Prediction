from src.data_collection.load_raw_data import load_data
from src.feature_engineering.build_features import build_features
from src.modeling.train_neural_network import train_neural_network


def main():
    data = load_data()
    df = build_features(data)

    train_neural_network(df)


if __name__ == "__main__":
    main()