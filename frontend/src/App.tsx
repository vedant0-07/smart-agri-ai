import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PestDetection from './pages/PestDetection';
import PlantDisease from './pages/PlantDisease';
import Fertilizer from './pages/Fertilizer';
import Irrigation from './pages/Irrigation';
import History from './pages/History';
import Models from './pages/Models';
import CameraCapture from './pages/CameraCapture';

export default function App() {
  // Keep Render backend awake by pinging every 10 min
  useEffect(() => {
    const ping = () => fetch('/health').catch(() => {});
    ping();
    const id = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 flex">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/camera" element={<CameraCapture />} />
              <Route path="/pest" element={<PestDetection />} />
              <Route path="/plant-disease" element={<PlantDisease />} />
              <Route path="/fertilizer" element={<Fertilizer />} />
              <Route path="/irrigation" element={<Irrigation />} />
              <Route path="/history" element={<History />} />
              <Route path="/models" element={<Models />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
