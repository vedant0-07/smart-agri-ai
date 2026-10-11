import React from 'react';
import { FlaskConical, Loader2, AlertCircle, Info } from 'lucide-react';
import PredictionResult from '../components/PredictionResult';
import { predictFertilizer, getFertilizerConfig } from '../utils/api';
import type { PredictionResponse, ModelConfig } from '../types/api';

const SOIL_TYPES = ['Black', 'Clayey', 'Loamy', 'Red', 'Sandy'];
const CROP_TYPES = ['Barley', 'Cotton', 'Ground Nuts', 'Maize', 'Millets', 'Oil Seeds', 'Paddy', 'Pulses', 'Sugarcane', 'Tobacco', 'Wheat'];

interface FormState {
  temperature: string;
  humidity: string;
  moisture: string;
  nitrogen: string;
  potassium: string;
  phosphorous: string;
  soil_type: string;
  crop_type: string;
}

const DEFAULT_FORM: FormState = {
  temperature: '26',
  humidity: '52',
  moisture: '38',
  nitrogen: '37',
  potassium: '0',
  phosphorous: '0',
  soil_type: 'Sandy',
  crop_type: 'Maize',
};

function FormField({ label, id, name, value, onChange, type = 'number', min, max, step, unit, disabled }: {
  label: string; id: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; min?: string; max?: string; step?: string; unit?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-400 mb-1">
        {label}{unit && <span className="text-gray-600 ml-1">({unit})</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step ?? '0.1'}
        disabled={disabled}
        className="input-field text-sm"
      />
    </div>
  );
}

export default function FertilizerPage() {
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<PredictionResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<ModelConfig | null>(null);

  React.useEffect(() => {
    getFertilizerConfig().then(r => setConfig(r.data)).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        temperature: parseFloat(form.temperature),
        humidity: parseFloat(form.humidity),
        moisture: parseFloat(form.moisture),
        nitrogen: parseFloat(form.nitrogen),
        potassium: parseFloat(form.potassium),
        phosphorous: parseFloat(form.phosphorous),
        soil_type: form.soil_type,
        crop_type: form.crop_type,
      };
      const res = await predictFertilizer(payload);
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
          <FlaskConical className="w-5 h-5 text-agri-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-100">Fertilizer Prediction</h1>
          <p className="text-sm text-gray-500">MLP · 33 Features · 19 Classes · INT8</p>
        </div>
      </div>

      {config && !modelLoaded && (
        <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-4 flex items-center gap-3 text-sm text-yellow-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Model status: <strong>{config.status}</strong>
        </div>
      )}

      <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 flex gap-3 text-sm text-gray-400">
        <Info className="w-4 h-4 text-agri-400 flex-shrink-0 mt-0.5" />
        <p>Enter soil and environmental parameters. Categorical inputs are one-hot encoded to build a 33-feature vector.
          The model outputs probabilities over 19 fertilizer categories. Input normalization is applied before INT8 quantization.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-5">
          <h2 className="section-title text-base">Soil & Environmental Parameters</h2>

          {/* Numerical inputs */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Soil Chemistry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Nitrogen" id="nitrogen" name="nitrogen" value={form.nitrogen} onChange={handleChange} min="0" max="140" unit="mg/kg" disabled={loading} />
              <FormField label="Potassium" id="potassium" name="potassium" value={form.potassium} onChange={handleChange} min="0" max="200" unit="mg/kg" disabled={loading} />
              <FormField label="Phosphorous" id="phosphorous" name="phosphorous" value={form.phosphorous} onChange={handleChange} min="0" max="145" unit="mg/kg" disabled={loading} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environmental Conditions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Temperature" id="temperature" name="temperature" value={form.temperature} onChange={handleChange} min="0" max="50" unit="°C" disabled={loading} />
              <FormField label="Humidity" id="humidity" name="humidity" value={form.humidity} onChange={handleChange} min="0" max="100" unit="%" disabled={loading} />
              <FormField label="Moisture" id="moisture" name="moisture" value={form.moisture} onChange={handleChange} min="0" max="100" unit="%" disabled={loading} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Soil & Crop Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="soil_type" className="block text-xs font-medium text-gray-400 mb-1">Soil Type</label>
                <select
                  id="soil_type"
                  name="soil_type"
                  value={form.soil_type}
                  onChange={handleChange}
                  disabled={loading}
                  className="select-field text-sm"
                >
                  {SOIL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="crop_type" className="block text-xs font-medium text-gray-400 mb-1">Crop Type</label>
                <select
                  id="crop_type"
                  name="crop_type"
                  value={form.crop_type}
                  onChange={handleChange}
                  disabled={loading}
                  className="select-field text-sm"
                >
                  {CROP_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button
            id="fertilizer-predict-btn"
            onClick={handlePredict}
            disabled={loading || !modelLoaded}
            className="btn-primary w-full"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Predicting…</>
            ) : (
              <><FlaskConical className="w-4 h-4" /> Recommend Fertilizer</>
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
          <h2 className="section-title text-base">Recommendation</h2>
          {result ? (
            <PredictionResult
              result={result.result}
              recommendation={result.recommendation_text ?? result.recommendation}
              reportUrl={result.report_url}
              inferenceMs={result.inference_time_ms}
            />
          ) : (
            <div className="card p-12 text-center text-gray-600 text-sm flex flex-col items-center gap-3">
              <FlaskConical className="w-10 h-10 opacity-30" />
              <p>Enter parameters and click <strong>Recommend Fertilizer</strong> to run real TFLite inference.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
