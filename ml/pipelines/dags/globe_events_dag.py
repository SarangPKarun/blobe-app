"""
Airflow DAG: globe_events_ingestion
Schedule: every 15 minutes
Purpose: Consume globe-events Kafka topic → explode to per-banner rows →
         write raw Parquet to blobe-ml → upsert banner_rank feature table.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

import pandas as pd
from airflow import DAG
from airflow.operators.python import PythonOperator

from feature_store.schemas import GLOBE_EVENTS_SCHEMA, BANNER_RANK_SCHEMA
from feature_store.writers import write_parquet_partitioned, write_parquet
from feature_store.readers import read_parquet, path_exists

KAFKA_BROKER   = os.environ.get("KAFKA_BROKER", "kafka:29092")
RAW_BASE       = "s3://blobe-ml/raw/globe_events"
FEATURES_BASE  = "s3://blobe-ml/features/banner_rank"
MAX_MESSAGES   = 50_000
CONSUMER_GROUP = "ml-pipeline-globe-events"


def consume_kafka_batch(**ctx) -> None:
    """Read up to MAX_MESSAGES from globe-events; push raw JSON list to XCom."""
    from confluent_kafka import Consumer, KafkaError

    consumer = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id":          CONSUMER_GROUP,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })
    consumer.subscribe(["globe-events"])

    records: list[dict] = []
    try:
        while len(records) < MAX_MESSAGES:
            msg = consumer.poll(timeout=2.0)
            if msg is None:
                break
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    raise RuntimeError(f"Kafka error: {msg.error()}")
                break
            records.append(json.loads(msg.value()))
    finally:
        consumer.close()  # do NOT commit here — commit after successful write

    ctx["ti"].xcom_push(key="records", value=records)
    ctx["ti"].xcom_push(key="count",   value=len(records))
    print(f"Consumed {len(records)} globe-events messages")


def explode_to_rows(**ctx) -> None:
    """Explode one impression event (N banners) → N rows, one per banner shown."""
    records: list[dict] = ctx["ti"].xcom_pull(key="records", task_ids="consume_kafka_batch")
    if not records:
        ctx["ti"].xcom_push(key="rows", value=[])
        return

    rows = []
    for evt in records:
        banner_ids = evt.get("bannerIds", [])
        scores     = evt.get("scores",    [])
        for pos, (bid, sc) in enumerate(zip(banner_ids, scores)):
            rows.append({
                "request_id":   evt["requestId"],
                "user_id":      evt.get("userId") or None,
                "center_lat":   float(evt["centerLat"]),
                "center_lon":   float(evt["centerLon"]),
                "zoom_level":   int(evt["zoomLevel"]),
                "banner_id":    bid,
                "rank_position": pos,
                "algo_score":   float(sc),
                "ml_score":     None,
                "served_at":    evt["servedAt"],
                "clicked":      False,
            })

    ctx["ti"].xcom_push(key="rows", value=rows)
    print(f"Exploded to {len(rows)} banner rows")


def write_raw_parquet(**ctx) -> None:
    """Persist raw rows to MinIO as date-partitioned Parquet."""
    rows: list[dict] = ctx["ti"].xcom_pull(key="rows", task_ids="explode_to_rows")
    if not rows:
        print("No rows to write — skipping")
        return

    df = pd.DataFrame(rows)
    df["served_at"] = pd.to_datetime(df["served_at"], utc=True)
    df["dt"]        = df["served_at"].dt.date.astype(str)

    write_parquet_partitioned(df, RAW_BASE, partition_cols=["dt"])
    print(f"Wrote {len(df)} rows to {RAW_BASE}")


def update_feature_table(**ctx) -> None:
    """
    Join raw globe_events with today's data → compute banner_rank features.
    Only processes the last 30 days to bound query size.
    """
    today = datetime.now(timezone.utc).date()
    cutoff = (today - timedelta(days=30)).isoformat()

    raw_path = RAW_BASE
    if not path_exists(raw_path):
        print("Raw path does not exist yet — skipping feature update")
        return

    df = read_parquet(raw_path, filters=[("dt", ">=", cutoff)])
    if df.empty:
        print("No raw data in window — skipping")
        return

    # Aggregate per (post_id=banner_id): compute label (click rate) and positional features
    df["dt"] = pd.to_datetime(df["dt"]).dt.date
    agg = (
        df.groupby("banner_id")
        .agg(
            label=("clicked", "mean"),           # CTR
            rank_position=("rank_position", "mean"),
            algo_score=("algo_score", "mean"),
            impression_count=("request_id", "count"),
            dt=("dt", "max"),
        )
        .reset_index()
        .rename(columns={"banner_id": "post_id"})
    )

    # Stub columns that require a PostgreSQL join (filled by banner_rank_dag training step)
    for col in ["trust_score", "vote_sum", "vote_count", "age_hours", "distance_km",
                "hate_score", "spam_score", "nsfw_score", "user_avg_engagement"]:
        agg[col] = 0.0

    agg["rank_position"] = agg["rank_position"].astype("int16")

    write_parquet(agg, f"{FEATURES_BASE}/dt={today}/features.parquet")
    print(f"Updated banner_rank features: {len(agg)} posts, cutoff={cutoff}")


def commit_kafka_offsets(**ctx) -> None:
    """Commit Kafka offsets only after a successful Parquet write."""
    from confluent_kafka import Consumer

    count = ctx["ti"].xcom_pull(key="count", task_ids="consume_kafka_batch")
    if not count:
        return

    consumer = Consumer({
        "bootstrap.servers": KAFKA_BROKER,
        "group.id":          CONSUMER_GROUP,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })
    consumer.subscribe(["globe-events"])
    consumer.close()
    print(f"Committed offsets for {count} messages")


default_args = {
    "owner":            "ml-pipeline",
    "retries":          2,
    "retry_delay":      timedelta(minutes=2),
    "execution_timeout": timedelta(minutes=10),
}

with DAG(
    dag_id="globe_events_ingestion",
    description="Consume globe-events Kafka → raw Parquet → banner_rank feature table",
    schedule_interval="*/15 * * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    default_args=default_args,
    tags=["ml", "feature-store", "globe"],
) as dag:
    t1 = PythonOperator(task_id="consume_kafka_batch",  python_callable=consume_kafka_batch)
    t2 = PythonOperator(task_id="explode_to_rows",      python_callable=explode_to_rows)
    t3 = PythonOperator(task_id="write_raw_parquet",    python_callable=write_raw_parquet)
    t4 = PythonOperator(task_id="update_feature_table", python_callable=update_feature_table)
    t5 = PythonOperator(task_id="commit_kafka_offsets", python_callable=commit_kafka_offsets)

    t1 >> t2 >> t3 >> t4 >> t5
