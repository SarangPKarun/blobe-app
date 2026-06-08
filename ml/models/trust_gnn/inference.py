"""SageMaker inference handler for the Trust GNN.

Request:  POST application/json  {"user_id": "uuid", "vote_graph": [{edge_dict}, ...]}
Response: application/json       {"trust_score": float}
"""
import json
import os
import pickle

import pandas as pd
import torch


def model_fn(model_dir: str) -> dict:
    model = torch.load(os.path.join(model_dir, "model.pt"), map_location="cpu")
    model.eval()
    with open(os.path.join(model_dir, "node_map.pkl"), "rb") as f:
        node_map: dict = pickle.load(f)
    return {"model": model, "node_map": node_map}


def input_fn(request_body: str, content_type: str) -> dict:
    if content_type != "application/json":
        raise ValueError(f"Unsupported content type: {content_type}")
    return json.loads(request_body)


def predict_fn(payload: dict, artifacts: dict) -> dict:
    user_id    = payload["user_id"]
    vote_graph = payload.get("vote_graph", [])  # list of edge dicts

    from graph_builder import build_pyg_data
    df   = pd.DataFrame(vote_graph) if vote_graph else pd.DataFrame(
        columns=["src_user_id", "dst_user_id", "vote_value", "voter_trust_score",
                 "post_id", "created_at", "moderation_status"]
    )

    model    = artifacts["model"]
    node_map = artifacts["node_map"]

    if df.empty or user_id not in node_map:
        return {"trust_score": 0.0}

    data, local_map = build_pyg_data(df)
    if user_id not in local_map:
        return {"trust_score": 0.0}

    with torch.no_grad():
        scores = model(data.x, data.edge_index, data.edge_attr).squeeze(-1)
    idx   = local_map[user_id]
    score = float(scores[idx].item())
    return {"trust_score": score}


def output_fn(result: dict, accept: str) -> tuple[str, str]:
    return json.dumps(result), "application/json"
