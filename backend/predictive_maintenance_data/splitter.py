"""
SolarVision AI — Model 4: Predictive Maintenance
Data Partitioning Strategies: Stratified Random and Reconciled 80/20 Splitting
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


@dataclass(frozen=True)
class PartitionSummary:
    name: str
    total_samples: int
    normal_count: int
    failure_count: int
    failure_rate_pct: float


@dataclass
class MaintenanceDatasetSplits:
    X_train: np.ndarray
    y_train: np.ndarray
    X_val: np.ndarray
    y_val: np.ndarray
    X_test: np.ndarray
    y_test: np.ndarray
    modes_train: np.ndarray
    modes_val: np.ndarray
    modes_test: np.ndarray
    split_strategy: str
    train_summary: PartitionSummary
    val_summary: PartitionSummary
    test_summary: PartitionSummary


class MaintenanceDataSplitter:
    """
    Provides reproducible, leakage-free data partitioning for the AI4I 2020 dataset.
    """

    @staticmethod
    def _create_summary(name: str, y: np.ndarray) -> PartitionSummary:
        n_samples = len(y)
        n_fail = int(np.sum(y == 1))
        n_pass = int(np.sum(y == 0))
        fail_pct = round((n_fail / max(n_samples, 1)) * 100.0, 2)

        return PartitionSummary(
            name=name,
            total_samples=n_samples,
            normal_count=n_pass,
            failure_count=n_fail,
            failure_rate_pct=fail_pct,
        )

    @classmethod
    def stratified_split(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        modes: Optional[np.ndarray] = None,
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        random_state: int = 42,
    ) -> MaintenanceDatasetSplits:
        """
        Partitions dataset preserving class balance across train, val, and test splits.
        Default 70/15/15: 7,000 train, 1,500 val, 1,500 test.
        """
        rng = np.random.RandomState(random_state)
        n_samples = len(y)

        train_indices: List[int] = []
        val_indices: List[int] = []
        test_indices: List[int] = []

        # Stratify by binary machine failure target
        for c in (0, 1):
            c_indices = np.where(y == c)[0]
            rng.shuffle(c_indices)

            n_c = len(c_indices)
            n_train_c = int(n_c * train_ratio)
            n_val_c = int(n_c * val_ratio)

            train_indices.extend(c_indices[:n_train_c])
            val_indices.extend(c_indices[n_train_c : n_train_c + n_val_c])
            test_indices.extend(c_indices[n_train_c + n_val_c :])

        train_idx = np.array(train_indices, dtype=np.int64)
        val_idx = np.array(val_indices, dtype=np.int64)
        test_idx = np.array(test_indices, dtype=np.int64)

        # Shuffle each partition so classes are intermixed
        rng.shuffle(train_idx)
        rng.shuffle(val_idx)
        rng.shuffle(test_idx)

        # Leakage verification assertions: strictly disjoint index sets
        assert len(set(train_idx).intersection(set(val_idx))) == 0, "Leakage: train and val overlap!"
        assert len(set(train_idx).intersection(set(test_idx))) == 0, "Leakage: train and test overlap!"
        assert len(set(val_idx).intersection(set(test_idx))) == 0, "Leakage: val and test overlap!"

        dummy_modes = np.zeros((n_samples, 5), dtype=np.int32) if modes is None else modes

        strategy_name = (
            "stratified_random"
            if (abs(train_ratio - 0.70) < 1e-4 and abs(val_ratio - 0.15) < 1e-4)
            else f"stratified_random_{int(train_ratio*100)}_{int(val_ratio*100)}_{int(round((1-train_ratio-val_ratio)*100))}"
        )

        return MaintenanceDatasetSplits(
            X_train=X[train_idx],
            y_train=y[train_idx],
            X_val=X[val_idx],
            y_val=y[val_idx],
            X_test=X[test_idx],
            y_test=y[test_idx],
            modes_train=dummy_modes[train_idx],
            modes_val=dummy_modes[val_idx],
            modes_test=dummy_modes[test_idx],
            split_strategy=strategy_name,
            train_summary=cls._create_summary("train", y[train_idx]),
            val_summary=cls._create_summary("val", y[val_idx]),
            test_summary=cls._create_summary("test", y[test_idx]),
        )

    @classmethod
    def stratified_split_80_20(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        modes: Optional[np.ndarray] = None,
        random_state: int = 42,
    ) -> MaintenanceDatasetSplits:
        """
        Reconciled 80/20 split: 64% Train, 16% Val, 20% Held-Out Test.
        """
        return cls.stratified_split(
            X,
            y,
            modes=modes,
            train_ratio=0.64,
            val_ratio=0.16,
            random_state=random_state,
        )
