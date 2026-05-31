FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install PyTorch CPU-only wheel (~700MB vs ~2GB CUDA) then remaining deps
RUN pip install --no-cache-dir --prefix=/install \
        torch==2.2.0+cpu \
        --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Pre-download distilbert weights into the image layer (avoids cold-start downloads)
ARG TEXT_MODEL_NAME=Hate-speech-CNERG/dehatebert-mono-english
RUN PYTHONPATH=/install/lib/python3.12/site-packages python -c "\
from transformers import AutoTokenizer, AutoModelForSequenceClassification; \
AutoTokenizer.from_pretrained('${TEXT_MODEL_NAME}'); \
AutoModelForSequenceClassification.from_pretrained('${TEXT_MODEL_NAME}')"


FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface
COPY . .

EXPOSE 3007
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3007"]
