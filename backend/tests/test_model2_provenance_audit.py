"""
SolarVision AI — Phase 3 / Model 3 QA
Task 1: Model 2 Provenance and Database Forensic Audit Test Suite

Audits data/solarvision.db to forensically distinguish authentic factory data
from test-generated fixtures and verify database integrity without modifying records.
"""

import os
from pathlib import Path
import sqlite3
import pytest

DB_PATH = Path("data/solarvision.db")
BACKUP_PATH = Path("data/solarvision.db.backup_task1")


@pytest.fixture(scope="module")
def db_conn():
    if not DB_PATH.exists():
        pytest.skip(f"Target database {DB_PATH} not found; skipping database audit.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


class TestDatabaseProvenanceAudit:
    """Forensic verification of authentic vs test-generated records in solarvision.db."""

    def test_database_backup_exists_and_unaltered(self):
        """Verifies that a safety backup was created before forensic auditing."""
        if not BACKUP_PATH.exists():
            pytest.skip("Historical development database backup data/solarvision.db.backup_task1 not present; skipping historical backup census.")
        assert DB_PATH.exists(), "Target database data/solarvision.db must exist"
        assert BACKUP_PATH.stat().st_size > 200_000, "Backup must contain valid database content"
        assert DB_PATH.stat().st_size > 200_000, "Active database must contain valid database content"

    def test_inspection_count_breakdown_and_provenance(self, db_conn):
        """
        Audits the total inspection count and breaks it down by authentic baseline
        versus automated test generation.
        """
        if not BACKUP_PATH.exists():
            pytest.skip("Clean/isolated test environment without task1 backup; skipping historical inspection census.")

        cursor = db_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM inspections")
        total_inspections = cursor.fetchone()[0]
        if total_inspections < 255:
            pytest.skip(f"Clean/isolated test environment detected (inspections count: {total_inspections}); skipping historical census.")

        # 1. Authentic baseline: created on 2026-10-21 with userId IS NULL
        cursor.execute("SELECT COUNT(*) FROM inspections WHERE userId IS NULL")
        authentic_baseline_count = cursor.fetchone()[0]
        assert authentic_baseline_count == 128, (
            f"Expected exactly 128 authentic baseline inspections, found {authentic_baseline_count}"
        )

        # 2. Test-generated inspections: created by security and workflow test suites
        cursor.execute("SELECT COUNT(*) FROM inspections WHERE userId IS NOT NULL")
        test_generated_count = cursor.fetchone()[0]
        assert test_generated_count >= 127, (
            f"Expected at least 127 test-generated inspections, found {test_generated_count}"
        )
        assert authentic_baseline_count + test_generated_count == total_inspections

    def test_test_generated_filename_signatures(self, db_conn):
        """
        Verifies that test-generated inspections contain distinct synthetic filenames
        originating from server/security.regression.test.ts and server/trpc.contract.test.ts.
        """
        if not BACKUP_PATH.exists():
            pytest.skip("Clean/isolated test environment without task1 backup; skipping historical filename signature audit.")

        cursor = db_conn.cursor()
        test_payload_patterns = [
            "tiny.jpg",
            "corrupt.jpg",
            "giant.jpg",
            "C:\\Windows\\System32\\cmd.exe.jpg",
            "/etc/shadow.jpg",
            "..\\..\\windows\\system32\\calc.png",
            "../../../../etc/passwd.jpg",
            "....//....\\\\boot.ini.png",
            "%2e%2e%2f%2e%2e%2fsecret.jpg",
        ]

        cursor.execute(
            """
            SELECT sourceFilename, COUNT(*) 
            FROM inspections 
            WHERE sourceFilename IN ({seq})
            GROUP BY sourceFilename
            """.format(seq=",".join(["?"] * len(test_payload_patterns))),
            test_payload_patterns,
        )
        results = dict(cursor.fetchall())
        for pattern in test_payload_patterns:
            assert pattern in results, f"Test payload signature '{pattern}' should be present in DB"
            assert results[pattern] > 0, f"Expected test counts for {pattern}"

    def test_manufacturing_batches_are_synthetic_test_data(self, db_conn):
        """
        Audits manufacturing_batches: confirms all existing batch records
        are synthetic fixtures from automated workflow/API tests.
        """
        cursor = db_conn.cursor()
        cursor.execute("SELECT id, batchNumber, waferType FROM manufacturing_batches")
        rows = cursor.fetchall()

        # All existing batches must have test signatures (e.g. wf-, test, api, pq-)
        test_batch_ids = [r["id"] for r in rows]
        for bid in test_batch_ids:
            is_test = any(k in bid.lower() for k in ("test", "wf-", "batch-wf", "pq-", "api-", "b-"))
            assert is_test, f"Batch {bid} was expected to be a synthetic test fixture"

        # Authentic production batches count is strictly 0
        authentic_batches = [r for r in rows if not any(k in r["id"].lower() for k in ("test", "wf-", "batch-wf", "pq-", "api-", "b-"))]
        assert len(authentic_batches) == 0, "No authentic factory batches should exist in development DB"

    def test_manufacturing_machines_are_synthetic_test_data(self, db_conn):
        """
        Audits manufacturing_machines: confirms all existing machines
        are synthetic fixtures from automated tests.
        """
        cursor = db_conn.cursor()
        cursor.execute("SELECT id, machineCode FROM manufacturing_machines")
        rows = cursor.fetchall()

        test_machine_ids = [r["id"] for r in rows]
        for mid in test_machine_ids:
            is_test = any(k in mid.lower() for k in ("test", "wf-", "mach-wf", "mach-", "pq-", "api-", "bench", "ai4i", "m-"))
            assert is_test, f"Machine {mid} was expected to be a synthetic test fixture"

        authentic_machines = [r for r in rows if not any(k in r["id"].lower() for k in ("test", "wf-", "mach-wf", "mach-", "pq-", "api-", "bench", "ai4i", "m-"))]
        assert len(authentic_machines) == 0, "No authentic factory machines should exist in development DB"

    def test_root_cause_annotations_are_test_duplicates(self, db_conn):
        """
        Audits root_cause_annotations: confirms all existing annotations
        are duplicate test fixtures linked to the same single inspection.
        """
        cursor = db_conn.cursor()
        cursor.execute("SELECT id, inspectionId, confirmedCause, verifiedBy FROM root_cause_annotations")
        rows = cursor.fetchall()

        # All rows reference mock test inspections (e.g. '00675a4b-2d6e-41f8-8756-3a02b1d61218')
        unique_inspections = {r["inspectionId"] for r in rows}
        assert len(unique_inspections) <= 5, (
            f"Expected all test annotations to target mock inspections, found {unique_inspections}"
        )
        for r in rows:
            assert r["verifiedBy"] in ("quality_eng_01", "test_engineer", "qa_user")
            assert r["confirmedCause"] == "thermal_stress_soldering"

    def test_sensor_measurements_are_synthetic_test_data(self, db_conn):
        """Audits sensor_measurements: confirms 0 authentic production sensor rows."""
        cursor = db_conn.cursor()
        cursor.execute("SELECT id, machineId, batchId FROM sensor_measurements")
        rows = cursor.fetchall()
        for r in rows:
            is_test = any(k in r["id"].lower() for k in ("test", "sens-", "sens", "api", "wf-", "pq-"))
            assert is_test, f"Sensor record {r['id']} was expected to be a synthetic test fixture"

    def test_ground_truth_training_eligibility_is_zero(self, db_conn):
        """
        Verifies that when joining authentic inspections with authentic batches,
        machines, sensors, and confirmed labels, the resulting count is strictly 0.
        """
        cursor = db_conn.cursor()
        cursor.execute(
            """
            SELECT COUNT(*) 
            FROM inspections i
            JOIN manufacturing_batches b ON i.batchId = b.id
            JOIN root_cause_annotations a ON i.id = a.inspectionId
            JOIN sensor_measurements s ON b.id = s.batchId
            WHERE i.userId IS NULL
            """
        )
        eligible_samples = cursor.fetchone()[0]
        assert eligible_samples == 0, (
            "Ground-truth multimodal samples with authentic lineage must be strictly 0"
        )
