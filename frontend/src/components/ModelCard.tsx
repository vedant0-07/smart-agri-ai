import React from 'react';
import { CheckCircle2, XCircle, Loader2, Circle, Upload } from 'lucide-react';
import type { ModelStatus } from '../types/api';

interface ModelCardProps {
  modelStatus: ModelStatus;
  icon: React.ReactNode;
  description: string;
  onClick?: () => void;
  onReload?: () => void;
}

const statusConfig = {
  loaded: {
    badge: 'badge-loaded',
    dot: 'bg-agri-400',
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: 'Loaded',
  },
  error: {
    badge: 'badge-error',
    dot: 'bg-red-400',
    icon: <XCircle className="w-3 h-3" />,
    label: 'Error',
  },
  loading: {
    badge: 'badge-loading',
    dot: 'bg-yellow-400',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: 'Loading',
  },
  not_loaded: {
    badge: 'badge-not-loaded',
    dot: 'bg-gray-600',
    icon: <Circle className="w-3 h-3" />,
    label: 'Not Loaded',
  },
};

export default function ModelCard({ modelStatus, icon, description, onClick, onReload }: ModelCardProps) {
  const cfg = statusConfig[modelStatus.status] ?? statusConfig.not_loaded;

  return (
    <div
      className={`card p-5 flex flex-col gap-4 cursor-pointer transition-all duration-200
        hover:border-agri-700 hover:shadow-lg hover:shadow-agri-900/20
        ${modelStatus.status === 'loaded' ? 'border-agri-900/50' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-agri-400">
          {icon}
        </div>
        <span className={cfg.badge}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} inline-block`} />
          {cfg.label}
        </span>
      </div>

      {/* Content */}
      <div>
        <h3 className="font-semibold text-gray-100 text-sm leading-tight">
          {modelStatus.display_name}
        </h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
      </div>

      {/* Model info */}
      {modelStatus.filename && (
        <div className="text-xs text-gray-600 font-mono truncate" title={modelStatus.filename}>
          {modelStatus.filename}
        </div>
      )}

      {/* Error message */}
      {modelStatus.status === 'error' && modelStatus.error && (
        <div className="bg-red-950/40 border border-red-900 rounded-lg p-2 text-xs text-red-400">
          {modelStatus.error}
        </div>
      )}

      {/* Input/Output info */}
      {modelStatus.status === 'loaded' && modelStatus.input_details.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-800/60 rounded-lg p-2">
            <p className="text-gray-500 mb-1">Input Shape</p>
            <p className="text-gray-300 font-mono font-semibold">
              {modelStatus.input_details[0]?.shape.join('×')}
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2">
            <p className="text-gray-500 mb-1">Output Shape</p>
            <p className="text-gray-300 font-mono font-semibold">
              {modelStatus.output_details[0]?.shape.join('×')}
            </p>
          </div>
        </div>
      )}

      {/* Action hint */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-agri-600 font-medium">
          {modelStatus.status === 'loaded' ? '→ Run Inference' : 'Click to manage'}
        </span>
        {onReload && (
          <button
            id={`reload-${modelStatus.model_id}`}
            onClick={e => { e.stopPropagation(); onReload(); }}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
          >
            <Upload className="w-3 h-3" /> Reload
          </button>
        )}
      </div>
    </div>
  );
}
