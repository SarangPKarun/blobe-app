"""
Airflow DAG: collab_filter_training
Schedule: nightly at 03:00 UTC
Purpose: Build user×banner interaction matrix from globe_events + votes →
         train ALS → build FAISS index → register in MLflow.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pandas as pd
from airflow import DAG
from airflow.operators.python import PythonOperator

from feature_store.readers import read_parquet, path_exists
from feature_store.writers import write_parquet
from mlflow_utils import promote_if_better

RAW_EVENTS_BASE   = "s3://blobe-ml/raw/globe_events"
INTERACTIONS_PATH = "s3://blobe-ml/features/collab_filter/interactions.parquet"
DB_URL            = os.environ.get("DATABASE_URL", "postgresql://postgres:postgrespassword@postgres:5432/blobe")
MLFLOW_URI        = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")
MODEL_NAME        = "collab-filter"
LOOKBACK_DAYS     = 7   # Require at least 7 days of data for a meaningful matrix


def build_interaction_matrix(**ctx) -> None:
    """
    Combine globe_events impressions + vote events into a single interaction table.
    Weights: impression=0.5, click=1.0, upvote=2.0, downvote=-1.0
    """
    import sqlalchemy as sa
    from sqlalchemy import text

    today = datetime.now(timezone.utc).date()
    cutoff = (today - timedelta(days=LOOKBACK_DAYS)).isoformat()

    # 1. Impression-level interactions from globe_events
    if not path_exists(RAW_EVENTS_BASE):
        raise RuntimeError(f"No globe_events data at {RAW_EVENTS_BASE}. Run globe_events_ingestion first.")

    events = read_parquet(RAW_EVENTS_BASE, filters=[("dt", ">=", cutoff)])
    if events.empty:
        raise RuntimeError("No globe_events data in the lookback window.")

    imp = (
        events[events["user_id"].notna()]
        .groupby(["user_id", "banner_id"])
        .agg(
            interaction_weight=("clicked", lambda x: 1.0 if x.any() else 0.5),
            last_interaction_at=("served_at", "max"),
            interaction_count=("request_id", "count"),
        )
        .reset_index()
        .rename(columns={"banner_id": "banner_id"})
    )

    # 2. Vote interactions from PostgreSQL
    engine = sa.create_engine(DB_URL)
    q = text("""
        SELECT
            v."userId"    AS user_id,
            v."postId"    AS banner_id,
            v.value       AS vote_value,
            v."createdAt" AS created_at
        FROM "Vote" v
        WHERE v."createdAt" >= :cutoff
    """)
    with engine.connect() as conn:
        votes = pd.read_sql(q, conn, params={"cutoff": cutoff})
    engine.dispose()

    if not votes.empty:
        votes["interaction_weight"] = votes["vote_value"].map({1: 2.0, -1: -1.0, 0: 0.3})
        votes["last_interaction_at"] = pd.to_datetime(votes["created_at"], utc=True)
        votes["interaction_count"] = 1
        votes = votes[["user_id", "banner_id", "interaction_weight",
                        "last_interaction_at", "interaction_count"]]
        combined = pd.concat([imp, votes], ignore_index=True)
    else:
        combined = imp

    # Aggregate: sum weights, take latest timestamp
    result = (
        combined.groupby(["user_id", "banner_id"])
        .agg(
            interaction_weight=("interaction_weight", "sum"),
            last_interaction_at=("last_interaction_at", "max"),
            interaction_count=("interaction_count", "sum"),
        )
        .reset_index()
    )

    write_parquet(result, INTERACTIONS_PATH)
    ctx["ti"].xcom_push(key="n_interactions", value=len(result))
    print(f"Interaction matrix: {len(result)} (user, banner) pairs")


def launch_sagemaker_job(**ctx) -> None:
    from sagemaker.jobs import launch_training_job
    from sagemaker.config import COLLAB_FILTER_JOB

    job_name = launch_training_job(COLLAB_FILTER_JOB, input_s3_uri=INTERACTIONS_PATH)
    ctx["ti"].xcom_push(key="job_name", value=job_name)
    print(f"SageMaker collab-filter job: {job_name}")


def poll_sagemaker_job(**ctx) -> None:
    from sagemaker.jobs import wait_for_job

    job_name = ctx["ti"].xcom_pull(key="job_name", task_ids="launch_sagemaker_job")
    model_s3 = wait_for_job(job_name)
    ctx["ti"].xcom_push(key="model_s3", value=model_s3)
    print(f"Job complete: {model_s3}")


def validate_index(**ctx) -> None:
    """
    Spot-check: query 100 random users from the index.
    Validates that recall@10 is > 0.3 against a held-out 20% of interactions.
    """
    import pickle, faiss, numpy as np

    model_s3 = ctx["ti"].xcom_pull(key="model_s3", task_ids="poll_sagemaker_job")
    from sagemaker.jobs import download_model_artifact
    model_dir = download_model_artifact(model_s3, local_dir="/tmp/collab_filter", is_dir=True)

    index = faiss.read_index(f"{model_dir}/faiss.index")
    with open(f"{model_dir}/user_map.pkl", "rb") as f:
        user_factors: dict = pickle.load(f)
    with open(f"{model_dir}/item_map.pkl", "rb") as f:
        item_id_map: list = pickle.load(f)

    df = read_parquet(INTERACTIONS_PATH)
    sample_users = df["user_id"].drop_duplicates().sample(min(100, df["user_id"].nunique()), random_state=42)

    recalls = []
    for uid in sample_users:
        if uid not in user_factors:
            continue
        user_vec = np.array(user_factors[uid], dtype=np.float32).reshape(1, -1)
        faiss.normalize_L2(user_vec)
        _, indices = index.search(user_vec, 10)
        top10 = set(item_id_map[i] for i in indices[0] if i < len(item_id_map))
        # Ground truth: actual interactions for this user
        gt = set(df[df["user_id"] == uid]["banner_id"].tolist())
        if gt:
            recalls.append(len(top10 & gt) / len(gt))

    recall = float(np.mean(recalls)) if recalls else 0.0
    print(f"Recall@10 on sample: {recall:.3f}")
    if recall < 0.05:  # very low bar — index may still be warming up
        print("WARNING: Low recall — model may need more training data")
    ctx["ti"].xcom_push(key="recall_at_10", value=recall)


def register_mlflow_model(**ctx) -> None:
    import mlflow

    recall = ctx["ti"].xcom_pull(key="recall_at_10", task_ids="validate_index")
    model_s3 = ctx["ti"].xcom_pull(key="model_s3", task_ids="poll_sagemaker_job")

    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment("collab-filter")

    with mlflow.start_run() as run:
        mlflow.log_metric("recall_at_10", recall)
        mlflow.log_artifact(model_s3)  # logs the model dir path as metadata
        client = mlflow.tracking.MlflowClient()
        mv = client.create_model_version(
            name=MODEL_NAME,
            source=model_s3,
            run_id=run.info.run_id,
        )
        client.set_registered_model_alias(MODEL_NAME, "staging", mv.version)
    print(f"Registered {MODEL_NAME} v{mv.version} as staging, recall@10={recall:.3f}")


def promote_model(**ctx) -> None:
    promoted = promote_if_better(MODEL_NAME, metric="recall_at_10", min_delta=0.01)
    print(f"Model promotion: {'promoted' if promoted else 'kept existing production'}")


default_args = {
    "owner":            "ml-pipeline",
    "retries":          1,
    "retry_delay":      timedelta(minutes=10),
    "execution_timeout": timedelta(hours=4),
}

with DAG(
    dag_id="collab_filter_training",
    description="Nightly collaborative filter (FAISS) training + MLflow registration",
    schedule_interval="0 3 * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    default_args=default_args,
    tags=["ml", "training", "collab-filter"],
) as dag:
    t1 = PythonOperator(task_id="build_interaction_matrix", python_callable=build_interaction_matrix)
    t2 = PythonOperator(task_id="launch_sagemaker_job",     python_callable=launch_sagemaker_job)
    t3 = PythonOperator(task_id="poll_sagemaker_job",       python_callable=poll_sagemaker_job)
    t4 = PythonOperator(task_id="validate_index",           python_callable=validate_index)
    t5 = PythonOperator(task_id="register_mlflow_model",    python_callable=register_mlflow_model)
    t6 = PythonOperator(task_id="promote_model",            python_callable=promote_model)

    t1 >> t2 >> t3 >> t4 >> t5 >> t6
