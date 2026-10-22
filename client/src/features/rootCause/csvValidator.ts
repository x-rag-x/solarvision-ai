/**
 * SolarVision AI — Phase 3B: CSV Template & Schema Validation Engine
 * 
 * Client-side validation matching backend/root_cause_data/import_contract.py.
 * Validates incoming factory CSV files against formal Model 2 schemas.
 */

import {
  ImportEntityType,
  ImportValidationReport,
  ROOT_CAUSE_TAXONOMY,
  EntityTemplateSpec,
  CsvRowError,
} from "./dataOnboardingTypes";

// ============================================================================
// TEMPLATE SPECIFICATIONS (Matching backend/root_cause_data/templates/)
// ============================================================================

export const ENTITY_TEMPLATES: Record<ImportEntityType, EntityTemplateSpec> = {
  batches: {
    entityType: "batches",
    displayName: "Manufacturing Batches",
    description: "Production lots, wafer substrate origins, target quantities, and processing status.",
    requiredColumns: ["batch_id", "batch_number", "cell_line", "target_quantity", "start_time", "status"],
    allColumns: [
      "batch_id", "batch_number", "wafer_supplier", "ingot_type", "cell_line",
      "target_quantity", "actual_quantity", "start_time", "end_time", "status"
    ],
    columnSpecs: {
      batch_id: { name: "batch_id", required: true, type: "string", description: "Unique batch identifier (UUID or lot code)" },
      batch_number: { name: "batch_number", required: true, type: "string", description: "Human-readable factory lot number (e.g. B-2026-X01)" },
      wafer_supplier: { name: "wafer_supplier", required: false, type: "string", description: "Ingot / wafer foundry vendor" },
      ingot_type: {
        name: "ingot_type",
        required: false,
        type: "enum",
        description: "Wafer crystalline architecture",
        allowedValues: ["monocrystalline_m10", "monocrystalline_g12", "perc_m6", "topcon_m10", "cast_mono", "polycrystalline"]
      },
      cellLine: { name: "cell_line", required: true, type: "string", description: "Physical cell stringer line (e.g. Line-A, Line-B)" },
      cell_line: { name: "cell_line", required: true, type: "string", description: "Physical cell stringer line (e.g. Line-A, Line-B)" },
      target_quantity: { name: "target_quantity", required: true, type: "number", description: "Planned wafer unit target count" },
      actual_quantity: { name: "actual_quantity", required: false, type: "number", description: "Actual wafer count yielded" },
      start_time: { name: "start_time", required: true, type: "datetime", description: "Fabrication run start timestamp (ISO-8601)" },
      end_time: { name: "end_time", required: false, type: "datetime", description: "Fabrication run completion timestamp (ISO-8601)" },
      status: {
        name: "status",
        required: true,
        type: "enum",
        description: "Batch quality lifecycle state",
        allowedValues: ["in_production", "completed", "quarantined", "in_progress"]
      },
    },
    sampleFilename: "batches_template.csv",
  },

  machines: {
    entityType: "machines",
    displayName: "Machines & Tools",
    description: "Physical fabrication equipment, maintenance intervals, line locations, and operational health.",
    requiredColumns: ["machine_id", "machine_code", "machine_type", "line_id", "status"],
    allColumns: [
      "machine_id", "machine_code", "machine_type", "line_id", "location",
      "status", "last_maintenance_at", "next_maintenance_due"
    ],
    columnSpecs: {
      machine_id: { name: "machine_id", required: true, type: "string", description: "Unique machine identifier (UUID)" },
      machine_code: { name: "machine_code", required: true, type: "string", description: "Shop-floor equipment tag (e.g. SP-01, STR-03)" },
      machine_type: {
        name: "machine_type",
        required: true,
        type: "enum",
        description: "Tooling process category",
        allowedValues: ["stringer", "tabber", "laminator", "screen_printer", "firing_furnace", "cell_tester", "handling_robot", "laser_cutter"]
      },
      line_id: { name: "line_id", required: true, type: "string", description: "Factory bay or production line ID" },
      location: { name: "location", required: false, type: "string", description: "Physical facility bay coordinates" },
      status: {
        name: "status",
        required: true,
        type: "enum",
        description: "Equipment operational condition",
        allowedValues: ["running", "idle", "maintenance", "alarm", "offline", "operational", "degraded"]
      },
      last_maintenance_at: { name: "last_maintenance_at", required: false, type: "datetime", description: "Last preventive maintenance service date (ISO-8601)" },
      next_maintenance_due: { name: "next_maintenance_due", required: false, type: "datetime", description: "Next scheduled calibration date (ISO-8601)" },
    },
    sampleFilename: "machines_template.csv",
  },

  sensor_readings: {
    entityType: "sensor_readings",
    displayName: "Sensor Telemetry",
    description: "Continuous SCADA telemetry: furnace temperature curves, squeegee pressures, vacuums, and ribbon tensions.",
    requiredColumns: ["id", "machine_id", "sensor_type", "measurement_value", "unit", "recorded_at"],
    allColumns: [
      "id", "machine_id", "batch_id", "sensor_type", "measurement_value", "unit",
      "is_anomaly", "anomaly_score", "recorded_at"
    ],
    columnSpecs: {
      id: { name: "id", required: true, type: "string", description: "Unique telemetry record UUID" },
      machine_id: { name: "machine_id", required: true, type: "string", description: "Tool generating this measurement" },
      batch_id: { name: "batch_id", required: false, type: "string", description: "Manufacturing batch in station during measurement" },
      sensor_type: { name: "sensor_type", required: true, type: "string", description: "Physical sensor channel name (e.g. soldering_temp_top_c)" },
      measurement_value: { name: "measurement_value", required: true, type: "number", description: "Floating point sensor reading" },
      unit: { name: "unit", required: true, type: "string", description: "Engineering physical unit (e.g. C, N/cm2, mbar, N)" },
      is_anomaly: { name: "is_anomaly", required: false, type: "boolean", description: "Boolean flag (0/1 or true/false) indicating deviation" },
      anomaly_score: { name: "anomaly_score", required: false, type: "number", description: "Normalized anomaly severity score (0.0 to 1.0)" },
      recorded_at: { name: "recorded_at", required: true, type: "datetime", description: "Sensor reading acquisition timestamp (ISO-8601 UTC)" },
    },
    sampleFilename: "sensor_readings_template.csv",
  },

  production_events: {
    entityType: "production_events",
    displayName: "Production Events & Alarms",
    description: "Equipment parameter excursions, mechanical jams, thermal overshoots, and operator overrides.",
    requiredColumns: ["id", "machine_id", "event_type", "severity", "message", "started_at"],
    allColumns: [
      "id", "machine_id", "batch_id", "event_type", "severity", "message",
      "started_at", "resolved_at"
    ],
    columnSpecs: {
      id: { name: "id", required: true, type: "string", description: "Event UUID" },
      machine_id: { name: "machine_id", required: true, type: "string", description: "Machine reporting the event" },
      batch_id: { name: "batch_id", required: false, type: "string", description: "Active batch during event occurrence" },
      event_type: { name: "event_type", required: true, type: "string", description: "Category code (e.g. thermal_drift, vacuum_loss, mechanical_jam)" },
      severity: {
        name: "severity",
        required: true,
        type: "enum",
        description: "Alarm priority level",
        allowedValues: ["info", "warning", "high", "critical", "low", "medium"]
      },
      message: { name: "message", required: true, type: "string", description: "Detailed alarm description or operator note" },
      started_at: { name: "started_at", required: true, type: "datetime", description: "Alarm onset timestamp (ISO-8601)" },
      resolved_at: { name: "resolved_at", required: false, type: "datetime", description: "Alarm clearance timestamp (ISO-8601)" },
    },
    sampleFilename: "production_events_template.csv",
  },

  root_cause_annotations: {
    entityType: "root_cause_annotations",
    displayName: "Confirmed Root-Cause Annotations",
    description: "Quality engineering & failure analysis lab confirmed ground-truth causes.",
    requiredColumns: ["id", "inspection_id", "confirmed_cause", "confidence_level", "verified_by", "verified_at"],
    allColumns: [
      "id", "inspection_id", "defect_id", "confirmed_cause", "confidence_level",
      "verified_by", "verified_at", "investigation_notes"
    ],
    columnSpecs: {
      id: { name: "id", required: true, type: "string", description: "Annotation record UUID" },
      inspection_id: { name: "inspection_id", required: true, type: "string", description: "Model 1 inspection UUID with optical defect" },
      defect_id: { name: "defect_id", required: false, type: "number", description: "Specific defect row ID in detections table" },
      confirmed_cause: {
        name: "confirmed_cause",
        required: true,
        type: "enum",
        description: "Verified manufacturing root cause from official taxonomy",
        allowedValues: [...ROOT_CAUSE_TAXONOMY]
      },
      confidence_level: {
        name: "confidence_level",
        required: true,
        type: "enum",
        description: "Verification rigor",
        allowedValues: ["confirmed", "probable", "investigative"]
      },
      verified_by: { name: "verified_by", required: true, type: "string", description: "Quality engineer or FA lab specialist identifier" },
      verified_at: { name: "verified_at", required: true, type: "datetime", description: "Verification completion timestamp (ISO-8601)" },
      investigation_notes: { name: "investigation_notes", required: false, type: "string", description: "Detailed physical failure analysis findings" },
    },
    sampleFilename: "root_cause_annotations_template.csv",
  },

  inspection_batch_links: {
    entityType: "inspection_batch_links",
    displayName: "Inspection-to-Batch Links",
    description: "Lineage mappings associating Model 1 inspection UUIDs with physical batches and machines.",
    requiredColumns: ["inspection_id", "batch_id", "machine_id", "recorded_at"],
    allColumns: ["inspection_id", "batch_id", "machine_id", "wafer_position", "recorded_at"],
    columnSpecs: {
      inspection_id: { name: "inspection_id", required: true, type: "string", description: "Model 1 optical inspection UUID" },
      batch_id: { name: "batch_id", required: true, type: "string", description: "Manufacturing batch code or UUID" },
      machine_id: { name: "machine_id", required: true, type: "string", description: "Tool station where cell was inspected" },
      wafer_position: { name: "wafer_position", required: false, type: "string", description: "Module matrix coordinate (e.g. Row 2, Col 4)" },
      recorded_at: { name: "recorded_at", required: true, type: "datetime", description: "Processing timestamp (ISO-8601)" },
    },
    sampleFilename: "inspection_batch_links_template.csv",
  },
};

// ============================================================================
// TEMPLATE CSV GENERATOR
// ============================================================================

export function generateTemplateCsv(entityType: ImportEntityType): string {
  const spec = ENTITY_TEMPLATES[entityType];
  if (!spec) return "";

  const comments = [
    `# SolarVision AI — Model 2 Data Import Template: ${spec.displayName}`,
    `# Contract Version: 2.0.0`,
    `# Description: ${spec.description}`,
    `# Required Fields: ${spec.requiredColumns.join(", ")}`,
  ];

  if (entityType === "batches") {
    comments.push("# Status Values: in_production | completed | quarantined");
    comments.push("# Ingot Types: monocrystalline_m10 | monocrystalline_g12 | perc_m6 | topcon_m10 | cast_mono | polycrystalline");
  } else if (entityType === "machines") {
    comments.push("# Status Values: running | idle | maintenance | alarm | offline");
    comments.push("# Machine Types: stringer | tabber | laminator | screen_printer | firing_furnace | cell_tester | handling_robot | laser_cutter");
  } else if (entityType === "production_events") {
    comments.push("# Severity Values: info | warning | high | critical");
  } else if (entityType === "root_cause_annotations") {
    comments.push(`# Permitted confirmed_cause values: ${ROOT_CAUSE_TAXONOMY.join(" | ")}`);
    comments.push("# Confidence Values: confirmed | probable | investigative");
  }

  comments.push("# Timestamp format: ISO-8601 UTC (e.g., 2026-10-22T08:30:00.000Z)");

  const header = spec.allColumns.join(",");
  return `${comments.join("\n")}\n${header}\n`;
}

// ============================================================================
// CLIENT-SIDE CSV PARSER & VALIDATOR
// ============================================================================

export function parseAndValidateCsv(
  entityType: ImportEntityType,
  csvText: string,
  filename: string = "uploaded.csv"
): ImportValidationReport {
  const spec = ENTITY_TEMPLATES[entityType];
  const report: ImportValidationReport = {
    entityType,
    filename,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    missingRequiredColumns: [],
    unexpectedColumns: [],
    rowErrors: [],
    parsedRows: [],
    rejectedRows: [],
    isValid: false,
    validatedAt: new Date().toISOString(),
  };

  if (!spec) {
    report.rowErrors.push({
      rowNumber: 0,
      message: `Unknown entity type '${entityType}'`,
      severity: "error",
    });
    return report;
  }

  // Filter comment and empty lines
  const rawLines = csvText.split(/\r?\n/);
  const dataLines = rawLines.filter((l) => l.trim() && !l.trim().startsWith("#"));

  if (dataLines.length === 0) {
    report.rowErrors.push({
      rowNumber: 0,
      message: "The uploaded file is empty or contains only comments.",
      severity: "error",
    });
    return report;
  }

  // Parse header
  const headerLine = dataLines[0];
  const headers = parseCsvRow(headerLine).map((h) => h.trim());

  // Check required columns
  const missing = spec.requiredColumns.filter((req) => !headers.includes(req));
  if (missing.length > 0) {
    report.missingRequiredColumns = missing;
    report.rowErrors.push({
      rowNumber: 1,
      message: `Missing mandatory header columns: ${missing.join(", ")}`,
      severity: "error",
    });
  }

  // Check unexpected columns
  const allowed = new Set(spec.allColumns);
  const unexpected = headers.filter((h) => !allowed.has(h));
  if (unexpected.length > 0) {
    report.unexpectedColumns = unexpected;
  }

  // Primary key mapping for in-file duplicate detection
  const PRIMARY_KEY_MAP: Record<ImportEntityType, string> = {
    batches: "batch_id",
    machines: "machine_id",
    sensor_readings: "id",
    production_events: "id",
    root_cause_annotations: "id",
    inspection_batch_links: "inspection_id",
  };
  const pkCol = PRIMARY_KEY_MAP[entityType];
  const seenPrimaryKeys = new Map<string, number>();

  // Parse data rows
  for (let i = 1; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    report.totalRows++;
    const rowNum = i + 1; // 1-based indexing including header
    const values = parseCsvRow(line);
    const rowRecord: Record<string, string> = {};
    const parsedRow: Record<string, any> = {};
    const errorsThisRow: string[] = [];

    // Map columns
    headers.forEach((h, idx) => {
      const rawVal = values[idx] !== undefined ? values[idx].trim() : "";
      rowRecord[h] = rawVal;
    });

    // Check duplicate primary keys within the file
    if (pkCol && rowRecord[pkCol]) {
      const pkVal = rowRecord[pkCol].trim();
      if (seenPrimaryKeys.has(pkVal)) {
        const priorRow = seenPrimaryKeys.get(pkVal)!;
        errorsThisRow.push(`Duplicate primary identifier '${pkVal}': previously defined on row ${priorRow}`);
        report.rowErrors.push({
          rowNumber: rowNum,
          column: pkCol,
          message: `Duplicate primary identifier '${pkVal}': previously defined on row ${priorRow}`,
          severity: "error",
          rawValue: pkVal,
        });
      } else {
        seenPrimaryKeys.set(pkVal, rowNum);
      }
    }

    // Check required columns non-empty
    spec.requiredColumns.forEach((col) => {
      const val = rowRecord[col];
      if (val === undefined || val === "") {
        errorsThisRow.push(`Missing required field '${col}'`);
        report.rowErrors.push({
          rowNumber: rowNum,
          column: col,
          message: `Missing required field '${col}'`,
          severity: "error",
        });
      }
    });

    // Check types & enums
    headers.forEach((col) => {
      const val = rowRecord[col];
      if (val === undefined || val === "") return;

      const colSpec = spec.columnSpecs[col];
      if (!colSpec) return;

      if (colSpec.type === "number") {
        const num = Number(val);
        if (isNaN(num)) {
          errorsThisRow.push(`Field '${col}' must be a valid number, got '${val}'`);
          report.rowErrors.push({
            rowNumber: rowNum,
            column: col,
            message: `Field '${col}' must be a valid number, got '${val}'`,
            severity: "error",
            rawValue: val,
          });
        } else {
          parsedRow[col] = num;
        }
      } else if (colSpec.type === "enum" && colSpec.allowedValues) {
        const normalized = val.toLowerCase().trim();
        if (!colSpec.allowedValues.includes(normalized)) {
          errorsThisRow.push(
            `Field '${col}' value '${val}' is not in permitted list: [${colSpec.allowedValues.slice(0, 5).join(", ")}...]`
          );
          report.rowErrors.push({
            rowNumber: rowNum,
            column: col,
            message: `Field '${col}' value '${val}' is not in permitted list.`,
            severity: "error",
            rawValue: val,
          });
        } else {
          parsedRow[col] = normalized;
        }
      } else {
        parsedRow[col] = val;
      }
    });

    if (errorsThisRow.length > 0) {
      report.invalidRows++;
      report.rejectedRows.push({
        rowNumber: rowNum,
        data: rowRecord,
        errors: errorsThisRow,
      });
    } else {
      report.validRows++;
      report.parsedRows.push(parsedRow);
    }
  }

  report.isValid = report.missingRequiredColumns.length === 0 && report.invalidRows === 0 && report.totalRows > 0;
  return report;
}

/**
 * Standard CSV row parser handling quotes and commas.
 */
function parseCsvRow(rowText: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      if (inQuotes && rowText[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
