import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bug, Leaf, Droplets, FlaskConical,
  Cpu, TrendingUp, Clock, CheckCircle2,
  AlertCircle, BarChart2, Loader2
} from 'lucide-react';
import ModelCard from '../components/ModelCard';
import { getModelStatus, getHistory } from '../utils/api';
import type { ModelStatus, HistoryRecord } from '../types/api';

const MODEL_META: Record<string, { icon: React.ReactNode; description: string; route: string }> = {
  pest_detection: {
    icon: <Bug className="w-6 h-6" />,
    description: 'Detect agricultural pests from crop images using IP102 dataset-trained MobileNetV2.',
    route: '/pest',
  },
  plant_disease: {
    icon: <Leaf className="w-6 h-6" />,
    description: 'Identify 38 plant diseases from leaf images trained on the PlantVillage dataset.',
    route: '/plant-disease',
  },
  fertilizer: {
    icon: <FlaskConical className="w-6 h-6" />,
    description: 'Recommend the optimal fertilizer from soil and environmental sensor readings.',
    route: '/fertilizer',
  },
  irrigation: {
    icon: <Droplets className="w-6 h-6" />,
    description: 'Predict whether irrigation is needed based on soil moisture and weather conditions.',
    route: '/irrigation',
  },
};

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`card p-5 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{value}</p>
        </div>
        <div className="text-gray-600">{icon}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = React.useState<Record<string, ModelStatus>>({});
  const [history, setHistory] = React.useState<HistoryRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [histLoading, setHistLoading] = React.useState(true);
  const [backendOnline, setBackendOnline] = React.useState<boolean | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await getModelStatus();
      setStatuses(res.data);
      setBackendOnline(true);
    } catch (e) {
      setBackendOnline(false);
      console.error('Backend not reachable:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 3s so it auto-recovers when backend starts
  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  React.useEffect(() => {
    getHistory({ limit: 5 })
      .then(res => setHistory(res.data.records))
      .catch(console.error)
      .finally(() => setHistLoading(false));
  }, []);

  const loadedCount = Object.values(statuses).filter(m => m.status === 'loaded').length;
  const totalPredictions = history.length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-agri-900/30 via-gray-900 to-gray-950 border border-agri-900/50 rounded-2xl p-8">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #16a34a 0%, transparent 50%), radial-gradient(circle at 80% 50%, #15803d 0%, transparent 50%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-agri-600 rounded-2xl flex items-center justify-center shadow-lg shadow-agri-900/50">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">AI-Powered Smart Agriculture</h1>
              <p className="text-sm text-agri-400">Using TinyML Models</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            A final-year engineering project demonstrating real TFLite inference for agricultural AI —
            pest detection, plant disease diagnosis, fertilizer recommendation, and irrigation prediction.
            All predictions run on actual uploaded models with no simulated outputs.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {['TensorFlow Lite', 'MobileNetV2', 'INT8 Quantized', 'FastAPI', 'React'].map(tag => (
              <span key={tag} className="px-2.5 py-1 bg-gray-800 text-gray-400 text-xs rounded-lg border border-gray-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Models Loaded" value={`${loadedCount}/4`} icon={<CheckCircle2 className="w-6 h-6" />} color="border-l-agri-500" />
        <StatCard label="Total Predictions" value={totalPredictions} icon={<TrendingUp className="w-6 h-6" />} color="border-l-blue-500" />
        <StatCard label="Model Architecture" value="MobileNetV2" icon={<Cpu className="w-6 h-6" />} color="border-l-purple-500" />
        <StatCard label="Quantization" value="INT8" icon={<BarChart2 className="w-6 h-6" />} color="border-l-orange-500" />
      </div>

      {/* Model Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            <Cpu className="w-5 h-5 text-agri-400" />
            TinyML Models
          </h2>
          {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
        </div>

        {/* Backend offline → auto-retry spinner */}
        {backendOnline === false && (
          <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-4 flex items-center gap-3 mb-4 text-sm text-blue-300">
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            Connecting to backend... Start the backend server and this will automatically update.
          </div>
        )}

        {/* Backend online but no models loaded */}
        {backendOnline === true && !loading && loadedCount === 0 && (
          <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-4 flex items-center gap-3 mb-4 text-sm text-yellow-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No models loaded. Make sure model files are in the{' '}
            <code className="font-mono text-xs bg-yellow-950 px-1.5 py-0.5 rounded">backend/models/</code> directory.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(MODEL_META).map(([id, meta]) => {
            const status = statuses[id] ?? {
              model_id: id,
              display_name: id.replace(/_/g, ' '),
              status: 'not_loaded' as const,
              error: null,
              filename: null,
              task_type: null,
              input_details: [],
              output_details: [],
            };
            return (
              <ModelCard
                key={id}
                modelStatus={status}
                icon={meta.icon}
                description={meta.description}
                onClick={() => navigate(meta.route)}
              />
            );
          })}
        </div>
      </div>

      {/* Recent Predictions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            <Clock className="w-5 h-5 text-agri-400" />
            Recent Predictions
          </h2>
          <button
            id="view-all-history-btn"
            onClick={() => navigate('/history')}
            className="text-xs text-agri-400 hover:text-agri-300 transition-colors"
          >
            View All →
          </button>
        </div>

        {histLoading ? (
          <div className="card p-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-agri-400 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            No predictions yet. Run inference on any model to see results here.
          </div>
        ) : (
          <div className="card divide-y divide-gray-800">
            {history.map(rec => (
              <div key={rec.id} className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-agri-950 flex items-center justify-center flex-shrink-0">
                  {MODEL_META[rec.model_id]?.icon ?? <Cpu className="w-4 h-4 text-agri-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{rec.predicted_label}</p>
                  <p className="text-xs text-gray-500">{rec.model_display_name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {rec.confidence_percent != null && (
                    <p className="text-sm font-semibold text-agri-400">{rec.confidence_percent.toFixed(1)}%</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {new Date(rec.created_at).toLocaleDateString()}
                  </p>
                </div>
                {rec.report_url && (
                  <a
                    href={rec.report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-600 hover:text-agri-400 transition-colors flex-shrink-0"
                    title="Download Report"
                    onClick={e => e.stopPropagation()}
                  >
                    PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
