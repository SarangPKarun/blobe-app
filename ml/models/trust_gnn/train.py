#!/usr/bin/env python
"""SageMaker entry-point: GraphSAGE GNN for trust score prediction."""
from __future__ import annotations

import argparse
import os

import mlflow
import mlflow.pytorch
import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

from graph_builder import build_pyg_data


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--hidden-dim",  type=int,   default=64)
    p.add_argument("--num-layers",  type=int,   default=2)
    p.add_argument("--lr",          type=float, default=0.001)
    p.add_argument("--epochs",      type=int,   default=50)
    p.add_argument("--mlflow-experiment", type=str, default="trust-gnn")
    return p.parse_args()


class TrustGNN(torch.nn.Module):
    """2-layer GraphSAGE that predicts a scalar trust score per user node."""

    def __init__(self, in_channels: int, hidden: int, num_layers: int = 2) -> None:
        super().__init__()
        self.convs = torch.nn.ModuleList()
        self.convs.append(SAGEConv(in_channels, hidden))
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden, hidden))
        self.convs.append(SAGEConv(hidden, 1))

    def forward(self, x, edge_index, edge_attr=None):
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index)
            if i < len(self.convs) - 1:
                x = F.relu(x)
        return x


def main() -> None:
    args = parse_args()

    train_dir = os.environ.get("SM_CHANNEL_TRAIN", "/opt/ml/input/data/train")
    model_dir = os.environ.get("SM_MODEL_DIR",     "/opt/ml/model")
    os.makedirs(model_dir, exist_ok=True)

    import glob
    files = glob.glob(os.path.join(train_dir, "*.parquet")) if os.path.isdir(train_dir) else [train_dir]
    df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)

    data, node_map = build_pyg_data(df)

    # Self-supervised target: use column 0 of node features (current_trust_score) as label.
    # This bootstraps the GNN to replicate the existing heuristic scores first,
    # and can be replaced with human-review labels in later phases.
    y = data.x[:, 0].unsqueeze(-1)   # shape [n_nodes, 1]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    data   = data.to(device)
    y      = y.to(device)

    model = TrustGNN(in_channels=3, hidden=args.hidden_dim, num_layers=args.num_layers).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
    mlflow.set_experiment(args.mlflow_experiment)

    with mlflow.start_run() as run:
        mlflow.log_params(vars(args))

        for epoch in range(1, args.epochs + 1):
            model.train()
            optimizer.zero_grad()
            pred = model(data.x, data.edge_index, data.edge_attr)
            loss = F.mse_loss(pred, y)
            loss.backward()
            optimizer.step()

            if epoch % 10 == 0:
                print(f"Epoch {epoch:3d}  MSE={loss.item():.4f}")

        model.eval()
        with torch.no_grad():
            val_pred = model(data.x, data.edge_index, data.edge_attr)
            val_mse  = F.mse_loss(val_pred, y).item()

        mlflow.log_metric("val_mse", val_mse)
        print(f"Final val_mse={val_mse:.4f}")

        # Save model and node_map for the DAG's backtest + push tasks
        torch.save(model.cpu(), os.path.join(model_dir, "model.pt"))

        import pickle
        with open(os.path.join(model_dir, "node_map.pkl"), "wb") as f:
            pickle.dump(node_map, f)

        mlflow.pytorch.log_model(
            model.cpu(),
            artifact_path="model",
            registered_model_name="trust-gnn",
        )

    print(f"Model saved to {model_dir}")


if __name__ == "__main__":
    main()
