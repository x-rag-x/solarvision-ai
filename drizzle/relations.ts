import { relations } from "drizzle-orm";
import {
  alertRecords,
  detections,
  inspections,
  maintenancePredictions,
  manufacturingBatches,
  manufacturingMachines,
  modelVersions,
  predictiveQualityForecasts,
  productionEvents,
  rootCausePredictions,
  sensorMeasurements,
} from "./schema";

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  detections: many(detections),
  batch: one(manufacturingBatches, {
    fields: [inspections.batchId],
    references: [manufacturingBatches.id],
  }),
  machine: one(manufacturingMachines, {
    fields: [inspections.machineId],
    references: [manufacturingMachines.id],
  }),
  modelVersion: one(modelVersions, {
    fields: [inspections.modelVersionId],
    references: [modelVersions.id],
  }),
  rootCausePredictions: many(rootCausePredictions),
}));

export const detectionsRelations = relations(detections, ({ one }) => ({
  inspection: one(inspections, {
    fields: [detections.inspectionId],
    references: [inspections.inspectionId],
  }),
}));

export const manufacturingBatchesRelations = relations(manufacturingBatches, ({ many }) => ({
  inspections: many(inspections),
  sensorMeasurements: many(sensorMeasurements),
  productionEvents: many(productionEvents),
  predictiveQualityForecasts: many(predictiveQualityForecasts),
}));

export const manufacturingMachinesRelations = relations(manufacturingMachines, ({ many }) => ({
  inspections: many(inspections),
  sensorMeasurements: many(sensorMeasurements),
  productionEvents: many(productionEvents),
  maintenancePredictions: many(maintenancePredictions),
}));

export const modelVersionsRelations = relations(modelVersions, ({ many }) => ({
  inspections: many(inspections),
  rootCausePredictions: many(rootCausePredictions),
  predictiveQualityForecasts: many(predictiveQualityForecasts),
  maintenancePredictions: many(maintenancePredictions),
}));

export const sensorMeasurementsRelations = relations(sensorMeasurements, ({ one }) => ({
  machine: one(manufacturingMachines, {
    fields: [sensorMeasurements.machineId],
    references: [manufacturingMachines.id],
  }),
  batch: one(manufacturingBatches, {
    fields: [sensorMeasurements.batchId],
    references: [manufacturingBatches.id],
  }),
}));

export const productionEventsRelations = relations(productionEvents, ({ one }) => ({
  machine: one(manufacturingMachines, {
    fields: [productionEvents.machineId],
    references: [manufacturingMachines.id],
  }),
  batch: one(manufacturingBatches, {
    fields: [productionEvents.batchId],
    references: [manufacturingBatches.id],
  }),
}));

export const rootCausePredictionsRelations = relations(rootCausePredictions, ({ one }) => ({
  inspection: one(inspections, {
    fields: [rootCausePredictions.inspectionId],
    references: [inspections.inspectionId],
  }),
  modelVersion: one(modelVersions, {
    fields: [rootCausePredictions.modelVersionId],
    references: [modelVersions.id],
  }),
}));

export const predictiveQualityForecastsRelations = relations(predictiveQualityForecasts, ({ one }) => ({
  batch: one(manufacturingBatches, {
    fields: [predictiveQualityForecasts.batchId],
    references: [manufacturingBatches.id],
  }),
  modelVersion: one(modelVersions, {
    fields: [predictiveQualityForecasts.modelVersionId],
    references: [modelVersions.id],
  }),
}));

export const maintenancePredictionsRelations = relations(maintenancePredictions, ({ one }) => ({
  machine: one(manufacturingMachines, {
    fields: [maintenancePredictions.machineId],
    references: [manufacturingMachines.id],
  }),
  modelVersion: one(modelVersions, {
    fields: [maintenancePredictions.modelVersionId],
    references: [modelVersions.id],
  }),
}));
