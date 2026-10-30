"""Command line entry point: ``f1podium train`` / ``f1podium predict``."""

import argparse

from f1podium.config import ARTIFACTS_DIR


def _train(_args) -> None:
    from f1podium.train import run

    metrics = run()
    print()
    print(f"{'model':<34}{'log loss':>10}{'ROC-AUC':>10}{'podium hits':>13}{'top pick':>10}")
    for name, m in metrics["models"].items():
        o = m["overall"]
        marker = " *" if name == metrics["selected_model"] else ""
        print(
            f"{m['label'] + marker:<34}{o['log_loss']:>10.4f}{o['roc_auc']:>10.3f}"
            f"{o['podium_hit_rate']:>13.1%}{o['top_pick_podium_rate']:>10.1%}"
        )
    b = metrics["baseline"]["overall"]
    print(
        f"{metrics['baseline']['label']:<34}{'':>10}{'':>10}"
        f"{b['podium_hit_rate']:>13.1%}{b['top_pick_podium_rate']:>10.1%}"
    )


def _predict(args) -> None:
    from f1podium.predict import Predictor

    board = Predictor.load(ARTIFACTS_DIR, model=args.model).predict_race(args.season, args.round)
    cols = ["driver_code", "team_name", "grid", "probability", "finish_position"]
    print(board[cols].to_string(index=False, formatters={"probability": "{:.1%}".format}))


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(prog="f1podium", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("train", help="Backtest all models and write artifacts.").set_defaults(
        func=_train
    )

    p = sub.add_parser("predict", help="Podium probabilities for one race.")
    p.add_argument("season", type=int)
    p.add_argument("round", type=int)
    p.add_argument("--model", default=None, help="Defaults to the selected model.")
    p.set_defaults(func=_predict)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
