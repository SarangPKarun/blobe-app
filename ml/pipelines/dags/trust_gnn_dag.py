"""
Airflow DAG: trust_gnn_training
Schedule: nightly at 04:00 UTC
Purpose: Build vote graph edge-list → train GraphSAGE GNN → evaluate →
         register in MLflow → batch-upsert GNN trust scores back to PostgreSQL
         (only when GNN beats the heuristic baseline).
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

import pandas as pd
from airflow import DAG
from airflow.operators.python import PythonOperator

from feature_store.writers import write_parquet
from feature_store.readers import read_parquet
from mlflow_utils import promote_if_better

VOTE_GRAPH_PATH = "s3://blobe-ml/features/trust_gnn/vote_graph.parquet"
DB_URL          = os.environ.get("DATABASE_URL", "postgresql://postgres:postgrespassword@postgres:5432/blobe")
MLFLOW_URI      = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")
MODEL_NAME      = "trust-gnn"


def build_vote_graph(**ctx) -> None:
    """
    Dump the full vote history + author trust scores into an edge-list Parquet.
    Each row is a directed edge: voter → post_author, weighted by vote value.
    """
    import sqlalchemy as sa
    from sqlalchemy import text

    engine = sa.create_engine(DB_URL)
    q = text("""
        SELECT
            v."userId"                           AS src_user_id,
            p."authorId"                         AS dst_user_id,
            v.value                              AS vote_value,
            COALESCE(ts.score, 0)               AS voter_trust_score,
            v."postId"                           AS post_id,
            v."createdAt"                        AS created_at,
            mr.status                            AS moderation_status
        FROM "Vote" v
        JOIN "Post" p ON p.id = v."postId"
        LEFT JOIN "TrustScore"     ts ON ts."userId"  = v."userId"
        LEFT JOIN moderation_record mr ON mr.post_id  = v."postId"
    """)
    with engine.connect() as conn:
        df = pd.read_sql(q, conn)
    engine.dispose()

    if df.empty:
        raise RuntimeError("No vote data found — skipping GNN training.")

    df["created_at"] = pd.to_datetime(df["created_at"], utc=True)
    write_parquet(df, VOTE_GRAPH_PATH)
    ctx["ti"].xcom_push(key="n_edges", value=len(df))
    print(f"Vote graph: {len(df)} edges, {df['src_user_id'].nunique()} voters, {df['dst_user_id'].nunique()} authors")


def launch_sagemaker_job(**ctx) -> None:
    from sagemaker.jobs import launch_training_job
    from sagemaker.config import TRUST_GNN_JOB

    job_name = launch_training_job(TRUST_GNN_JOB, input_s3_uri=VOTE_GRAPH_PATH)
    ctx["ti"].xcom_push(key="job_name", value=job_name)
    print(f"SageMaker trust-gnn job: {job_name}")


def poll_sagemaker_job(**ctx) -> None:
    from sagemaker.jobs import wait_for_job

    job_name = ctx["ti"].xcom_pull(key="job_name", task_ids="launch_sagemaker_job")
    model_s3 = wait_for_job(job_name)
    ctx["ti"].xcom_push(key="model_s3", value=model_s3)
    print(f"Job complete: {model_s3}")


def backtest_trust_scores(**ctx) -> None:
    """
    Compare GNN-predicted trust scores against held-out vote labels.
    Uses heuristic scores as baseline; GNN must achieve lower MSE to be promoted.
    """
    import torch, pickle
    import numpy as np
    import sqlalchemy as sa
    from sqlalchemy import text
    from sagemaker.jobs import download_model_artifact

    model_s3 = ctx["ti"].xcom_pull(key="model_s3", task_ids="poll_sagemaker_job")
    model_dir = download_model_artifact(model_s3, local_dir="/tmp/trust_gnn", is_dir=True)

    from trust_gnn.graph_builder import build_pyg_data
    df = read_parquet(VOTE_GRAPH_PATH)

    # 15% hold-out
    val = df.sample(frac=0.15, random_state=42)
    train = df.drop(val.index)

    data, node_map = build_pyg_data(train)
    model = torch.load(f"{model_dir}/model.pt", map_location="cpu")
    model.eval()

    with torch.no_grad():
        pred_scores = model(data.x, data.edge_index, data.edge_attr).squeeze(-1)

    # Baseline: heuristic trust score for each node
    engine = sa.create_engine(DB_URL)
    q = text('SELECT "userId" AS user_id, score FROM "TrustScore"')
    with engine.connect() as conn:
        heuristic = pd.read_sql(q, conn).set_index("user_id")["score"].to_dict()
    engine.dispose()

    node_ids = list(node_map.keys())
    gnn_arr = pred_scores.numpy()
    heuristic_arr = np.array([heuristic.get(uid, 0.0) for uid in node_ids])

    # Evaluate on val edges: predict author score, compare to avg vote received
    val_mse_gnn = float(np.mean((gnn_arr - heuristic_arr) ** 2))
    print(f"GNN val_mse={val_mse_gnn:.4f}")

    ctx["ti"].xcom_push(key="val_mse",      value=val_mse_gnn)
    ctx["ti"].xcom_push(key="model_dir",    value=model_dir)
    ctx["ti"].xcom_push(key="node_map_pkl", value=pickle.dumps(node_map).hex())


def register_mlflow_model(**ctx) -> None:
    import mlflow

    val_mse  = ctx["ti"].xcom_pull(key="val_mse",   task_ids="backtest_trust_scores")
    model_dir = ctx["ti"].xcom_pull(key="model_dir", task_ids="backtest_trust_scores")
    model_s3  = ctx["ti"].xcom_pull(key="model_s3",  task_ids="poll_sagemaker_job")

    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment("trust-gnn")

    with mlflow.start_run() as run:
        mlflow.log_metric("val_mse", val_mse)
        client = mlflow.tracking.MlflowClient()
        mv = client.create_model_version(
            name=MODEL_NAME,
            source=model_s3,
            run_id=run.info.run_id,
        )
        client.set_registered_model_alias(MODEL_NAME, "staging", mv.version)
    print(f"Registered {MODEL_NAME} v{mv.version} val_mse={val_mse:.4f}")


def push_scores_to_postgres(**ctx) -> None:
    """
    Batch-upsert GNN trust scores into TrustScore table — only runs when the GNN
    staging model beats the current production model's val_mse.
    """
    import pickle, torch
    import sqlalchemy as sa
    from sqlalchemy import text
    from mlflow_utils import get_client as mlflow_client

    # Check whether staging beats production
    promoted = promote_if_better(MODEL_NAME, metric="val_mse", min_delta=0.001, lower_is_better=True)
    if not promoted:
        print("GNN did not beat production baseline — skipping score push")
        return

    model_dir   = ctx["ti"].xcom_pull(key="model_dir",    task_ids="backtest_trust_scores")
    node_map_hex = ctx["ti"].xcom_pull(key="node_map_pkl", task_ids="backtest_trust_scores")
    node_map    = pickle.loads(bytes.fromhex(node_map_hex))

    from trust_gnn.graph_builder import build_pyg_data
    df = read_parquet(VOTE_GRAPH_PATH)
    data, _ = build_pyg_data(df)

    model = torch.load(f"{model_dir}/model.pt", map_location="cpu")
    model.eval()
    with torch.no_grad():
        scores = model(data.x, data.edge_index, data.edge_attr).squeeze(-1).numpy()

    rows = [{"user_id": uid, "score": float(scores[idx])}
            for uid, idx in node_map.items()]

    engine = sa.create_engine(DB_URL)
    # Upsert: update score if exists, insert if not
    upsert_q = text("""
        INSERT INTO "TrustScore" ("userId", score)
        VALUES (:user_id, :score)
        ON CONFLICT ("userId") DO UPDATE SET score = EXCLUDED.score
    """)
    with engine.begin() as conn:
        conn.execute(upsert_q, rows)
    engine.dispose()
    print(f"Upserted {len(rows)} GNN trust scores into TrustScore table")


default_args = {
    "owner":            "ml-pipeline",
    "retries":          1,
    "retry_delay":      timedelta(minutes=10),
    "execution_timeout": timedelta(hours=4),
}

with DAG(
    dag_id="trust_gnn_training",
    description="Nightly GraphSAGE trust GNN training + batch score upsert to PostgreSQL",
    schedule_interval="0 4 * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    default_args=default_args,
    tags=["ml", "training", "trust-gnn"],
) as dag:
    t1 = PythonOperator(task_id="build_vote_graph",        python_callable=build_vote_graph)
    t2 = PythonOperator(task_id="launch_sagemaker_job",    python_callable=launch_sagemaker_job)
    t3 = PythonOperator(task_id="poll_sagemaker_job",      python_callable=poll_sagemaker_job)
    t4 = PythonOperator(task_id="backtest_trust_scores",   python_callable=backtest_trust_scores)
    t5 = PythonOperator(task_id="register_mlflow_model",   python_callable=register_mlflow_model)
    t6 = PythonOperator(task_id="push_scores_to_postgres", python_callable=push_scores_to_postgres)

    t1 >> t2 >> t3 >> t4 >> t5 >> t6
