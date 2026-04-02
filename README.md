# F1 Podium Prediction

A machine learning project that predicts whether a Formula 1 driver will finish on the podium based on historical race data and engineered performance features.

## Overview

This project builds a predictive model using historical F1 data to estimate the probability of a driver finishing in the top 3 positions of a race.

Instead of relying only on raw data, the model uses engineered features that capture real racing dynamics, such as recent driver performance and team strength.

## Tech Stack

- Python  
- Pandas  
- Scikit-learn  
- NumPy  

## Dataset

The project uses historical Formula 1 data including:
- Race results  
- Driver information  
- Constructor (team) data  
- Qualifying results  

Data is merged and processed into a single dataset used for training.

## Feature Engineering

The model performance is significantly improved through custom features:

- **driver_form** – average finishing position over the last 5 races  
- **constructor_form** – team performance based on last 5 races  
- **experience** – number of races completed by a driver  
- **grid** – starting position  
- **qualifying position**

## Model

- Logistic Regression  
- Class balancing (`class_weight="balanced"`) to handle imbalanced dataset


## Results

- **Accuracy:** ~0.82  
- **Recall (Podium):** ~0.90  

The model prioritizes detecting podium finishes, making recall more important than accuracy.

## Project Structure

```
src/
│
├── data_collection/
│   └── load_raw_data.py
│
├── feature_engineering/
│   └── build_features.py
│
├── modeling/
│   └── train_model.py
│
├── app/
│   └── main.py
```

## How to Run

```bash
pip install -r requirements.txt
python src/app/main.py
```

## Key Learnings

- Importance of feature engineering  
- Handling imbalanced datasets  
- Avoiding data leakage  
- Building modular ML pipelines  
- Evaluating models beyond accuracy  

## Future Improvements

- Neural Network (MLP) implementation  
- Integration with FastF1  
- Streamlit dashboard  
- Hyperparameter tuning  
