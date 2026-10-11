import React from 'react';
import {
  Cpu, Upload, RefreshCw, CheckCircle2, XCircle,
  Loader2, AlertCircle, Info, Bug, Leaf, Droplets,
  FlaskConical, ChevronDown, ChevronUp, HardDrive
} from 'lucide-react';
import { getModelStatus, uploadModel, reloadModel, getModelInspect } from '../utils/api';
import type { ModelStatus } from '../types/api';

const MODEL_META: Record<string, { icon: React.ReactNode; label: string; filename: string }> = {
  pest_detection: {
    icon: <Bug className="w-5 h-5" />,
    label: 'Pest Detection',
    filename: 'ip102_mobilenetv2_192_stage3_int8.tflite',
  },
  plant_disease: {
    icon: <Leaf className="w-5 h-5" />,
    label: 'Plant Disease',
    filename: 'plantvillage_mobilenetv2_192_stage2_int8.tflite',
  },
  fertilizer: {
    icon: <FlaskConical className="w-5 h-5" />,
    label: 'Fertilizer',
    filename: 'fertilizer_mlp_int8.tflite',
  },
  irrigation: {
    icon: <Droplets className="w-5 h-5" />,
    label: 'Irrigation',
    filename: 'irrigation_model_int8.tflite',
  },
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'loaded') {
    return (
      <span className="badge-loaded">
        <CheckCircle2 className="w-3 h-3" /> Loaded
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="badge-error">
        <XCircle className="w-3 h-3" /> Error
      </span>
    );
  }
  if (status === 'loading') {
    return (
      <span className="badge-loading">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading
      </span>
    );
  }
  return (
    <span className="badge-not-loaded">
      <HardDrive className="w-3 h-3" /> Not Loaded
    </span>
  );
}

interface ModelCardProps {
  modelId: string;
  status: ModelStatus;
  onRefresh: () => void;
}

function ModelManagementCard({ modelId, status, onRefresh }: ModelCardProps) {
  const meta = MODEL_META[modelId];
  const [uploading, setUploading] = React.useState(false);
  const [reloading, setReloading] = React.useState(false);
  const [uploadMsg, setUploadMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reloadMsg, setReloadMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inspect, setInspect] = React.useState<Record<string, unknown> | null>(null);
  const [inspecting, setInspecting] = React.useState(false);
  const [showInspect, setShowInspect] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      await uploadModel(modelId, file);
      setUploadMsg({ type: 'success', text: `Model uploaded and reloaded successfully.` });
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Upload failed.';
      setUploadMsg({ type: 'error', text: msg });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReload = async () => {
    setReloading(true);
    setReloadMsg(null);
    try {
      const res = await reloadModel(modelId);
      const newStatus = res.data?.status ?? 'unknown';
      const errMsg = res.data?.error;
      if (newStatus === 'loaded') {
        setReloadMsg({ type: 'success', text: 'Model reloaded successfully.' });
      } else {
        setReloadMsg({ type: 'error', text: errMsg ?? `Reload failed: status=${newStatus}` });
      }
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Reload failed.';
      setReloadMsg({ type: 'error', text: msg });
    } finally {
      setReloading(false);
    }
  };

  const handleInspect = async () => {
    if (showInspect) { setShowInspect(false); return; }
    setInspecting(true);
    try {
      const res = await getModelInspect(modelId);
      setInspect(res.data);
      setShowInspect(true);
    } catch {
      setInspect(null);
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            status.status === 'loaded' ? 'bg-agri-900 text-agri-400' :
            status.status === 'error' ? 'bg-red-950 text-red-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {meta.icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-100 text-sm">{meta.label}</h3>
            <p className="text-xs text-gray-600 font-mono truncate max-w-[180px]" title={meta.filename}>
              {meta.filename}
            </p>
          </div>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {/* Error message */}
      {status.error && (
        <div className="bg-red-950/30 border border-red-900 rounded-lg p-3 flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="break-all">{status.error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Upload */}
        <label
          htmlFor={`upload-${modelId}`}
          className={`btn-secondary text-xs px-3 py-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading…' : 'Upload .tflite'}
        </label>
        <input
          id={`upload-${modelId}`}
          ref={fileInputRef}
          type="file"
          accept=".tflite"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />

        {/* Reload */}
        <button
          id={`reload-${modelId}-btn`}
          onClick={handleReload}
          disabled={reloading}
          className="btn-secondary text-xs px-3 py-2"
        >
          {reloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {reloading ? 'Reloading…' : 'Reload'}
        </button>

        {/* Inspect */}
        <button
          id={`inspect-${modelId}-btn`}
          onClick={handleInspect}
          disabled={status.status !== 'loaded' || inspecting}
          className="btn-secondary text-xs px-3 py-2"
        >
          {inspecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
            showInspect ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
          )}
          Inspect
        </button>
      </div>

      {/* Upload / Reload feedback */}
      {uploadMsg && (
        <div className={`text-xs flex items-center gap-1.5 rounded-lg px-3 py-2 ${
          uploadMsg.type === 'success' ? 'bg-agri-950/40 text-agri-400' : 'bg-red-950/30 text-red-400'
        }`}>
          {uploadMsg.type === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          }
          {uploadMsg.text}
        </div>
      )}
      {reloadMsg && (
        <div className={`text-xs flex items-center gap-1.5 rounded-lg px-3 py-2 ${
          reloadMsg.type === 'success' ? 'bg-agri-950/40 text-agri-400' : 'bg-red-950/30 text-red-400'
        }`}>
          {reloadMsg.type === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          }
          {reloadMsg.text}
        </div>
      )}

      {/* Tensor Inspection Panel */}
      {showInspect && inspect && (
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-3 text-xs animate-fade-in">
          <p className="font-semibold text-gray-400 uppercase tracking-wider text-xs">Tensor Details</p>

          {/* Input tensors */}
          {Array.isArray((inspect as { input_details?: unknown[] }).input_details) &&
            ((inspect as { input_details: Record<string, unknown>[] }).input_details).map((t, i) => (
              <div key={i} className="space-y-1">
                <p className="text-agri-400 font-semibold">Input #{i + 1}: {String(t.name)}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-900 rounded-lg p-2">
                    <p className="text-gray-600">Shape</p>
                    <p className="font-mono text-gray-300">[{(t.shape as number[]).join(', ')}]</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-2">
                    <p className="text-gray-600">Dtype</p>
                    <p className="font-mono text-gray-300">{String(t.dtype)}</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-2">
                    <p className="text-gray-600">Zero Point</p>
                    <p className="font-mono text-gray-300">
                      {((t.quantization as { zero_points: number[] }).zero_points[0] ?? '—')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          }

          {/* Output tensors */}
          {Array.isArray((inspect as { output_details?: unknown[] }).output_details) &&
            ((inspect as { output_details: Record<string, unknown>[] }).output_details).map((t, i) => (
              <div key={i} className="space-y-1">
                <p className="text-blue-400 font-semibold">Output #{i + 1}: {String(t.name)}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-900 rounded-lg p-2">
                    <p className="text-gray-600">Shape</p>
                    <p className="font-mono text-gray-300">[{(t.shape as number[]).join(', ')}]</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-2">
                    <p className="text-gray-600">Scale</p>
                    <p className="font-mono text-gray-300">
                      {((t.quantization as { scales: number[] }).scales[0] ?? '—').toString().slice(0, 8)}
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-2">
                    <p className="text-gray-600">Zero Point</p>
                    <p className="font-mono text-gray-300">
                      {((t.quantization as { zero_points: number[] }).zero_points[0] ?? '—')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default function ModelsPage() {
  const [statuses, setStatuses] = React.useState<Record<string, ModelStatus>>({});
  const [loading, setLoading] = React.useState(true);

  const fetchStatuses = React.useCallback(async () => {
    try {
      const res = await getModelStatus();
      setStatuses(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 15000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const loadedCount = Object.values(statuses).filter(m => m.status === 'loaded').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-agri-900 rounded-xl flex items-center justify-center">
            <Cpu className="w-5 h-5 text-agri-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Model Management</h1>
            <p className="text-sm text-gray-500">{loadedCount}/4 models loaded</p>
          </div>
        </div>
        <button
          id="models-refresh-all-btn"
          onClick={fetchStatuses}
          disabled={loading}
          className="btn-secondary text-xs px-3 py-2"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          Refresh All
        </button>
      </div>

      {/* Info */}
      <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 flex gap-3 text-sm text-gray-400">
        <Info className="w-4 h-4 text-agri-400 flex-shrink-0 mt-0.5" />
        <p>
          Upload your <code className="font-mono text-xs bg-gray-800 px-1 rounded">.tflite</code> model files here, or
          reload models from the <code className="font-mono text-xs bg-gray-800 px-1 rounded">backend/models/</code> directory.
          Use <strong>Inspect</strong> to view tensor shapes and quantization parameters for loaded models.
        </p>
      </div>

      {/* Status summary bar */}
      <div className="grid grid-cols-4 gap-2">
        {(['loaded', 'not_loaded', 'error', 'loading'] as const).map(s => {
          const count = Object.values(statuses).filter(m => m.status === s).length;
          return (
            <div key={s} className="card p-3 text-center">
              <p className="text-2xl font-bold text-gray-100">{count}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{s.replace('_', ' ')}</p>
            </div>
          );
        })}
      </div>

      {/* Model cards */}
      {loading && Object.keys(statuses).length === 0 ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-agri-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(MODEL_META).map(([id]) => {
            const status = statuses[id] ?? {
              model_id: id,
              display_name: id,
              status: 'not_loaded' as const,
              error: null,
              filename: null,
              task_type: null,
              input_details: [],
              output_details: [],
            };
            return (
              <ModelManagementCard
                key={id}
                modelId={id}
                status={status}
                onRefresh={fetchStatuses}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
