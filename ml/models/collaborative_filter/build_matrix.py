"""Build a scipy sparse user×item interaction matrix from the collab_filter Parquet."""
from __future__ import annotations

import pandas as pd
import scipy.sparse as sp
import numpy as np


def build_interaction_matrix(
    df: pd.DataFrame,
) -> tuple[sp.csr_matrix, list[str], list[str]]:
    """Convert an interaction DataFrame into a CSR user×item matrix.

    Returns:
        matrix:       scipy.sparse.csr_matrix, shape [n_users, n_items]
        user_id_map:  list of user_ids (index → id)
        item_id_map:  list of banner_ids (index → id)
    """
    user_ids = df["user_id"].unique().tolist()
    item_ids = df["banner_id"].unique().tolist()
    user_idx = {uid: i for i, uid in enumerate(user_ids)}
    item_idx = {iid: i for i, iid in enumerate(item_ids)}

    rows = df["user_id"].map(user_idx).values
    cols = df["banner_id"].map(item_idx).values
    data = df["interaction_weight"].values.astype(np.float32)

    # Clip negatives to 0 (confidence-weighted ALS requires non-negative confidence)
    data = np.clip(data, 0, None)

    matrix = sp.csr_matrix((data, (rows, cols)), shape=(len(user_ids), len(item_ids)))
    return matrix, user_ids, item_ids
