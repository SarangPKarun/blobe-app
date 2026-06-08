"""Parquet write helpers for the blobe-ml feature store on MinIO/S3."""
import os
import pyarrow as pa
import pyarrow.parquet as pq
import s3fs


def _fs() -> s3fs.S3FileSystem:
    return s3fs.S3FileSystem(
        endpoint_url=os.environ.get("MINIO_ENDPOINT", "http://localhost:9000"),
        key=os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        secret=os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    )


def write_parquet(df, s3_path: str, schema: pa.Schema | None = None) -> None:
    """Write a pandas DataFrame to a Parquet file on S3/MinIO.

    Args:
        df: pandas DataFrame to persist.
        s3_path: Full S3 path including bucket, e.g. "s3://blobe-ml/raw/globe_events/dt=.../part-0000.parquet"
        schema: Optional PyArrow schema for strict type enforcement.
    """
    table = pa.Table.from_pandas(df, schema=schema, preserve_index=False)
    pq.write_table(table, s3_path, filesystem=_fs(), compression="snappy")


def write_parquet_partitioned(df, s3_base: str, partition_cols: list[str], schema: pa.Schema | None = None) -> None:
    """Write a pandas DataFrame as a Hive-partitioned Parquet dataset."""
    table = pa.Table.from_pandas(df, schema=schema, preserve_index=False)
    pq.write_to_dataset(
        table,
        root_path=s3_base,
        partition_cols=partition_cols,
        filesystem=_fs(),
        existing_data_behavior="overwrite_or_ignore",
        compression="snappy",
    )
