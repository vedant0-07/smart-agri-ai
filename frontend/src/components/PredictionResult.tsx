import { Download, FileText, ExternalLink } from 'lucide-react';
import type { ClassificationResult, BinaryResult } from '../types/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface PredictionResultProps {
  result: ClassificationResult | BinaryResult;
  recommendation?: string | Record<string, string> | null;
  recommendationText?: string;
  reportUrl?: string | null;
  inferenceMs?: number;
  guidance?: { message: string; actions: string[] };
}

const COLORS = ['#16a34a', '#4ade80', '#86efac', '#bbf7d0'];

function isBinaryResult(r: ClassificationResult | BinaryResult): r is BinaryResult {
  return (r as BinaryResult).irrigate !== undefined;
}

export default function PredictionResult({
  result,
  recommendation,
  recommendationText,
  reportUrl,
  inferenceMs,
  guidance,
}: PredictionResultProps) {
  const isBinary = isBinaryResult(result);

  if (isBinary) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Binary Decision */}
        <div className={`rounded-2xl p-6 border-2 text-center
          ${result.irrigate
            ? 'bg-agri-950/40 border-agri-600'
            : 'bg-gray-800/60 border-gray-700'}`}>
          <div className={`text-5xl mb-3`}>{result.irrigate ? '💧' : '✅'}</div>
          <h3 className={`text-2xl font-bold ${result.irrigate ? 'text-agri-300' : 'text-gray-200'}`}>
            {result.prediction}
          </h3>
          <div className="mt-3">
            <div className="confidence-bar max-w-xs mx-auto">
              <div
                className="confidence-bar-fill"
                style={{ width: `${result.confidence_percent}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Confidence: <span className="font-semibold text-gray-200">{result.confidence_percent.toFixed(1)}%</span>
            </p>
          </div>
          {inferenceMs !== undefined && (
            <p className="text-xs text-gray-600 mt-2">Inference: {inferenceMs} ms</p>
          )}
        </div>

        {/* Guidance */}
        {guidance && (
          <div className="card p-4">
            <h4 className="font-semibold text-gray-200 text-sm mb-3">Recommended Actions</h4>
            <ul className="space-y-2">
              {guidance.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-agri-500 font-bold mt-0.5">•</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PDF Download */}
        {reportUrl && (
          <a
            id="download-report-btn"
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center"
          >
            <Download className="w-4 h-4" /> Download PDF Report
          </a>
        )}
      </div>
    );
  }

  // Classification result
  const classResult = result as ClassificationResult;
  const top = classResult.top_prediction;
  const topK = classResult.top_k_predictions ?? [];

  const chartData = topK.map(p => ({
    name: p.label.length > 20 ? p.label.slice(0, 20) + '…' : p.label,
    fullName: p.label,
    confidence: parseFloat(p.confidence_percent.toFixed(2)),
  }));

  const recText = typeof recommendation === 'string'
    ? recommendation
    : recommendationText || (recommendation && typeof recommendation === 'object'
        ? Object.entries(recommendation as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n')
        : null);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Prediction */}
      <div className="bg-gradient-to-br from-agri-950/60 to-agri-900/20 border border-agri-800/50 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-agri-400 font-semibold uppercase tracking-wider mb-1">
              Top Prediction
            </p>
            <h3 className="text-lg font-bold text-gray-100 capitalize">
              {top?.label ?? 'Unknown'}
            </h3>
          </div>
          {inferenceMs !== undefined && (
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-lg">
              {inferenceMs} ms
            </span>
          )}
        </div>

        {top && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-400">Confidence</span>
              <span className={`font-bold ${
                top.confidence_percent >= 70 ? 'text-agri-400' :
                top.confidence_percent >= 40 ? 'text-yellow-400' : 'text-orange-400'
              }`}>
                {top.confidence_percent.toFixed(1)}%
              </span>
            </div>
            <div className="confidence-bar">
              <div
                className="confidence-bar-fill"
                style={{ width: `${top.confidence_percent}%` }}
              />
            </div>
            {top.confidence_percent < 40 && (
              <p className="text-xs text-orange-400 mt-2">
                ⚠ Low confidence prediction. Please verify with an expert.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Top-K Predictions Chart */}
      {topK.length > 1 && (
        <div className="card p-4">
          <h4 className="font-semibold text-gray-200 text-sm mb-4">Top Predictions</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 40 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={130} />
              <Tooltip
                formatter={(val: number, _n: string, props: { payload?: { fullName: string } }) => [
                  `${val}%`, props.payload?.fullName ?? ''
                ]}
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ display: 'none' }}
              />
              <Bar dataKey="confidence" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i] ?? '#374151'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Table */}
          <div className="mt-3 space-y-2">
            {topK.map((p) => (
              <div key={p.rank} className="flex items-center gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                  {p.rank}
                </span>
                <span className="flex-1 text-gray-300 truncate capitalize" title={p.label}>{p.label}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 confidence-bar h-1.5">
                    <div className="confidence-bar-fill h-full" style={{ width: `${p.confidence_percent}%` }} />
                  </div>
                  <span className="text-gray-400 text-xs w-12 text-right">{p.confidence_percent.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recText && (
        <div className="card p-4 border-l-4 border-l-agri-600">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-agri-400" />
            <h4 className="font-semibold text-gray-200 text-sm">Recommendations</h4>
          </div>
          <p className="text-sm text-gray-400 whitespace-pre-line leading-relaxed">{recText}</p>
        </div>
      )}

      {/* PDF Download */}
      {reportUrl && (
        <a
          id="download-report-btn"
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full justify-center"
        >
          <Download className="w-4 h-4" />
          Download PDF Report
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      )}
    </div>
  );
}
