"""SageMaker training job launcher with DEV_MODE local fallback."""
from __future__ import annotations

import os
import subprocess
import sys
import time
import uuid

from sagemaker.config import DEV_MODE, SAGEMAKER_REGION, SAGEMAKER_ROLE_ARN


def launch_training_job(job_config: dict, input_s3_uri: str) -> str:
    """Launch a SageMaker training job and return its name.

    In DEV_MODE (SAGEMAKER_ROLE_ARN is empty), runs the training script
    directly as a subprocess so the full pipeline works locally.
    """
    job_name = f"{job_config['name_prefix']}-{int(time.time())}-{uuid.uuid4().hex[:6]}"

    if DEV_MODE:
        return _run_local(job_config, input_s3_uri, job_name)

    return _run_sagemaker(job_config, input_s3_uri, job_name)


def wait_for_job(job_name: str) -> str:
    """Poll until the job reaches a terminal state; return the model artifact S3 path.

    In DEV_MODE the job already completed synchronously in launch_training_job,
    so this just resolves the output path from the stored metadata.
    """
    if DEV_MODE:
        return _dev_model_path(job_name)

    import boto3

    sm = boto3.client("sagemaker", region_name=SAGEMAKER_REGION)
    print(f"Polling SageMaker job {job_name} …")
    while True:
        resp   = sm.describe_training_job(TrainingJobName=job_name)
        status = resp["TrainingJobStatus"]
        if status == "Completed":
            return resp["ModelArtifacts"]["S3ModelArtifacts"]
        if status in ("Failed", "Stopped"):
            raise RuntimeError(f"SageMaker job {job_name} ended with status={status}: "
                               f"{resp.get('FailureReason', 'no reason provided')}")
        print(f"  {job_name}: {status} …")
        time.sleep(60)


def download_model_artifact(s3_path: str, local_dir: str, is_dir: bool = False) -> str:
    """Download a model artifact from S3/MinIO to a local directory.

    Returns the path to the model file (or directory if is_dir=True).
    """
    import s3fs, tarfile, pathlib

    minio_endpoint = os.environ.get("MINIO_ENDPOINT", "http://minio:9000")
    fs = s3fs.S3FileSystem(
        endpoint_url=minio_endpoint,
        key=os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        secret=os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    )

    pathlib.Path(local_dir).mkdir(parents=True, exist_ok=True)

    if is_dir:
        stripped = s3_path.replace("s3://", "", 1)
        fs.get(stripped, local_dir, recursive=True)
        return local_dir

    # Single file — may be a .tar.gz (SageMaker convention) or bare file
    local_archive = os.path.join(local_dir, "model.tar.gz")
    stripped = s3_path.replace("s3://", "", 1)
    fs.get(stripped, local_archive)

    if s3_path.endswith(".tar.gz"):
        with tarfile.open(local_archive) as tf:
            tf.extractall(local_dir)
        # Return first file that looks like the model
        for fname in os.listdir(local_dir):
            if fname != "model.tar.gz":
                return os.path.join(local_dir, fname)

    return local_archive


# ---------------------------------------------------------------------------
# DEV_MODE helpers
# ---------------------------------------------------------------------------

_DEV_JOB_STORE: dict[str, str] = {}   # job_name → output_path


def _run_local(job_config: dict, input_s3_uri: str, job_name: str) -> str:
    """Run the training entry-point in-process via subprocess."""
    output_path = f"{job_config['output_path']}{job_name}/"
    model_dir   = f"/tmp/{job_name}/model"
    os.makedirs(model_dir, exist_ok=True)

    # Download input data locally
    from feature_store.readers import _fs as _s3fs
    import pathlib
    local_input = f"/tmp/{job_name}/input"
    pathlib.Path(local_input).mkdir(parents=True, exist_ok=True)
    stripped = input_s3_uri.replace("s3://", "", 1)
    _s3fs().get(stripped, local_input + "/data.parquet")

    env = {
        **os.environ,
        **job_config.get("environment", {}),
        "SM_CHANNEL_TRAIN": local_input,
        "SM_MODEL_DIR":     model_dir,
    }
    hp = job_config.get("hyperparameters", {})
    args = [sys.executable, job_config["entry_point"]]
    for k, v in hp.items():
        args += [f"--{k}", str(v)]

    print(f"DEV_MODE: running {args[1]} locally …")
    result = subprocess.run(args, env=env, capture_output=False, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Local training failed (exit {result.returncode})")

    # Upload model artifact to MinIO
    import s3fs as s3fslib
    fs = s3fslib.S3FileSystem(
        endpoint_url=os.environ.get("MINIO_ENDPOINT", "http://minio:9000"),
        key=os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        secret=os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    )
    dest = output_path.replace("s3://", "", 1)
    for fname in os.listdir(model_dir):
        fs.put(os.path.join(model_dir, fname), f"{dest}{fname}")

    _DEV_JOB_STORE[job_name] = output_path
    return job_name


def _run_sagemaker(job_config: dict, input_s3_uri: str, job_name: str) -> str:
    import boto3

    sm = boto3.client("sagemaker", region_name=SAGEMAKER_REGION)
    sm.create_training_job(
        TrainingJobName=job_name,
        RoleArn=SAGEMAKER_ROLE_ARN,
        AlgorithmSpecification={
            "TrainingImage": _resolve_image(job_config),
            "TrainingInputMode": "File",
        },
        InputDataConfig=[{
            "ChannelName": "train",
            "DataSource": {
                "S3DataSource": {
                    "S3DataType": "S3Prefix",
                    "S3Uri": input_s3_uri,
                    "S3DataDistributionType": "FullyReplicated",
                }
            },
        }],
        OutputDataConfig={"S3OutputPath": job_config["output_path"]},
        ResourceConfig={
            "InstanceType":  job_config["instance_type"],
            "InstanceCount": job_config.get("instance_count", 1),
            "VolumeSizeInGB": 30,
        },
        HyperParameters={k: str(v) for k, v in job_config.get("hyperparameters", {}).items()},
        Environment=job_config.get("environment", {}),
        StoppingCondition={"MaxRuntimeInSeconds": 7200},
    )
    _DEV_JOB_STORE[job_name] = job_config["output_path"] + job_name + "/output/model.tar.gz"
    return job_name


def _dev_model_path(job_name: str) -> str:
    return _DEV_JOB_STORE.get(job_name, f"s3://blobe-ml/models/{job_name}/")


def _resolve_image(job_config: dict) -> str:
    """Return the ECR URI for the SageMaker managed framework container."""
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    framework   = job_config["framework"]
    version     = job_config["framework_version"]
    region      = SAGEMAKER_REGION
    # Use the SageMaker-managed pre-built containers
    return (
        f"{account_id}.dkr.ecr.{region}.amazonaws.com/"
        f"sagemaker-{framework}:{version}-cpu-py3"
    )
