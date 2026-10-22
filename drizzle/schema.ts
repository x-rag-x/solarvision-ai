import { boolean, double, float, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const inspections = mysqlTable("inspections", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull().unique(),
  userId: varchar("userId", { length: 64 }),
  batchId: varchar("batchId", { length: 64 }),
  machineId: varchar("machineId", { length: 64 }),
  modelVersionId: varchar("modelVersionId", { length: 64 }),
  operatorId: varchar("operatorId", { length: 64 }),
  isFlagged: boolean("isFlagged").default(false).notNull(),
  sourceFilename: varchar("sourceFilename", { length: 255 }).notNull(),
  modelName: varchar("modelName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["completed", "failed"]).notNull(),
  processingTimeMs: float("processingTimeMs").notNull(),
  inputImageUrl: text("inputImageUrl"),
  annotatedImageUrl: text("annotatedImageUrl"),
  detectionsCount: int("detectionsCount").notNull().default(0),
  persistenceStatus: varchar("persistenceStatus", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const detections = mysqlTable("detections", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  defectType: varchar("defectType", { length: 128 }).notNull(),
  confidence: float("confidence").notNull(),
  x1: float("x1").notNull(),
  y1: float("y1").notNull(),
  x2: float("x2").notNull(),
  y2: float("y2").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Future AI Models & Industry 4.0 Infrastructure Schema

export const modelVersions = mysqlTable("model_versions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  modelName: varchar("modelName", { length: 128 }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  framework: varchar("framework", { length: 64 }).notNull(),
  artifactUri: text("artifactUri"),
  metrics: json("metrics"),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const manufacturingBatches = mysqlTable("manufacturing_batches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  batchNumber: varchar("batchNumber", { length: 64 }).notNull().unique(),
  waferType: varchar("waferType", { length: 64 }).notNull(),
  cellLine: varchar("cellLine", { length: 64 }).notNull(),
  targetQuantity: int("targetQuantity").notNull(),
  actualQuantity: int("actualQuantity").default(0).notNull(),
  status: varchar("status", { length: 32 }).default("in_progress").notNull(),
  startTime: timestamp("startTime").defaultNow().notNull(),
  endTime: timestamp("endTime"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const manufacturingMachines = mysqlTable("manufacturing_machines", {
  id: varchar("id", { length: 64 }).primaryKey(),
  machineCode: varchar("machineCode", { length: 64 }).notNull().unique(),
  machineType: varchar("machineType", { length: 64 }).notNull(),
  lineId: varchar("lineId", { length: 64 }).notNull(),
  location: varchar("location", { length: 128 }),
  status: varchar("status", { length: 32 }).default("operational").notNull(),
  lastMaintenanceAt: timestamp("lastMaintenanceAt"),
  nextMaintenanceDue: timestamp("nextMaintenanceDue"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sensorMeasurements = mysqlTable("sensor_measurements", {
  id: varchar("id", { length: 64 }).primaryKey(),
  machineId: varchar("machineId", { length: 64 }).notNull(),
  batchId: varchar("batchId", { length: 64 }),
  sensorType: varchar("sensorType", { length: 64 }).notNull(),
  measurementValue: double("measurementValue").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  isAnomaly: boolean("isAnomaly").default(false).notNull(),
  anomalyScore: float("anomalyScore"),
  recordedAt: timestamp("recordedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const productionEvents = mysqlTable("production_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  machineId: varchar("machineId", { length: 64 }),
  batchId: varchar("batchId", { length: 64 }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  severity: varchar("severity", { length: 32 }).default("info").notNull(),
  message: text("message").notNull(),
  details: json("details"),
  startedAt: timestamp("startedAt").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const rootCausePredictions = mysqlTable("root_cause_predictions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  defectId: int("defectId"),
  modelVersionId: varchar("modelVersionId", { length: 64 }),
  predictedCause: varchar("predictedCause", { length: 128 }).notNull(),
  confidence: float("confidence").notNull(),
  featureImportance: json("featureImportance"),
  contributingFactors: json("contributingFactors"),
  recommendedAction: text("recommendedAction"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const predictiveQualityForecasts = mysqlTable("predictive_quality_forecasts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  batchId: varchar("batchId", { length: 64 }),
  machineId: varchar("machineId", { length: 64 }),
  waferId: varchar("waferId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  modelVersionId: varchar("modelVersionId", { length: 64 }),
  modelVersion: varchar("modelVersion", { length: 64 }),
  domain: varchar("domain", { length: 64 }).default("solar_cell_manufacturing").notNull(),
  isBenchmark: boolean("isBenchmark").default(false).notNull(),
  dataSource: varchar("dataSource", { length: 64 }),
  provenance: varchar("provenance", { length: 128 }),
  qualityOutcome: varchar("qualityOutcome", { length: 32 }).default("unknown").notNull(),
  riskLevel: varchar("riskLevel", { length: 32 }).default("low").notNull(),
  failureProbability: float("failureProbability"),
  predictedDefectRate: float("predictedDefectRate"),
  predictedYield: float("predictedYield"),
  confidence: float("confidence"),
  confidenceIntervalLow: float("confidenceIntervalLow"),
  confidenceIntervalHigh: float("confidenceIntervalHigh"),
  confidenceInterval: text("confidenceInterval"),
  forecastHorizonHours: int("forecastHorizonHours").default(24),
  forecastHorizon: text("forecastHorizon"),
  dominantRiskDefect: text("dominantRiskDefect"),
  predictedLossPercentage: float("predictedLossPercentage"),
  topRiskFactors: json("topRiskFactors"),
  factors: json("factors"),
  probabilities: json("probabilities"),
  inputReference: text("inputReference"),
  recommendedAction: text("recommendedAction"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  generatedAt: timestamp("generatedAt"),
});

export const maintenancePredictions = mysqlTable("maintenance_predictions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  machineId: varchar("machineId", { length: 64 }).notNull(),
  modelVersionId: varchar("modelVersionId", { length: 64 }),
  componentName: varchar("componentName", { length: 128 }).notNull(),
  remainingUsefulLifeHours: float("remainingUsefulLifeHours").notNull(),
  failureProbability: float("failureProbability").notNull(),
  urgency: varchar("urgency", { length: 32 }).default("routine").notNull(),
  recommendedServiceDate: timestamp("recommendedServiceDate"),
  explanation: text("explanation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const alertRecords = mysqlTable("alert_records", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceId: varchar("sourceId", { length: 128 }).notNull(),
  severity: varchar("severity", { length: 32 }).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  acknowledgedBy: varchar("acknowledgedBy", { length: 64 }),
  acknowledgedAt: timestamp("acknowledgedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;
export type Detection = typeof detections.$inferSelect;
export type InsertDetection = typeof detections.$inferInsert;

export type ModelVersion = typeof modelVersions.$inferSelect;
export type InsertModelVersion = typeof modelVersions.$inferInsert;
export type ManufacturingBatch = typeof manufacturingBatches.$inferSelect;
export type InsertManufacturingBatch = typeof manufacturingBatches.$inferInsert;
export type ManufacturingMachine = typeof manufacturingMachines.$inferSelect;
export type InsertManufacturingMachine = typeof manufacturingMachines.$inferInsert;
export type SensorMeasurement = typeof sensorMeasurements.$inferSelect;
export type InsertSensorMeasurement = typeof sensorMeasurements.$inferInsert;
export type ProductionEvent = typeof productionEvents.$inferSelect;
export type InsertProductionEvent = typeof productionEvents.$inferInsert;
export type RootCausePrediction = typeof rootCausePredictions.$inferSelect;
export type InsertRootCausePrediction = typeof rootCausePredictions.$inferInsert;
export type PredictiveQualityForecast = typeof predictiveQualityForecasts.$inferSelect;
export type InsertPredictiveQualityForecast = typeof predictiveQualityForecasts.$inferInsert;
export type MaintenancePrediction = typeof maintenancePredictions.$inferSelect;
export type InsertMaintenancePrediction = typeof maintenancePredictions.$inferInsert;
export type AlertRecord = typeof alertRecords.$inferSelect;
export type InsertAlertRecord = typeof alertRecords.$inferInsert;
