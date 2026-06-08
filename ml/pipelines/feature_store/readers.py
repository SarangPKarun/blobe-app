"""Parquet read helpers for the blobe-ml feature store on MinIO/S3."""
import os
import pyarrow.parquet as pq
import pandas as pd
import s3fs


def _fs() -> s3fs.S3FileSystem:
    return s3fs.S3FileSystem(
        endpoint_url=os.environ.get("MINIO_ENDPOINT", "http://localhost:9000"),
        key=os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        secret=os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    )


def read_parquet(s3_path: str, filters=None) -> pd.DataFrame:
    """Read a Parquet file or partitioned dataset from S3/MinIO into a DataFrame.

    Args:
        s3_path: S3 path (file or directory), e.g. "s3://blobe-ml/features/banner_rank/"
        filters: Optional PyArrow DNF filter list, e.g. [("dt", ">=", "2026-06-01")]
    """
    dataset = pq.ParquetDataset(s3_path, filesystem=_fs(), filters=filters)
    return dataset.read_pandas().to_pandas()


def path_exists(s3_path: str) -> bool:
    """Return True if the S3 path (file or prefix) exists."""
    fs = _fs()
    # Strip the s3:// scheme for s3fs operations
    stripped = s3_path.replace("s3://", "", 1)
    return fs.exists(stripped)
