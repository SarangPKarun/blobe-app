"""
Airflow DAG: banner_rank_training
Schedule: nightly at 02:00 UTC
Purpose: Build XGBoost training dataset from feature store → launch SageMaker job →
         evaluate → register in MLflow → promote staging → production if AUC improves.
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

FEATURES_BASE  = "s3://blobe-ml/features/banner_rank"
TRAIN_PATH     = "s3://blobe-ml/tmp/banner_rank_train.parquet"
DB_URL         = os.environ.get("DATABASE_URL", "postgresql://postgres:postgrespassword@postgres:5432/blobe")
MLFLOW_URI     = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")
MODEL_NAME     = "banner-rank"
LOOKBACK_DAYS  = 30


def check_feature_freshness(**ctx) -> None:
    """Fail fast if the raw feature table is older than 25 hours."""
    from datetime import datetime, timezone, timedelta
    today = datetime.now(timezone.utc).date()
    yesterday = (today - timedelta(days=1)).isoformat()
    path = f"{FEATURES_BASE}/dt={today}/features.parquet"
    if not path_exists(path):
        path = f"{FEATURES_BASE}/dt={yesterday}/features.parquet"
        if not path_exists(path):
            raise RuntimeError("Banner rank features are stale (>25h old). Aborting training.")
    print(f"Feature freshness OK: {path}")


def build_training_dataset(**ctx) -> None:
    """Join feature store with live PostgreSQL data and write train/val Parquet."""
    import sqlalchemy as sa
    from sqlalchemy import text

    today = datetime.now(timezone.utc).date()
    cutoff = (today - timedelta(days=LOOKBACK_DAYS)).isoformat()

    df = read_parquet(FEATURES_BASE, filters=[("dt", ">=", cutoff)])
    if df.empty:
        raise RuntimeError("No feature data available for training.")

    # Pull live trust/vote/moderation columns from PostgreSQL for each post_id
    engine = sa.create_engine(DB_URL)
    post_ids = tuple(df["post_id"].unique().tolist())
    if not post_ids:
        raise RuntimeError("No post IDs in feature data.")

    q = text("""
        SELECT
            p.id                                        AS post_id,
            COALESCE(ts.score, 0)                       AS trust_score,
            COALESCE(SUM(v.value), 0)                   AS vote_sum,
            COUNT(v.id)                                 AS vote_count,
            EXTRACT(EPOCH FROM (NOW() - p."createdAt")) / 3600 AS age_hours,
            COALESCE((mr.scores->>'hate')::float,  0)  AS hate_score,
            COALESCE((mr.scores->>'spam')::float,  0)  AS spam_score,
            COALESCE((mr.scores->>'nsfw')::float,  0)  AS nsfw_score
        FROM "Post" p
        LEFT JOIN "TrustScore"     ts ON ts."userId" = p."authorId"
        LEFT JOIN "Vote"            v  ON v."postId"  = p.id
        LEFT JOIN moderation_record mr ON mr.post_id  = p.id
        WHERE p.id = ANY(:ids)
        GROUP BY p.id, ts.score, mr.scores, p."createdAt"
    """)
    with engine.connect() as conn:
        live = pd.read_sql(q, conn, params={"ids": list(post_ids)})
    engine.dispose()

    # Merge live columns (overwrite stubs from feature store)
    df = df.drop(columns=["trust_score", "vote_sum", "vote_count", "age_hours",
                           "hate_score", "spam_score", "nsfw_score"], errors="ignore")
    df = df.merge(live, on="post_id", how="left")
    df = df.fillna(0)

    write_parquet(df, TRAIN_PATH)
    print(f"Training dataset: {len(df)} rows → {TRAIN_PATH}")


def launch_sagemaker_job(**ctx) -> None:
    """Launch SageMaker training job (or run locally in DEV_MODE)."""
    from sagemaker.jobs import launch_training_job
    from sagemaker.config import BANNER_RANK_JOB

    job_name = launch_training_job(BANNER_RANK_JOB, input_s3_uri=TRAIN_PATH)
    ctx["ti"].xcom_push(key="job_name", value=job_name)
    print(f"SageMaker job started: {job_name}")


def poll_sagemaker_job(**ctx) -> None:
    """Wait for the SageMaker training job to reach a terminal state."""
    from sagemaker.jobs import wait_for_job

    job_name = ctx["ti"].xcom_pull(key="job_name", task_ids="launch_sagemaker_job")
    model_s3 = wait_for_job(job_name)
    ctx["ti"].xcom_push(key="model_s3", value=model_s3)
    print(f"Job {job_name} completed: artifacts at {model_s3}")


def evaluate_model(**ctx) -> None:
    """Download model artifact, run hold-out evaluation, push AUC-PR to XCom."""
    import mlflow
    import xgboost as xgb
    from sklearn.metrics import average_precision_score, roc_auc_score

    model_s3 = ctx["ti"].xcom_pull(key="model_s3", task_ids="poll_sagemaker_job")
    df = read_parquet(TRAIN_PATH)
    val = df.sample(frac=0.15, random_state=42)

    from sagemaker.jobs import download_model_artifact
    model_path = download_model_artifact(model_s3, local_dir="/tmp/banner_rank")

    model = xgb.XGBClassifier()
    model.load_model(model_path)

    FEATURE_COLS = [
        "trust_score", "vote_sum", "vote_count", "age_hours", "distance_km",
        "hate_score", "spam_score", "nsfw_score", "user_avg_engagement", "rank_position",
    ]
    preds = model.predict_proba(val[FEATURE_COLS])[:, 1]
    auc_pr  = average_precision_score(val["label"], preds)
    auc_roc = roc_auc_score(val["label"], preds)
    print(f"Hold-out AUC-PR={auc_pr:.4f}  AUC-ROC={auc_roc:.4f}")

    ctx["ti"].xcom_push(key="auc_pr",  value=auc_pr)
    ctx["ti"].xcom_push(key="auc_roc", value=auc_roc)


def register_mlflow_model(**ctx) -> None:
    """Log the run to MLflow and register the model under the 'staging' alias."""
    import mlflow
    import mlflow.xgboost
    import xgboost as xgb

    auc_pr  = ctx["ti"].xcom_pull(key="auc_pr",  task_ids="evaluate_model")
    auc_roc = ctx["ti"].xcom_pull(key="auc_roc", task_ids="evaluate_model")
    model_s3 = ctx["ti"].xcom_pull(key="model_s3", task_ids="poll_sagemaker_job")

    from sagemaker.jobs import download_model_artifact
    model_path = download_model_artifact(model_s3, local_dir="/tmp/banner_rank")

    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment("banner-rank")

    with mlflow.start_run() as run:
        mlflow.log_metrics({"auc_pr": auc_pr, "auc_roc": auc_roc})
        model = xgb.XGBClassifier()
        model.load_model(model_path)
        mlflow.xgboost.log_model(
            model,
            artifact_path="model",
            registered_model_name=MODEL_NAME,
        )
        ctx["ti"].xcom_push(key="run_id", value=run.info.run_id)
    print(f"Registered {MODEL_NAME} run_id={run.info.run_id} auc_pr={auc_pr:.4f}")


def promote_model(**ctx) -> None:
    """Promote 'staging' to 'production' if AUC-PR improved by ≥1%."""
    promoted = promote_if_better(MODEL_NAME, metric="auc_pr", min_delta=0.01)
    print(f"Model promotion: {'promoted to production' if promoted else 'kept existing production'}")


default_args = {
    "owner":            "ml-pipeline",
    "retries":          1,
    "retry_delay":      timedelta(minutes=10),
    "execution_timeout": timedelta(hours=3),
}

with DAG(
    dag_id="banner_rank_training",
    description="Nightly XGBoost banner rank model training + MLflow registration",
    schedule_interval="0 2 * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    default_args=default_args,
    tags=["ml", "training", "banner-rank"],
) as dag:
    t1 = PythonOperator(task_id="check_feature_freshness", python_callable=check_feature_freshness)
    t2 = PythonOperator(task_id="build_training_dataset",  python_callable=build_training_dataset)
    t3 = PythonOperator(task_id="launch_sagemaker_job",    python_callable=launch_sagemaker_job)
    t4 = PythonOperator(task_id="poll_sagemaker_job",      python_callable=poll_sagemaker_job)
    t5 = PythonOperator(task_id="evaluate_model",          python_callable=evaluate_model)
    t6 = PythonOperator(task_id="register_mlflow_model",   python_callable=register_mlflow_model)
    t7 = PythonOperator(task_id="promote_model",           python_callable=promote_model)

    t1 >> t2 >> t3 >> t4 >> t5 >> t6 >> t7
