import React from 'react';
import {
  History, Loader2, Download, Filter, Trash2,
  Bug, Leaf, Droplets, FlaskConical, FileDown,
  RefreshCw, CheckCircle2
} from 'lucide-react';
import { getHistory, deleteHistoryRecord } from '../utils/api';
import type { HistoryRecord } from '../types/api';

const MODEL_ICONS: Record<string, React.ReactNode> = {
  pest_detection: <Bug className="w-4 h-4 text-orange-400" />,
  plant_disease: <Leaf className="w-4 h-4 text-agri-400" />,
  fertilizer: <FlaskConical className="w-4 h-4 text-blue-400" />,
  irrigation: <Droplets className="w-4 h-4 text-cyan-400" />,
};

export default function HistoryPage() {
  const [records, setRecords] = React.useState<HistoryRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [deleteSuccess, setDeleteSuccess] = React.useState<number | null>(null);
  const limit = 20;

  const fetchHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHistory({
        model_id: filter || undefined,
        limit,
        offset: page * limit,
      });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.ceil(total / limit);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteHistoryRecord(id);
      setDeleteSuccess(id);
      setTimeout(() => setDeleteSuccess(null), 1500);
      // Refetch to update list & count
      await fetchHistory();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ['ID', 'Date', 'Model', 'Prediction', 'Confidence (%)', 'Report URL'];
    const rows = records.map(r => [
      r.id,
      new Date(r.created_at).toLocaleString(),
      r.model_display_name,
      `"${r.predicted_label}"`,
      r.confidence_percent != null ? r.confidence_percent.toFixed(2) : '',
      r.report_url ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agri-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-agri-900 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5 text-agri-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Prediction History</h1>
            <p className="text-sm text-gray-500">{total} total predictions stored</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              id="history-filter"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(0); }}
              className="select-field text-sm w-44"
            >
              <option value="">All Models</option>
              <option value="pest_detection">Pest Detection</option>
              <option value="plant_disease">Plant Disease</option>
              <option value="fertilizer">Fertilizer</option>
              <option value="irrigation">Irrigation</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            id="history-refresh-btn"
            onClick={fetchHistory}
            disabled={loading}
            className="btn-secondary text-xs px-3 py-2 gap-1.5"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Export CSV */}
          <button
            id="history-export-csv-btn"
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="btn-secondary text-xs px-3 py-2 gap-1.5"
            title="Export this page as CSV"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-agri-400 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-gray-600 text-sm">
            No predictions found. Run inference on any model page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Model</th>
                  <th className="text-left px-4 py-3 font-semibold">Prediction</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Input</th>
                  <th className="text-left px-4 py-3 font-semibold">Confidence</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Date</th>
                  <th className="text-right px-4 py-3 font-semibold">Report</th>
                  <th className="text-right px-4 py-3 font-semibold">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {records.map(rec => (
                  <tr
                    key={rec.id}
                    className={`hover:bg-gray-800/30 transition-colors ${
                      deleteSuccess === rec.id ? 'bg-agri-950/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {MODEL_ICONS[rec.model_id]}
                        <span className="text-gray-400 text-xs whitespace-nowrap">{rec.model_display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-gray-200 capitalize font-medium line-clamp-1 max-w-[180px]"
                        title={rec.predicted_label}
                      >
                        {rec.predicted_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-gray-600 max-w-[160px] truncate">
                        {Object.entries(rec.input_summary ?? {}).slice(0, 2).map(([k, v]) => (
                          <span key={k} className="mr-2">{k}: {v}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {rec.confidence_percent != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 confidence-bar h-1.5">
                            <div className="confidence-bar-fill h-full" style={{ width: `${rec.confidence_percent}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${
                            rec.confidence_percent >= 70 ? 'text-agri-400' :
                            rec.confidence_percent >= 40 ? 'text-yellow-400' : 'text-orange-400'
                          }`}>
                            {rec.confidence_percent.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-600">
                        {new Date(rec.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rec.report_url ? (
                        <a
                          href={rec.report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-agri-400 hover:text-agri-300 transition-colors"
                          id={`report-dl-${rec.id}`}
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      ) : (
                        <span className="text-xs text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deleteSuccess === rec.id ? (
                        <CheckCircle2 className="w-4 h-4 text-agri-400 ml-auto" />
                      ) : (
                        <button
                          id={`delete-record-${rec.id}`}
                          onClick={() => handleDelete(rec.id)}
                          disabled={deletingId === rec.id}
                          className="p-1 text-gray-700 hover:text-red-400 transition-colors rounded disabled:opacity-40"
                          title="Delete this record"
                        >
                          {deletingId === rec.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 text-xs">
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              id="history-prev-btn"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Previous
            </button>
            <button
              id="history-next-btn"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
