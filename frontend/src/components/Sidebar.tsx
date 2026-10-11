import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bug, Leaf, Droplets, FlaskConical, LayoutDashboard,
  History, ChevronRight, Cpu, Menu, X, Camera
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/camera', label: '📷 Camera Capture', icon: Camera },
  { to: '/pest', label: 'Pest Detection', icon: Bug },
  { to: '/plant-disease', label: 'Plant Disease', icon: Leaf },
  { to: '/fertilizer', label: 'Fertilizer', icon: FlaskConical },
  { to: '/irrigation', label: 'Irrigation', icon: Droplets },
  { to: '/history', label: 'History', icon: History },
  { to: '/models', label: 'Model Management', icon: Cpu },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-agri-500 to-agri-700 rounded-xl flex items-center justify-center shadow-lg">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-100 text-sm leading-tight">Smart Agriculture</h1>
            <p className="text-xs text-agri-400 font-medium">TinyML Platform</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-3">
          Navigation
        </p>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              isActive ? 'nav-item-active' : 'nav-item'
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
            {location.pathname === to && (
              <ChevronRight className="w-3 h-3 ml-auto text-agri-400" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">
          Final Year Engineering Project
        </p>
        <p className="text-xs text-gray-700 text-center mt-1">
          AI-Powered Smart Agriculture
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-gray-900 border-r border-gray-800 fixed left-0 top-0 z-40">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-agri-500 to-agri-700 rounded-lg flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-100 text-sm">Smart Agriculture</span>
        </div>
        <button
          id="mobile-menu-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-gray-900 border-r border-gray-800 z-50 flex flex-col
          transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <NavContent />
      </aside>
    </>
  );
}
