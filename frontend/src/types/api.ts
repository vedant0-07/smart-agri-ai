// API types for the Smart Agriculture application

export interface ModelStatus {
  model_id: string;
  display_name: string;
  status: 'not_loaded' | 'loading' | 'loaded' | 'error';
  error: string | null;
  filename: string | null;
  task_type: string | null;
  input_details: TensorDetail[];
  output_details: TensorDetail[];
}

export interface TensorDetail {
  name: string;
  shape: number[];
  dtype: string;
  quantization: {
    scales: number[];
    zero_points: number[];
  };
}

export interface TopKPrediction {
  rank: number;
  class_index: number;
  label: string;
  confidence: number;
  confidence_percent: number;
}

export interface ClassificationResult {
  top_prediction: TopKPrediction;
  top_k_predictions: TopKPrediction[];
  all_logits: number[];
  all_probabilities: number[];
}

export interface BinaryResult {
  task_type: 'binary';
  raw_dequantized: number;
  sigmoid_probability: number;
  prediction: string;
  confidence_percent: number;
  irrigate: boolean;
}

export interface PredictionResponse {
  prediction_id: number;
  model: string;
  inference_time_ms: number;
  result: ClassificationResult | BinaryResult;
  recommendation?: string | Record<string, string>;
  recommendation_text?: string;
  guidance?: IrrigationGuidance;
  report_url: string;
  timestamp: string;
}

export interface IrrigationGuidance {
  message: string;
  actions: string[];
}

export interface HistoryRecord {
  id: number;
  created_at: string;
  model_id: string;
  model_display_name: string;
  task_type: string;
  input_summary: Record<string, string>;
  predicted_label: string;
  confidence_percent: number | null;
  top_k_predictions: TopKPrediction[];
  report_url: string | null;
  inference_success: boolean;
  error_message: string | null;
}

export interface HistoryResponse {
  total: number;
  offset: number;
  limit: number;
  records: HistoryRecord[];
}

export interface ModelConfig {
  model_id: string;
  status: string;
  config: {
    display_name: string;
    description: string;
    labels?: string[];
    soil_type_categories?: string[];
    crop_type_categories?: string[];
    fertilizer_recommendations?: Record<string, FertilizerRec>;
    disease_recommendations?: Record<string, string>;
    pest_recommendations?: Record<string, string>;
    irrigation_guidance?: Record<string, IrrigationGuidance>;
    evaluation?: {
      accuracy: number | null;
      dataset: string;
      date: string | null;
      note: string;
    };
  };
}

export interface FertilizerRec {
  application_rate: string;
  timing: string;
  caution: string;
  nutrient: string;
}

export type ModelId = 'pest_detection' | 'fertilizer' | 'irrigation' | 'plant_disease';
