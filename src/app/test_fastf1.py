from src.data_collection.fastf1_data import get_latest_race_results

df = get_latest_race_results()

print(df.head())