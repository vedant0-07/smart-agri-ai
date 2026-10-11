import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera, Zap, RefreshCw, AlertCircle, CheckCircle2,
  Loader2, FlipHorizontal, Cpu, Wifi, WifiOff, ChevronDown
} from 'lucide-react';
import PredictionResult from '../components/PredictionResult';
import { predictPest, getPestConfig } from '../utils/api';
import type { PredictionResponse } from '../types/api';

// ── Types ─────────────────────────────────────────────────────
type Source = 'webcam' | 'fpga';
type CamState = 'idle' | 'loading' | 'active' | 'predicting' | 'done' | 'error';
interface FpgaResult {
  result?: {
    top_prediction?: { label?: string; confidence?: number; confidence_percent?: number };
    top_k_predictions?: Array<{ label: string; confidence_percent: number; rank: number }>;
  };
  inference_time_ms?: number;
  resolution?: string;
  frames?: number;
  fps?: number;
}

const FPGA_BRIDGE = "http://localhost:8888";

const MODEL_OPTIONS = [
  { id: 'pest',        label: 'Pest Detection',    desc: 'IP102 · 102 classes' },
  { id: 'plant',       label: 'Plant Disease',      desc: 'PlantVillage · 38 classes' },
];

// ── Helper ────────────────────────────────────────────────────
async function dataUrlToFile(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: 'image/jpeg' });
}

// ── Component ─────────────────────────────────────────────────
export default function CameraCapturePage() {
  // Source & model
  const [source,    setSource]    = useState<Source>('webcam');
  const [modelId,   setModelId]   = useState('pest');
  const [modelOpen, setModelOpen] = useState(false);

  // Webcam
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState,  setCamState]  = useState<CamState>('idle');
  const [snapshot,  setSnapshot]  = useState<string | null>(null);
  const [mirrored,  setMirrored]  = useState(true);
  const [devices,   setDevices]   = useState<MediaDeviceInfo[]>([]);
  const [deviceId,  setDeviceId]  = useState('');
  const [camError,  setCamError]  = useState<string | null>(null);
  const [webResult, setWebResult] = useState<PredictionResponse | null>(null);

  // FPGA stream
  const [fpgaOnline,  setFpgaOnline]  = useState(false);
  const [fpgaResult,  setFpgaResult]  = useState<FpgaResult>({});
  const [fpgaFrames,  setFpgaFrames]  = useState(0);
  const [fpgaFps,     setFpgaFps]     = useState(0);
  const fpgaImgRef = useRef<HTMLImageElement>(null);

  // Config
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devs => {
      const cams = devs.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      if (cams.length) setDeviceId(cams[0].deviceId);
    }).catch(() => {});
    getPestConfig().then(r => setConfig(r.data)).catch(() => {});
  }, []);

  // Poll FPGA bridge status
  useEffect(() => {
    if (source !== 'fpga') return;
    const poll = () => {
      fetch(`${FPGA_BRIDGE}/result`)
        .then(r => r.json())
        .then(d => {
          setFpgaOnline(true);
          setFpgaResult(d);
          setFpgaFrames(d.frames ?? 0);
          setFpgaFps(d.fps ?? 0);
        })
        .catch(() => setFpgaOnline(false));
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [source]);

  // ── Webcam ─────────────────────────────────────────────────
  const startWebcam = useCallback(async () => {
    setCamState('loading'); setCamError(null); setSnapshot(null); setWebResult(null);
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId || undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState('active');
    } catch (e) {
      setCamError((e as Error)?.message ?? 'Camera access denied');
      setCamState('error');
    }
  }, [deviceId]);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamState('idle'); setSnapshot(null); setWebResult(null);
  }, []);

  const captureAndPredict = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const vid = videoRef.current, cvs = canvasRef.current;
    cvs.width = vid.videoWidth || 640; cvs.height = vid.videoHeight || 480;
    const ctx = cvs.getContext('2d')!;
    if (mirrored) { ctx.save(); ctx.translate(cvs.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(vid, 0, 0);
    if (mirrored) ctx.restore();
    const url = cvs.toDataURL('image/jpeg', 0.92);
    setSnapshot(url); setCamState('predicting'); setWebResult(null);
    try {
      const file = await dataUrlToFile(url, 'capture.jpg');
      const res  = await predictPest(file);
      setWebResult(res.data); setCamState('done');
    } catch (e) {
      setCamError((e as any)?.response?.data?.detail ?? 'Inference failed');
      setCamState('active');
    }
  }, [mirrored]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const modelLabel = MODEL_OPTIONS.find(m => m.id === modelId)?.label ?? 'Select Model';

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-agri-900 rounded-xl flex items-center justify-center ring-1 ring-agri-700/40">
            <Camera className="w-5 h-5 text-agri-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">AI Camera Capture</h1>
            <p className="text-sm text-gray-500">Live webcam or FPGA OV7670 → instant AI analysis</p>
          </div>
        </div>

        {/* Model selector */}
        <div className="relative">
          <button id="model-select-btn" onClick={() => setModelOpen(o => !o)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-gray-300 rounded-xl px-4 py-2.5 text-sm transition-colors">
            <Cpu className="w-4 h-4 text-agri-400" />
            <span>{modelLabel}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
              {MODEL_OPTIONS.map(m => (
                <button key={m.id} id={`model-${m.id}`}
                  onClick={() => { setModelId(m.id); setModelOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-700 transition-colors
                    ${modelId === m.id ? 'text-agri-400 bg-agri-900/40' : 'text-gray-300'}`}>
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Source toggle ──────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {[
          { key: 'webcam', icon: Camera,  label: 'PC Webcam' },
          { key: 'fpga',   icon: Cpu,     label: 'FPGA OV7670' },
        ].map(({ key, icon: Icon, label }) => (
          <button key={key} id={`src-${key}`}
            onClick={() => setSource(key as Source)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              source === key
                ? 'bg-agri-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-300'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Camera / Stream ─────────────────────── */}
        <div className="space-y-4">

          {/* ── FPGA Stream ── */}
          {source === 'fpga' && (
            <div className="space-y-3">
              <div className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-xl"
                   style={{ aspectRatio: '4/3' }}>
                <img
                  ref={fpgaImgRef}
                  src={`${FPGA_BRIDGE}/snapshot?t=${Date.now()}`}
                  alt="FPGA camera"
                  className={`w-full h-full object-cover transition-opacity ${fpgaOnline ? 'opacity-100' : 'opacity-0'}`}
                  onError={() => setFpgaOnline(false)}
                />
                {!fpgaOnline && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900">
                    <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                      <Cpu className="w-8 h-8 text-gray-600" />
                    </div>
                    <div className="text-center px-6">
                      <p className="text-gray-400 font-medium text-sm">FPGA bridge not running</p>
                      <p className="text-gray-600 text-xs mt-1">Start <code className="text-agri-400">python fpga_stream_bridge.py</code></p>
                    </div>
                  </div>
                )}
                {fpgaOnline && (
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur rounded-full px-3 py-1 text-xs text-green-400 font-semibold">
                      <Cpu className="w-3 h-3" /> FPGA LIVE
                    </span>
                    {fpgaFps > 0 && (
                      <span className="bg-black/60 backdrop-blur rounded-full px-2 py-1 text-xs text-gray-400">
                        {fpgaFps.toFixed(1)} fps
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* FPGA status bar */}
              <div className={`flex items-center gap-3 text-sm rounded-xl p-3 border ${
                fpgaOnline
                  ? 'bg-green-950/20 border-green-900 text-green-400'
                  : 'bg-gray-800/40 border-gray-800 text-gray-500'
              }`}>
                {fpgaOnline
                  ? <><Wifi className="w-4 h-4" /> Bridge connected · {fpgaFrames} frames received</>
                  : <><WifiOff className="w-4 h-4" /> Run: <code className="text-agri-400 ml-1">python backend/fpga_stream_bridge.py</code></>}
              </div>

              {/* Polling live snapshot */}
              {fpgaOnline && (
                <FpgaSnapshotRefresher bridgeUrl={FPGA_BRIDGE} imgRef={fpgaImgRef} />
              )}
            </div>
          )}

          {/* ── Webcam ── */}
          {source === 'webcam' && (
            <>
              <div className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-xl"
                   style={{ aspectRatio: '16/9' }}>
                <video ref={videoRef} muted playsInline
                  className={`w-full h-full object-cover ${
                    (camState === 'active' || camState === 'predicting') && !snapshot ? 'block' : 'hidden'
                  } ${mirrored ? 'scale-x-[-1]' : ''}`} />
                {snapshot && <img src={snapshot} alt="Captured" className="w-full h-full object-cover" />}
                {(camState === 'idle' || camState === 'loading' || camState === 'error') && !snapshot && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      camState === 'error' ? 'bg-red-900/40' : 'bg-agri-900/50'}`}>
                      {camState === 'loading'
                        ? <Loader2 className="w-8 h-8 text-agri-400 animate-spin" />
                        : camState === 'error'
                        ? <AlertCircle className="w-8 h-8 text-red-400" />
                        : <Camera className="w-8 h-8 text-agri-600" />}
                    </div>
                    <p className="text-sm text-gray-400 px-6 text-center">
                      {camState === 'loading' ? 'Starting camera…'
                       : camState === 'error' ? (camError ?? 'Camera error')
                       : 'Click Start Camera'}
                    </p>
                  </div>
                )}
                {camState === 'predicting' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-agri-400 animate-spin" />
                    <p className="text-sm text-agri-300 font-medium">Running TFLite inference…</p>
                  </div>
                )}
                {camState === 'active' && (
                  <div className="absolute top-3 left-3">
                    <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur rounded-full px-3 py-1 text-xs text-red-400 font-semibold">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />LIVE
                    </span>
                  </div>
                )}
                {camState === 'done' && snapshot && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-green-500 rounded-full p-1.5 shadow">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {/* Webcam controls */}
              <div className="flex gap-2 flex-wrap">
                {devices.length > 1 && (
                  <select value={deviceId} onChange={e => setDeviceId(e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-2 py-1.5">
                    {devices.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i+1}`}</option>
                    ))}
                  </select>
                )}
                {camState === 'idle' || camState === 'error' ? (
                  <button id="start-cam-btn" onClick={startWebcam} className="btn-primary flex-1">
                    <Camera className="w-4 h-4" /> Start Camera
                  </button>
                ) : camState === 'done' ? (
                  <>
                    <button id="retake-btn" onClick={() => { setSnapshot(null); setWebResult(null); setCamState('active'); }}
                      className="btn-secondary flex-1"><RefreshCw className="w-4 h-4" /> Retake</button>
                    <button id="stop-cam-btn" onClick={stopWebcam} className="btn-secondary">Stop</button>
                  </>
                ) : (
                  <>
                    <button id="capture-btn" onClick={captureAndPredict}
                      disabled={camState === 'predicting' || camState === 'loading'}
                      className="btn-primary flex-1">
                      {camState === 'predicting'
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
                        : <><Zap className="w-4 h-4" /> Capture & Predict</>}
                    </button>
                    <button id="mirror-btn" onClick={() => setMirrored(m => !m)}
                      className={`btn-secondary px-3 ${mirrored ? 'text-agri-400' : 'text-gray-500'}`}>
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                    <button id="stop-btn" onClick={stopWebcam} className="btn-secondary px-3">✕</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Results ─────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="section-title text-base">AI Prediction</h2>

          {/* FPGA result */}
          {source === 'fpga' && fpgaOnline && fpgaResult?.result?.top_prediction?.label && (
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Detected</p>
                    <p className="text-xl font-bold text-agri-400 mt-1 capitalize">
                      {fpgaResult.result.top_prediction.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Confidence</p>
                    <p className="text-2xl font-bold text-white">
                      {(fpgaResult.result.top_prediction.confidence_percent ??
                        (fpgaResult.result.top_prediction.confidence ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                {fpgaResult.result.top_k_predictions && (
                  <div className="space-y-2">
                    {fpgaResult.result.top_k_predictions.slice(0, 3).map(p => (
                      <div key={p.rank} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4">#{p.rank}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                          <div className="bg-agri-500 h-1.5 rounded-full"
                               style={{ width: `${p.confidence_percent}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-24 truncate capitalize">{p.label}</span>
                        <span className="text-xs text-agri-400 w-10 text-right">{p.confidence_percent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Inference', value: `${fpgaResult.inference_time_ms?.toFixed(0) ?? '--'}ms` },
                  { label: 'Frames',    value: fpgaFrames.toString() },
                  { label: 'Camera',    value: fpgaResult.resolution ?? '160×120' },
                ].map(s => (
                  <div key={s.label} className="card p-3 text-center">
                    <p className="text-base font-bold text-agri-400">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FPGA no result yet */}
          {source === 'fpga' && fpgaOnline && !fpgaResult?.result?.top_prediction?.label && (
            <div className="card p-10 text-center text-gray-600 text-sm flex flex-col items-center gap-3">
              <Cpu className="w-10 h-10 opacity-20" />
              <p>Waiting for FPGA camera frame…<br/><span className="text-xs">BTN0 triggers capture</span></p>
            </div>
          )}

          {/* Webcam result */}
          {source === 'webcam' && camState === 'predicting' && (
            <div className="card p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-agri-400 animate-spin" />
              <p className="text-gray-400 text-sm font-medium">Running TFLite inference…</p>
            </div>
          )}
          {source === 'webcam' && webResult && camState === 'done' && (
            <>
              <PredictionResult
                result={webResult.result}
                recommendation={webResult.recommendation}
                reportUrl={webResult.report_url}
                inferenceMs={webResult.inference_time_ms}
              />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Confidence', value: `${webResult.result?.top_prediction?.confidence_percent?.toFixed(1) ?? '--'}%` },
                  { label: 'Inference',  value: `${webResult.inference_time_ms?.toFixed(0) ?? '--'}ms` },
                  { label: 'Model',      value: 'TFLite INT8' },
                ].map(s => (
                  <div key={s.label} className="card p-3 text-center">
                    <p className="text-base font-bold text-agri-400">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {source === 'webcam' && !webResult && camState !== 'predicting' && (
            <div className="card p-12 text-center text-gray-600 text-sm flex flex-col items-center gap-3">
              <Camera className="w-10 h-10 opacity-20" />
              <p>Start the camera and click<br/><strong>Capture & Predict</strong></p>
            </div>
          )}

          {/* Instructions */}
          {source === 'fpga' && !fpgaOnline && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">Setup FPGA Live Stream</h3>
              <ol className="text-xs text-gray-500 space-y-2 list-decimal list-inside">
                <li>Run Vivado synthesis with updated <code className="text-agri-400">top.v</code></li>
                <li>Program FPGA board</li>
                <li>Open PowerShell:<br/>
                  <code className="text-agri-400 text-xs block mt-1 ml-4 bg-gray-900 px-2 py-1 rounded">
                    cd backend && python fpga_stream_bridge.py
                  </code>
                </li>
                <li>Stream appears automatically every 2 seconds</li>
                <li>Or press <strong className="text-gray-400">BTN0</strong> for instant capture</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FPGA snapshot auto-refresher ──────────────────────────────
function FpgaSnapshotRefresher({
  bridgeUrl, imgRef
}: {
  bridgeUrl: string;
  imgRef: React.RefObject<HTMLImageElement>;
}) {
  useEffect(() => {
    const id = setInterval(() => {
      if (imgRef.current) {
        imgRef.current.src = `${bridgeUrl}/snapshot?t=${Date.now()}`;
      }
    }, 800);
    return () => clearInterval(id);
  }, [bridgeUrl, imgRef]);
  return null;
}
