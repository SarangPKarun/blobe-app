"""Build a PyTorch Geometric Data object from the vote edge-list Parquet."""
from __future__ import annotations

import pandas as pd
import torch
from torch_geometric.data import Data


def build_pyg_data(df: pd.DataFrame) -> tuple[Data, dict[str, int]]:
    """Convert a vote edge-list DataFrame into a PyG Data object.

    Node features (per user):
      [0] current_trust_score   — from voter_trust_score (mean per user)
      [1] out_degree             — number of votes cast
      [2] in_degree              — number of votes received

    Edge features:
      [0] vote_value             — -1, 0, 1
      [1] voter_trust_score      — weight of the voting signal

    Returns:
        data:      PyG Data object
        node_map:  dict mapping user_id (str) → node index (int)
    """
    all_users = pd.concat([df["src_user_id"], df["dst_user_id"]]).unique().tolist()
    node_map  = {uid: i for i, uid in enumerate(all_users)}
    n         = len(all_users)

    # Node features
    trust_by_user  = df.groupby("src_user_id")["voter_trust_score"].mean().to_dict()
    out_deg        = df["src_user_id"].value_counts().to_dict()
    in_deg         = df["dst_user_id"].value_counts().to_dict()

    x = torch.zeros((n, 3), dtype=torch.float32)
    for uid, idx in node_map.items():
        x[idx, 0] = trust_by_user.get(uid, 0.0)
        x[idx, 1] = float(out_deg.get(uid, 0))
        x[idx, 2] = float(in_deg.get(uid, 0))

    # Edge index (directed: voter → author)
    src = torch.tensor([node_map[u] for u in df["src_user_id"]], dtype=torch.long)
    dst = torch.tensor([node_map[u] for u in df["dst_user_id"]], dtype=torch.long)
    edge_index = torch.stack([src, dst], dim=0)

    # Edge attributes
    edge_attr = torch.tensor(
        df[["vote_value", "voter_trust_score"]].values.astype("float32"),
        dtype=torch.float32,
    )

    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr), node_map
