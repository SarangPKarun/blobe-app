"""SageMaker inference handler for the FAISS collaborative filter.

Request:  POST application/json  {"user_id": "uuid", "top_k": 50}
Response: application/json       {"banner_ids": ["uuid", ...], "scores": [float, ...]}
"""
import json
import os
import pickle

import faiss
import numpy as np


def model_fn(model_dir: str) -> dict:
    index = faiss.read_index(os.path.join(model_dir, "faiss.index"))
    with open(os.path.join(model_dir, "user_map.pkl"), "rb") as f:
        user_factors: dict = pickle.load(f)
    with open(os.path.join(model_dir, "item_map.pkl"), "rb") as f:
        item_id_map: list = pickle.load(f)
    return {"index": index, "user_factors": user_factors, "item_id_map": item_id_map}


def input_fn(request_body: str, content_type: str) -> dict:
    if content_type != "application/json":
        raise ValueError(f"Unsupported content type: {content_type}")
    return json.loads(request_body)


def predict_fn(payload: dict, model: dict) -> dict:
    user_id = payload["user_id"]
    top_k   = int(payload.get("top_k", 50))

    user_factors = model["user_factors"]
    if user_id not in user_factors:
        return {"banner_ids": [], "scores": []}

    user_vec = np.array(user_factors[user_id], dtype=np.float32).reshape(1, -1)
    faiss.normalize_L2(user_vec)

    scores_raw, indices = model["index"].search(user_vec, top_k)
    item_id_map = model["item_id_map"]

    banner_ids = [item_id_map[i] for i in indices[0] if 0 <= i < len(item_id_map)]
    scores     = scores_raw[0][: len(banner_ids)].tolist()
    return {"banner_ids": banner_ids, "scores": scores}


def output_fn(result: dict, accept: str) -> tuple[str, str]:
    return json.dumps(result), "application/json"
