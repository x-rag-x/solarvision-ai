/** Only used after a complete single-cell EL crop has been prepared. */
export interface Model2ScreeningResult {
  model_id: 'solarvision_m2_elpv_binary_v1';
  predicted_class: 'healthy' | 'defective';
  defective_probability: number;
  threshold: number;
  requires_manual_review: true;
  decision: 'screening_only';
  review_status: 'pending';
  input_scope: 'complete_single_cell_EL_image';
  warning: string;
}
/** The Node/tRPC backend should make authenticated requests to the Python API.
    Do not bypass existing auth by calling an unauthenticated public Python URL. */
export function model2ScreeningSummary(result: Model2ScreeningResult): string {
  const pct = (result.defective_probability * 100).toFixed(2);
  const label = result.predicted_class === 'defective' ? 'Predicted Defective' : 'Predicted Healthy';
  return `${label} (${result.predicted_class}, defective score ${pct}%) — manual review required`;
}
