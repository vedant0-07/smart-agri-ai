import React from 'react';
import { Droplets, Loader2, AlertCircle, Info } from 'lucide-react';
import PredictionResult from '../components/PredictionResult';
import { predictIrrigation, getIrrigationConfig } from '../utils/api';
import type { PredictionResponse, ModelConfig } from '../types/api';

const CROP_TYPES = ['Wheat', 'Maize', 'Sugarcane', 'Cotton', 'Paddy', 'Barley', 'Millets', 'Other'];

interface FormState {
  crop_type: string;
  soil_moisture: string;
  temperature: string;
  humidity: string;
  water_requirement: string;
}

const DEFAULT_FORM: FormState = {
  crop_type: 'Wheat',
  soil_moisture: '35',
  temperature: '28',
  humidity: '60',
  water_requirement: '5',
};

export default function IrrigationPage() {
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<PredictionResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<ModelConfig | null>(null);

  React.useEffect(() => {
    getIrrigationConfig().then(r => setConfig(r.data)).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        crop_type: form.crop_type,
        soil_moisture: parseFloat(form.soil_moisture),
        temperature: parseFloat(form.temperature),
        humidity: parseFloat(form.humidity),
        water_requirement: parseFloat(form.water_requirement),
      };
      const res = await predictIrrigation(payload);
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
  const irrigationResult = result?.result as { irrigate?: boolean; prediction?: string; confidence_percent?: number; sigmoid_probability?: number } | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-agri-900 rounded-xl flex items-center justify-center">
          <Droplets className="w-5 h-5 text-agri-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-100">Irrigation Prediction</h1>
          <p className="text-sm text-gray-500">Tiny MLP · 13 Features · Binary Output · INT8</p>
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
        <p>Enter sensor readings and crop information. The 13-feature vector (numerical + one-hot crop type) is quantized to INT8.
          The model outputs a single sigmoid probability — values ≥ 0.5 indicate irrigation is needed.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-5">
          <h2 className="section-title text-base">Sensor Readings</h2>

          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Crop Selection</h3>
            <div>
              <label htmlFor="crop_type" className="block text-xs font-medium text-gray-400 mb-1">Crop Type</label>
              <select id="crop_type" name="crop_type" value={form.crop_type} onChange={handleChange} disabled={loading} className="select-field">
                {CROP_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Soil & Weather</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="soil_moisture" className="block text-xs font-medium text-gray-400 mb-1">Soil Moisture <span className="text-gray-600">(%)</span></label>
                <input id="soil_moisture" name="soil_moisture" type="number" value={form.soil_moisture} onChange={handleChange} min="0" max="100" step="0.5" disabled={loading} className="input-field text-sm" />
              </div>
              <div>
                <label htmlFor="temperature" className="block text-xs font-medium text-gray-400 mb-1">Temperature <span className="text-gray-600">(°C)</span></label>
                <input id="temperature" name="temperature" type="number" value={form.temperature} onChange={handleChange} min="0" max="50" step="0.5" disabled={loading} className="input-field text-sm" />
              </div>
              <div>
                <label htmlFor="humidity" className="block text-xs font-medium text-gray-400 mb-1">Humidity <span className="text-gray-600">(%)</span></label>
                <input id="humidity" name="humidity" type="number" value={form.humidity} onChange={handleChange} min="0" max="100" step="0.5" disabled={loading} className="input-field text-sm" />
              </div>
              <div>
                <label htmlFor="water_requirement" className="block text-xs font-medium text-gray-400 mb-1">Water Req. <span className="text-gray-600">(mm/day)</span></label>
                <input id="water_requirement" name="water_requirement" type="number" value={form.water_requirement} onChange={handleChange} min="0" max="20" step="0.1" disabled={loading} className="input-field text-sm" />
              </div>
            </div>
          </div>

          {/* Input summary preview */}
          <div className="bg-gray-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Input Summary</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {Object.entries(form).map(([k, v]) => (
                <div key={k} className="flex justify-between text-gray-500">
                  <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span className="text-gray-300 font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            id="irrigation-predict-btn"
            onClick={handlePredict}
            disabled={loading || !modelLoaded}
            className="btn-primary w-full"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Predicting…</>
            ) : (
              <><Droplets className="w-4 h-4" /> Check Irrigation Need</>
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
          <h2 className="section-title text-base">Irrigation Decision</h2>
          {result && irrigationResult ? (
            <div className="space-y-4">
              <PredictionResult
                result={result.result}
                reportUrl={result.report_url}
                inferenceMs={result.inference_time_ms}
                guidance={result.guidance}
              />
              {/* Raw model output */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Raw Model Output</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 mb-1">Sigmoid Probability</p>
                    <p className="font-mono font-bold text-gray-200">
                      {((result.result as { sigmoid_probability?: number }).sigmoid_probability ?? 0).toFixed(6)}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 mb-1">Raw Dequantized</p>
                    <p className="font-mono font-bold text-gray-200">
                      {((result.result as { raw_dequantized?: number }).raw_dequantized ?? 0).toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center text-gray-600 text-sm flex flex-col items-center gap-3">
              <Droplets className="w-10 h-10 opacity-30" />
              <p>Enter sensor readings and click <strong>Check Irrigation Need</strong> to run real TFLite inference.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
