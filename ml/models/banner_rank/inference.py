"""SageMaker inference handler for the XGBoost banner rank model.

Request:  POST application/json  {"instances": [{feature_dict}, ...]}
Response: application/json       {"scores": [float, ...]}
"""
import json
import os

import pandas as pd
import xgboost as xgb

from features import FEATURE_COLS


def model_fn(model_dir: str) -> xgb.XGBClassifier:
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(model_dir, "model.xgb"))
    return model


def input_fn(request_body: str, content_type: str) -> pd.DataFrame:
    if content_type != "application/json":
        raise ValueError(f"Unsupported content type: {content_type}")
    data = json.loads(request_body)
    return pd.DataFrame(data["instances"])[FEATURE_COLS].fillna(0)


def predict_fn(df: pd.DataFrame, model: xgb.XGBClassifier) -> list[float]:
    return model.predict_proba(df)[:, 1].tolist()


def output_fn(predictions: list[float], accept: str) -> tuple[str, str]:
    return json.dumps({"scores": predictions}), "application/json"
