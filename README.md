# F1 Podium Predictor

Podium, win and finishing-position probabilities for every Formula 1 race since 2014, from a
model that only knows what was known before the lights went out.

- **Leak-free by construction.** Every feature for a race is built from earlier races in
  calendar order, plus that race's grid and qualifying. A test scrambles a race's result and
  checks that none of its features move.
- **Honest evaluation.** Each season is predicted by a model trained only on the seasons before
  it, then scored against what happened. Those out-of-sample predictions are what the site
  shows for past races.
- **A race simulator, not just a classifier.** A Plackett-Luce ranking model gives every driver
  a strength and runs the race 10,000 times, so win, podium and position chances are consistent
  across the whole field.
- **Interactive what-ifs.** Drag a driver to another grid slot in the web app and the whole race
  is re-simulated.
- **Up to date.** New seasons come from the Jolpica API (the successor to Ergast), including a
  projected grid for the next race before qualifying.

## Results

Backtest over 270 races, 2014 to 2026, each season predicted without having seen it:

| Model | Podium places called | Top pick on podium | ROC-AUC | Log loss |
|---|---|---|---|---|
| **Race simulator (Plackett-Luce)**, used on the site | 68.6% | 81.9% | 0.943 | 0.2067 |
| Logistic regression | 68.6% | 82.6% | 0.943 | 0.2073 |
| Gradient boosting | 69.0% | 82.2% | 0.940 | 0.2149 |
| Neural network (MLP) | 68.8% | 78.1% | 0.938 | 0.2188 |
| First three on the grid | 69.1% | 81.1% | – | – |

The headline finding: starting position is so predictive in Formula 1 that "the first three on
the grid" calls about as many podium places as any model. The models' value is in calibrated
probabilities (when the simulator says 30%, about 30% of those drivers reach the podium), in
win and position chances, and in explaining each prediction. The "How it works" page in the app
shows the season-by-season comparison and the calibration curve.

## Architecture

```text
data/raw/        Ergast CSV dump up to 2024 (unchanged)
data/live/       Seasons from 2025 onwards, fetched from Jolpica in the same schema
src/f1podium/    Python package
  data.py          load and merge the dumps, build one row per driver per race
  features.py      pre-race features (form, track record, standings, qualifying gaps, ranks in the field)
  models.py        race simulator plus three classifiers behind one interface
  train.py         season-by-season backtest, model comparison, artifact export
  predict.py       race predictions and what-if grids
  jolpica.py       incremental data updates
  api/             FastAPI service
web/             Next.js app (starting grid, simulator, season calendar, model report)
tests/           pytest suite, including leakage and API tests
```

## Running it

Python 3.11+ and Node 20+.

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"

f1podium update                   # optional: fetch the latest races from Jolpica
f1podium train                    # backtest and write artifacts/ (about 30 seconds)
f1podium serve                    # API on http://127.0.0.1:8000, docs at /docs
```

In a second terminal:

```bash
cd web
npm install
npm run dev                       # http://localhost:3000
```

Other commands: `f1podium predict 2024 18` prints one race, `pytest` runs the tests.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/meta` | model info, seasons, latest and next race, headline metrics |
| `GET /api/seasons/{year}/races` | the calendar with winners, model picks and podium places called |
| `GET /api/races/{year}/{round}` | full prediction: podium, win and position chances, explanations, result comparison |
| `POST /api/races/{year}/{round}/scenario` | the same for an edited grid, e.g. `{"grid": {"844": 1}}` |
| `GET /api/model` | backtest metrics, calibration, feature importance |

## Limitations

- Crashes, safety cars, strategy, weather and mid-race penalties are not known before the
  start, which caps how accurate any pre-race model can be.
- Before qualifying, the next race's grid is projected from recent qualifying results.
- Big regulation changes (such as 2026) take a few races to show up in the form features.

## Earlier version

The first version of this project, a Streamlit dashboard with logistic regression and an MLP
trained on a random split, is still in `src/app/` for reference.

Predictions are model estimates for educational purposes, not betting advice.
