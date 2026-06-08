#!/usr/bin/env python
"""SageMaker entry-point: Collaborative filtering via ALS + FAISS index."""
from __future__ import annotations

import argparse
import os
import pickle

import faiss
import mlflow
import numpy as np
import pandas as pd

from build_matrix import build_interaction_matrix


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--factors",        type=int,   default=128)
    p.add_argument("--iterations",     type=int,   default=20)
    p.add_argument("--regularization", type=float, default=0.01)
    p.add_argument("--mlflow-experiment", type=str, default="collab-filter")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    train_dir = os.environ.get("SM_CHANNEL_TRAIN", "/opt/ml/input/data/train")
    model_dir = os.environ.get("SM_MODEL_DIR",     "/opt/ml/model")
    os.makedirs(model_dir, exist_ok=True)

    # Load interaction Parquet
    import glob
    files = glob.glob(os.path.join(train_dir, "*.parquet")) if os.path.isdir(train_dir) else [train_dir]
    df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    df = df[df["interaction_weight"] > 0]  # keep positive signals only

    matrix, user_id_map, item_id_map = build_interaction_matrix(df)
    print(f"Interaction matrix: {matrix.shape[0]} users × {matrix.shape[1]} items, {matrix.nnz} interactions")

    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
    mlflow.set_experiment(args.mlflow_experiment)

    with mlflow.start_run() as run:
        mlflow.log_params(vars(args))

        from implicit.als import AlternatingLeastSquares
        model = AlternatingLeastSquares(
            factors=args.factors,
            iterations=args.iterations,
            regularization=args.regularization,
            use_gpu=False,
        )
        model.fit(matrix)

        # Build FAISS index over item (banner) embeddings
        item_factors = model.item_factors.astype(np.float32)   # shape [n_items, factors]
        faiss.normalize_L2(item_factors)                        # cosine similarity via inner product

        index = faiss.IndexFlatIP(args.factors)
        index.add(item_factors)

        # User factor dict for online lookup: user_id → embedding vector
        user_factors_dict = {
            uid: model.user_factors[i].tolist()
            for i, uid in enumerate(user_id_map)
        }

        # Persist all artifacts
        faiss.write_index(index, os.path.join(model_dir, "faiss.index"))
        with open(os.path.join(model_dir, "user_map.pkl"), "wb") as f:
            pickle.dump(user_factors_dict, f)
        with open(os.path.join(model_dir, "item_map.pkl"), "wb") as f:
            pickle.dump(item_id_map, f)

        # Spot-check recall@10 on 200 random users
        sample_users = np.random.choice(matrix.shape[0], min(200, matrix.shape[0]), replace=False)
        recalls = []
        for u in sample_users:
            user_vec = model.user_factors[u : u + 1].astype(np.float32)
            faiss.normalize_L2(user_vec)
            _, idx = index.search(user_vec, 10)
            top10 = set(idx[0])
            gt    = set(matrix[u].indices)
            if gt:
                recalls.append(len(top10 & gt) / len(gt))
        recall_at_10 = float(np.mean(recalls)) if recalls else 0.0
        mlflow.log_metric("recall_at_10", recall_at_10)
        print(f"Recall@10 (train): {recall_at_10:.3f}")

    print(f"Model artifacts written to {model_dir}")


if __name__ == "__main__":
    main()
