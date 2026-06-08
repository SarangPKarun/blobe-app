#!/usr/bin/env python
"""SageMaker entry-point: XGBoost banner rank model training."""
from __future__ import annotations

import argparse
import json
import os

import mlflow
import mlflow.xgboost
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_auc_score

from features import FEATURE_COLS, LABEL_COL


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--max-depth",      type=int,   default=6)
    p.add_argument("--n-estimators",   type=int,   default=300)
    p.add_argument("--learning-rate",  type=float, default=0.05)
    p.add_argument("--subsample",      type=float, default=0.8)
    p.add_argument("--mlflow-experiment", type=str, default="banner-rank")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    train_dir = os.environ.get("SM_CHANNEL_TRAIN", "/opt/ml/input/data/train")
    model_dir = os.environ.get("SM_MODEL_DIR",     "/opt/ml/model")
    os.makedirs(model_dir, exist_ok=True)

    # Load training data — accepts a single Parquet file or a directory of them
    if os.path.isdir(train_dir):
        import glob
        files = glob.glob(os.path.join(train_dir, "*.parquet"))
        df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    else:
        df = pd.read_parquet(train_dir)

    df = df.fillna(0)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # shuffle

    split = int(0.85 * len(df))
    X_train, X_val = df[FEATURE_COLS].iloc[:split], df[FEATURE_COLS].iloc[split:]
    y_train, y_val = df[LABEL_COL].iloc[:split],    df[LABEL_COL].iloc[split:]

    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
    mlflow.set_experiment(args.mlflow_experiment)

    with mlflow.start_run() as run:
        mlflow.log_params(vars(args))

        model = xgb.XGBClassifier(
            max_depth=args.max_depth,
            n_estimators=args.n_estimators,
            learning_rate=args.learning_rate,
            subsample=args.subsample,
            objective="binary:logistic",
            eval_metric="aucpr",
            tree_method="hist",
            early_stopping_rounds=20,
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=50,
        )

        val_preds = model.predict_proba(X_val)[:, 1]
        auc_pr  = average_precision_score(y_val, val_preds)
        auc_roc = roc_auc_score(y_val, val_preds)
        mlflow.log_metrics({"auc_pr": auc_pr, "auc_roc": auc_roc})
        print(f"Validation  AUC-PR={auc_pr:.4f}  AUC-ROC={auc_roc:.4f}")

        model_path = os.path.join(model_dir, "model.xgb")
        model.save_model(model_path)

        mlflow.xgboost.log_model(
            model,
            artifact_path="model",
            registered_model_name="banner-rank",
        )

        # Write metadata for the DAG's evaluate_model task
        with open(os.path.join(model_dir, "run_metadata.json"), "w") as f:
            json.dump({"run_id": run.info.run_id, "auc_pr": auc_pr, "auc_roc": auc_roc}, f)

    print(f"Model saved to {model_path}")


if __name__ == "__main__":
    main()
