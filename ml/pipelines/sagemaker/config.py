"""SageMaker training job configuration for each model."""
import os

SAGEMAKER_ROLE_ARN = os.environ.get("SAGEMAKER_ROLE_ARN", "")
SAGEMAKER_REGION   = os.environ.get("SAGEMAKER_REGION", "us-east-1")
MINIO_ENDPOINT     = os.environ.get("MINIO_ENDPOINT", "http://minio:9000")

# All jobs share the same dev-mode flag: when SAGEMAKER_ROLE_ARN is empty,
# training runs locally inside the ml-pipeline container instead of on SageMaker.
DEV_MODE = not bool(SAGEMAKER_ROLE_ARN)

BANNER_RANK_JOB = {
    "name_prefix":      "banner-rank",
    "entry_point":      "ml/models/banner_rank/train.py",
    "framework":        "xgboost",
    "framework_version": "1.7-1",
    "instance_type":    "ml.m5.xlarge",
    "instance_count":   1,
    "output_path":      "s3://blobe-ml/models/banner_rank/",
    "hyperparameters": {
        "max-depth":      6,
        "n-estimators":   300,
        "learning-rate":  0.05,
        "subsample":      0.8,
    },
    "environment": {
        "MLFLOW_TRACKING_URI":  os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000"),
        "MLFLOW_S3_ENDPOINT_URL": MINIO_ENDPOINT,
        "AWS_ACCESS_KEY_ID":    os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    },
}

COLLAB_FILTER_JOB = {
    "name_prefix":      "collab-filter",
    "entry_point":      "ml/models/collaborative_filter/train.py",
    "framework":        "pytorch",
    "framework_version": "2.1",
    "instance_type":    "ml.c5.2xlarge",
    "instance_count":   1,
    "output_path":      "s3://blobe-ml/models/collab_filter/",
    "hyperparameters": {
        "factors":       128,
        "iterations":    20,
        "regularization": 0.01,
    },
    "environment": {
        "MLFLOW_TRACKING_URI":  os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000"),
        "MLFLOW_S3_ENDPOINT_URL": MINIO_ENDPOINT,
        "AWS_ACCESS_KEY_ID":    os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    },
}

TRUST_GNN_JOB = {
    "name_prefix":      "trust-gnn",
    "entry_point":      "ml/models/trust_gnn/train.py",
    "framework":        "pytorch",
    "framework_version": "2.1",
    "instance_type":    "ml.g4dn.xlarge",   # GPU instance for PyG
    "instance_count":   1,
    "output_path":      "s3://blobe-ml/models/trust_gnn/",
    "hyperparameters": {
        "hidden-dim":   64,
        "num-layers":   2,
        "lr":           0.001,
        "epochs":       50,
    },
    "environment": {
        "MLFLOW_TRACKING_URI":  os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000"),
        "MLFLOW_S3_ENDPOINT_URL": MINIO_ENDPOINT,
        "AWS_ACCESS_KEY_ID":    os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    },
}
