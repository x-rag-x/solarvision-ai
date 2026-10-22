"""
SolarVision AI — Model 2: Manufacturing Root Cause Analysis
Command-Line Interface for Data Onboarding & Schema Validation

Usage:
    python backend/root_cause_data/import_cli.py --entity batches --file data/batches.csv
    python backend/root_cause_data/import_cli.py --entity sensor_readings --file data/sensors.csv
    python backend/root_cause_data/import_cli.py --audit-history
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.root_cause_data.import_pipeline import DataOnboardingPipeline



def main() -> int:
    parser = argparse.ArgumentParser(
        description="SolarVision AI Model 2 — Data Onboarding & Ingestion CLI"
    )
    parser.add_argument(
        "--entity",
        choices=[
            "batches",
            "machines",
            "sensor_readings",
            "production_events",
            "root_cause_annotations",
            "inspection_batch_links",
        ],
        help="Entity type being imported",
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Path to CSV file matching the corresponding import template",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help="Optional path to custom SQLite database (defaults to data/solarvision.db)",
    )
    parser.add_argument(
        "--operator",
        type=str,
        default="cli_operator",
        help="Operator ID or name performing the import",
    )
    parser.add_argument(
        "--audit-history",
        action="store_true",
        help="Display the most recent 10 data onboarding audit logs",
    )

    args = parser.parse_args()
    pipeline = DataOnboardingPipeline(db_path=args.db)

    if args.audit_history:
        with pipeline.get_connection() as conn:
            rows = conn.execute("""
                SELECT id, entityType, sourceFilePath, totalRows, insertedRows, rejectedRows, status, importedBy, importedAt
                FROM import_audit_logs
                ORDER BY importedAt DESC
                LIMIT 10;
            """).fetchall()
            if not rows:
                print("No import audit logs found.")
                return 0

            print("\n=== Recent Data Onboarding Audit Logs ===")
            for r in rows:
                print(
                    f"[{r[8]}] ID: {r[0][:8]}.. | Entity: {r[1]:<22} | "
                    f"Status: {r[6]:<10} | Rows: {r[4]}/{r[3]} inserted | By: {r[7]}"
                )
            print()
            return 0

    if not args.entity or not args.file:
        parser.print_help()
        return 1

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        return 1

    print(f"\n[SolarVision Ingestion] Starting import of '{args.entity}' from {file_path}...")
    res = pipeline.import_csv(args.entity, file_path, operator_name=args.operator)

    print(f"Status:            {res.status}")
    print(f"Total Rows:        {res.total_records}")
    print(f"Inserted Rows:     {res.inserted_records}")
    print(f"Rejected Rows:     {res.rejected_records}")
    print(f"Audit Log ID:      {res.audit_id}")

    if res.errors:
        print("\nErrors / Rejection Reasons:")
        for err in res.errors[:15]:
            print(f"  • {err}")
        if len(res.errors) > 15:
            print(f"  ... and {len(res.errors) - 15} more errors.")

    return 0 if res.status == "SUCCESS" else 1


if __name__ == "__main__":
    sys.exit(main())
