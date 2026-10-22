"""Leakage-free dataset splitting strategies for time-series manufacturing telemetry."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple
import numpy as np

from .schema import ModelReadyFeatureVector


class LeakageFreeSplitter:
    """
    Guarantees no data leakage between train, validation, and test partitions.
    Supports temporal (chronological) splitting and production batch group splitting.
    """

    @staticmethod
    def temporal_split(
        records: List[ModelReadyFeatureVector],
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
    ) -> Tuple[
        List[ModelReadyFeatureVector],
        List[ModelReadyFeatureVector],
        List[ModelReadyFeatureVector],
    ]:
        """
        Chronological split: sorts by timestamp so training data strictly precedes
        validation data, and validation strictly precedes test data.
        Prevents future information leakage into past predictions.
        """
        if not records:
            return [], [], []

        sorted_records = sorted(records, key=lambda r: r.timestamp)
        n = len(sorted_records)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        train = sorted_records[:train_end]
        val = sorted_records[train_end:val_end]
        test = sorted_records[val_end:]

        return train, val, test

    @staticmethod
    def batch_group_split(
        records: List[ModelReadyFeatureVector],
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        seed: int = 42,
    ) -> Tuple[
        List[ModelReadyFeatureVector],
        List[ModelReadyFeatureVector],
        List[ModelReadyFeatureVector],
    ]:
        """
        Group-based split by manufacturing batch ID:
        Ensures all cell records from a single batch are entirely confined
        to either train, validation, or test. Prevents batch-correlated leakage.
        """
        if not records:
            return [], [], []

        # Group by batch_id
        batch_map: Dict[str, List[ModelReadyFeatureVector]] = {}
        unassigned: List[ModelReadyFeatureVector] = []

        for r in records:
            if r.batch_id:
                batch_map.setdefault(r.batch_id, []).append(r)
            else:
                unassigned.append(r)

        unique_batches = sorted(list(batch_map.keys()))
        rng = np.random.RandomState(seed)
        rng.shuffle(unique_batches)

        n_batches = len(unique_batches)
        if n_batches >= 3:
            train_batch_end = int(n_batches * train_ratio)
            val_batch_end = int(n_batches * (train_ratio + val_ratio))

            train_batches = set(unique_batches[:train_batch_end])
            val_batches = set(unique_batches[train_batch_end:val_batch_end])
            test_batches = set(unique_batches[val_batch_end:])

            train = [r for b in train_batches for r in batch_map[b]]
            val = [r for b in val_batches for r in batch_map[b]]
            test = [r for b in test_batches for r in batch_map[b]]

            # Append unassigned temporally
            if unassigned:
                u_tr, u_va, u_te = LeakageFreeSplitter.temporal_split(
                    unassigned, train_ratio, val_ratio
                )
                train.extend(u_tr)
                val.extend(u_va)
                test.extend(u_te)

            return train, val, test

        # Fallback to temporal split if batch count is too small
        return LeakageFreeSplitter.temporal_split(records, train_ratio, val_ratio)
