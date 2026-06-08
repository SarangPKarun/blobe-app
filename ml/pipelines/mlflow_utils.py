"""Shared MLflow helpers used across all Airflow DAGs."""
from __future__ import annotations

import os

import mlflow
from mlflow.tracking import MlflowClient

TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")


def get_client() -> MlflowClient:
    mlflow.set_tracking_uri(TRACKING_URI)
    return MlflowClient()


def promote_if_better(
    model_name: str,
    metric: str,
    min_delta: float = 0.01,
    lower_is_better: bool = False,
) -> bool:
    """Promote the 'staging' alias to 'production' if it beats the current production model.

    For metrics where lower is better (e.g. val_mse), set lower_is_better=True.
    On first deployment (no production model yet), always promotes.

    Returns True if promotion occurred.
    """
    client = get_client()

    try:
        staging = client.get_model_version_by_alias(model_name, "staging")
    except mlflow.exceptions.MlflowException:
        print(f"No staging model for {model_name} — nothing to promote")
        return False

    try:
        prod = client.get_model_version_by_alias(model_name, "production")
    except mlflow.exceptions.MlflowException:
        # No production model yet — promote unconditionally
        client.set_registered_model_alias(model_name, "production", staging.version)
        print(f"First deployment of {model_name} v{staging.version} → production")
        return True

    staging_run = client.get_run(staging.run_id)
    prod_run    = client.get_run(prod.run_id)

    staging_val = staging_run.data.metrics.get(metric)
    prod_val    = prod_run.data.metrics.get(metric)

    if staging_val is None or prod_val is None:
        print(f"Missing metric '{metric}' on one of the runs — skipping promotion")
        return False

    if lower_is_better:
        should_promote = staging_val < prod_val - min_delta
    else:
        should_promote = staging_val > prod_val + min_delta

    if should_promote:
        client.set_registered_model_alias(model_name, "production", staging.version)
        print(
            f"Promoted {model_name} v{staging.version} to production "
            f"({metric}: {prod_val:.4f} → {staging_val:.4f})"
        )
        return True

    print(
        f"No promotion: {model_name} staging {metric}={staging_val:.4f} "
        f"did not beat production {prod_val:.4f} by ≥{min_delta}"
    )
    return False
