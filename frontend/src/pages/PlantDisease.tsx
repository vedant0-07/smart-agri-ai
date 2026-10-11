import React from 'react';
import { Leaf, Loader2, AlertCircle, Info } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import PredictionResult from '../components/PredictionResult';
import { predictPlantDisease, getPlantDiseaseConfig } from '../utils/api';
import type { PredictionResponse, ModelConfig } from '../types/api';

export default function PlantDiseasePage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<PredictionResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<ModelConfig | null>(null);

  React.useEffect(() => {
    getPlantDiseaseConfig().then(r => setConfig(r.data)).catch(console.error);
  }, []);

  const handleFileSelect = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handlePredict = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await predictPlantDisease(file);
      setResult(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Inference failed. Please check backend connection.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const modelLoaded = config?.status === 'loaded';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-agri-900 rounded-xl flex items-center justify-center">
          <Leaf className="w-5 h-5 text-agri-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-100">Plant Disease Detection</h1>
          <p className="text-sm text-gray-500">MobileNetV2 · PlantVillage · 38 Classes · INT8</p>
        </div>
      </div>

      {config && !modelLoaded && (
        <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-4 flex items-center gap-3 text-sm text-yellow-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Model status: <strong>{config.status}</strong>. Ensure the backend is running and the model file is in the models/ directory.
        </div>
      )}

      <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 flex gap-3 text-sm text-gray-400">
        <Info className="w-4 h-4 text-agri-400 flex-shrink-0 mt-0.5" />
        <p>Upload a clear photo of a plant leaf. The model will classify it into one of 38 PlantVillage categories
          (diseases and healthy classes). Best results with well-lit, single-leaf images. Input: 192×192 RGB INT8.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="space-y-4">
          <h2 className="section-title text-base">Upload Leaf Image</h2>
          <ImageUploader
            onFileSelect={handleFileSelect}
            preview={preview}
            onClear={handleClear}
            disabled={loading}
            label="Upload Plant Leaf Photo"
            hint="JPEG, PNG, WebP or BMP · max 10 MB"
          />

          {file && (
            <div className="text-xs text-gray-500 flex justify-between">
              <span>{file.name}</span>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}

          <button
            id="disease-predict-btn"
            onClick={handlePredict}
            disabled={!file || loading || !modelLoaded}
            className="btn-primary w-full"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Leaf className="w-4 h-4" /> Diagnose Plant</>
            )}
          </button>

          {error && (
            <div className="bg-red-950/30 border border-red-900 rounded-xl p-3 flex items-start gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h2 className="section-title text-base">Diagnosis</h2>
          {result ? (
            <PredictionResult
              result={result.result}
              recommendation={result.recommendation}
              reportUrl={result.report_url}
              inferenceMs={result.inference_time_ms}
            />
          ) : (
            <div className="card p-12 text-center text-gray-600 text-sm flex flex-col items-center gap-3">
              <Leaf className="w-10 h-10 opacity-30" />
              <p>Upload a leaf image and click <strong>Diagnose Plant</strong> to run real TFLite inference.</p>
            </div>
          )}
        </div>
      </div>

      {/* Disease reference */}
      {config?.config?.labels && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-300 text-sm mb-3">
            Detectable Conditions ({config.config.labels.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
            {config.config.labels.map((label, i) => (
              <span
                key={i}
                className={`text-xs rounded px-2 py-1 truncate ${
                  label.toLowerCase().includes('healthy')
                    ? 'bg-agri-950 text-agri-400'
                    : 'bg-gray-800 text-gray-500'
                }`}
                title={label}
              >
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
