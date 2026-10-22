"""SolarVision AI — Model 2 Training Package for Manufacturing Root Cause Analysis."""

from .contract import Model2ArtifactContract, ModelMetadata
from .baseline import MajorityClassBaseline, DefectPriorHeuristicBaseline
from .tree_model import DecisionTreeClassifier, RandomForestClassifier
from .xgb_adapter import XGBoostAdapter
from .trainer import RootCauseModelTrainer

__all__ = [
    "Model2ArtifactContract",
    "ModelMetadata",
    "MajorityClassBaseline",
    "DefectPriorHeuristicBaseline",
    "DecisionTreeClassifier",
    "RandomForestClassifier",
    "XGBoostAdapter",
    "RootCauseModelTrainer",
]
