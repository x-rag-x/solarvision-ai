"""
SolarVision AI — Model 3: Predictive Quality Analysis
Data Partitioning Strategies: Time-Aware Chronological and Stratified Splitting
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


@dataclass(frozen=True)
class PartitionSummary:
    name: str
    total_samples: int
    pass_count: int
    fail_count: int
    failure_rate_pct: float
    min_timestamp: Optional[str] = None
    max_timestamp: Optional[str] = None


@dataclass
class DatasetSplits:
    X_train: np.ndarray
    y_train: np.ndarray
    X_val: np.ndarray
    y_val: np.ndarray
    X_test: np.ndarray
    y_test: np.ndarray
    split_strategy: str
    train_summary: PartitionSummary
    val_summary: PartitionSummary
    test_summary: PartitionSummary


class QualityDataSplitter:
    """
    Provides reproducible, leakage-free data partitioning for tabular sensor benchmarks.
    """

    @staticmethod
    def _create_summary(
        name: str, y: np.ndarray, timestamps: Optional[List[datetime]] = None
    ) -> PartitionSummary:
        n_samples = len(y)
        n_fail = int(np.sum(y == 1))
        n_pass = int(np.sum(y == 0))
        fail_pct = (n_fail / max(n_samples, 1)) * 100.0

        min_ts = None
        max_ts = None
        if timestamps and len(timestamps) > 0:
            sorted_ts = sorted(timestamps)
            min_ts = sorted_ts[0].isoformat()
            max_ts = sorted_ts[-1].isoformat()

        return PartitionSummary(
            name=name,
            total_samples=n_samples,
            pass_count=n_pass,
            fail_count=n_fail,
            failure_rate_pct=round(fail_pct, 2),
            min_timestamp=min_ts,
            max_timestamp=max_ts,
        )

    @classmethod
    def chronological_split(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        timestamps: List[datetime],
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
    ) -> DatasetSplits:
        """
        Partitions dataset strictly by chronological timestamp.
        Guarantees: max(t_train) <= min(t_val) and max(t_val) <= min(t_test).
        """
        n_samples = len(y)
        if len(timestamps) != n_samples or len(X) != n_samples:
            raise ValueError("Mismatched lengths among X, y, and timestamps.")

        # Sort indices by timestamp
        order = sorted(range(n_samples), key=lambda i: timestamps[i])
        idx_train_end = int(n_samples * train_ratio)
        idx_val_end = int(n_samples * (train_ratio + val_ratio))

        train_indices = order[:idx_train_end]
        val_indices = order[idx_train_end:idx_val_end]
        test_indices = order[idx_val_end:]

        # Leakage verification: disjoint index sets
        s_train, s_val, s_test = set(train_indices), set(val_indices), set(test_indices)
        assert len(s_train.intersection(s_val)) == 0, "Leakage detected between train and val!"
        assert len(s_train.intersection(s_test)) == 0, "Leakage detected between train and test!"
        assert len(s_val.intersection(s_test)) == 0, "Leakage detected between val and test!"

        # Temporal order assertion
        t_train_max = max(timestamps[i] for i in train_indices)
        t_val_min = min(timestamps[i] for i in val_indices)
        t_val_max = max(timestamps[i] for i in val_indices)
        t_test_min = min(timestamps[i] for i in test_indices)

        assert t_train_max <= t_val_min, "Chronological order violation: train overlaps val!"
        assert t_val_max <= t_test_min, "Chronological order violation: val overlaps test!"

        return DatasetSplits(
            X_train=X[train_indices],
            y_train=y[train_indices],
            X_val=X[val_indices],
            y_val=y[val_indices],
            X_test=X[test_indices],
            y_test=y[test_indices],
            split_strategy="time_aware_chronological",
            train_summary=cls._create_summary("train", y[train_indices], [timestamps[i] for i in train_indices]),
            val_summary=cls._create_summary("val", y[val_indices], [timestamps[i] for i in val_indices]),
            test_summary=cls._create_summary("test", y[test_indices], [timestamps[i] for i in test_indices]),
        )

    @classmethod
    def stratified_split(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        random_state: int = 42,
        timestamps: Optional[List[datetime]] = None,
    ) -> DatasetSplits:
        """
        Partitions dataset preserving class balance (stratification) across all splits.
        """
        rng = np.random.RandomState(random_state)
        n_samples = len(y)

        train_indices: List[int] = []
        val_indices: List[int] = []
        test_indices: List[int] = []

        # Stratify per class
        for c in (0, 1):
            c_indices = np.where(y == c)[0]
            rng.shuffle(c_indices)

            n_c = len(c_indices)
            n_train_c = int(n_c * train_ratio)
            n_val_c = int(n_c * val_ratio)

            train_indices.extend(c_indices[:n_train_c])
            val_indices.extend(c_indices[n_train_c : n_train_c + n_val_c])
            test_indices.extend(c_indices[n_train_c + n_val_c :])

        # Convert to numpy arrays
        train_idx = np.array(train_indices, dtype=np.int64)
        val_idx = np.array(val_indices, dtype=np.int64)
        test_idx = np.array(test_indices, dtype=np.int64)

        # Shuffle each split so classes are mixed
        rng.shuffle(train_idx)
        rng.shuffle(val_idx)
        rng.shuffle(test_idx)

        # Leakage assertions
        assert len(set(train_idx).intersection(set(val_idx))) == 0
        assert len(set(train_idx).intersection(set(test_idx))) == 0
        assert len(set(val_idx).intersection(set(test_idx))) == 0

        ts_train = [timestamps[i] for i in train_idx] if timestamps else None
        ts_val = [timestamps[i] for i in val_idx] if timestamps else None
        ts_test = [timestamps[i] for i in test_idx] if timestamps else None

        strategy_name = (
            "stratified_random"
            if (abs(train_ratio - 0.70) < 1e-4 and abs(val_ratio - 0.15) < 1e-4)
            else f"stratified_random_{int(train_ratio*100)}_{int(val_ratio*100)}_{int(round((1-train_ratio-val_ratio)*100))}"
        )

        return DatasetSplits(
            X_train=X[train_idx],
            y_train=y[train_idx],
            X_val=X[val_idx],
            y_val=y[val_idx],
            X_test=X[test_idx],
            y_test=y[test_idx],
            split_strategy=strategy_name,
            train_summary=cls._create_summary("train", y[train_idx], ts_train),
            val_summary=cls._create_summary("val", y[val_idx], ts_val),
            test_summary=cls._create_summary("test", y[test_idx], ts_test),
        )

    @classmethod
    def stratified_split_80_20(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        random_state: int = 42,
        timestamps: Optional[List[datetime]] = None,
    ) -> DatasetSplits:
        """
        Reconciled 80/20 split: 80% Development (64% Train, 16% Val) and 20% Held-Out Test.
        Provides a strictly held-out 20% test partition (314 samples) while retaining an internal
        16% validation partition (251 samples) for zero-leakage threshold selection.
        """
        return cls.stratified_split(
            X,
            y,
            train_ratio=0.64,
            val_ratio=0.16,
            random_state=random_state,
            timestamps=timestamps,
        )

    @classmethod
    def chronological_split_80_20(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        timestamps: List[datetime],
    ) -> DatasetSplits:
        """
        Reconciled 80/20 Chronological split: 80% Development (64% Train, 16% Val) and 20% Test.
        """
        return cls.chronological_split(
            X,
            y,
            timestamps=timestamps,
            train_ratio=0.64,
            val_ratio=0.16,
        )
