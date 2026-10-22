"""
Tests for Model 2 Data Import Contract & Schema Templates.
"""

from __future__ import annotations

import pytest
from backend.root_cause_data.import_contract import ImportContractValidator, TEMPLATES_DIR


class TestImportContractTemplates:
    """Verifies that all 6 import template CSVs exist and have valid headers."""

    @pytest.mark.parametrize(
        "entity_name",
        [
            "batches",
            "machines",
            "sensor_readings",
            "production_events",
            "root_cause_annotations",
            "inspection_batch_links",
        ],
    )
    def test_template_file_exists_and_validates(self, entity_name: str):
        template_path = ImportContractValidator.get_template_path(entity_name)
        assert template_path.exists(), f"Template missing: {template_path}"

        report = ImportContractValidator.validate_csv(entity_name, template_path)
        # Template has headers and comments, 0 data rows, so missing_required_columns must be empty
        assert len(report.missing_required_columns) == 0, (
            f"Missing required columns in template '{entity_name}': {report.missing_required_columns}"
        )
        assert len(report.unexpected_columns) == 0, (
            f"Unexpected columns in template '{entity_name}': {report.unexpected_columns}"
        )
        assert report.is_valid
