FROM apache/airflow:2.9.2-python3.11

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

USER airflow

# Copy and install Python dependencies
COPY requirements.txt /opt/airflow/requirements.txt
RUN pip install --no-cache-dir -r /opt/airflow/requirements.txt

# Copy pipeline source (DAGs, feature store, MLflow utils, SageMaker launcher)
COPY dags/           /opt/airflow/dags/
COPY feature_store/  /opt/airflow/feature_store/
COPY sagemaker/      /opt/airflow/sagemaker/
COPY mlflow_utils.py /opt/airflow/mlflow_utils.py

# Copy model training scripts (used by DEV_MODE local training)
COPY ../../models/   /opt/airflow/ml/models/

ENV AIRFLOW__CORE__LOAD_EXAMPLES=False
ENV AIRFLOW__CORE__DAGS_FOLDER=/opt/airflow/dags
ENV PYTHONPATH=/opt/airflow

HEALTHCHECK --interval=15s --timeout=10s --retries=5 \
    CMD curl -f http://localhost:8080/health || exit 1
