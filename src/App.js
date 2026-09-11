import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useState } from "react";
import { FaTachometerAlt, FaChartLine, FaBell, FaCog, FaUser, FaSignOutAlt, FaBars, FaTimes } from "react-icons/fa";

import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import Forecast from "./Forecast";
import Alerts from "./Alerts";
import Settings from "./Settings";
import Profile from "./Profile";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import ProtectedRoute from "./ProtectedRoute";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const token = localStorage.getItem("token");
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage = ["/login", "/register", "/forgot-password"].some(path => 
    location.pathname.startsWith(path)
  ) || location.pathname.startsWith("/reset-password");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const linkBase = "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all";
  const linkActive = `${linkBase} bg-blue-600 text-white shadow-lg`;
  const linkInactive = (isDark) => `${linkBase} ${isDark ? "text-gray-300 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"}`;

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },
    { to: "/forecast", label: "Forecast", icon: <FaChartLine /> },
    { to: "/alerts", label: "Alerts", icon: <FaBell /> },
    { to: "/settings", label: "Settings", icon: <FaCog /> },
    { to: "/profile", label: "Profile", icon: <FaUser /> },
  ];

  return (
    <div className={`flex min-h-screen ${isDarkMode ? "dark bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      
      {!isAuthPage && sidebarOpen && (
        <aside className={`w-64 flex flex-col shadow-xl transition-all duration-300 
          ${isDarkMode ? "bg-gray-800/90 backdrop-blur-xl border-r border-white/10 text-gray-100" : "bg-white text-gray-900 border-r border-gray-200"}`}>
          
          <div className="p-6 pb-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-bold text-blue-600">$</span>
              <h2 className="text-xl font-bold">Financial Tracker</h2>
            </div>
            <button onClick={() => setSidebarOpen(false)} className={`p-2 rounded-lg ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
              <FaTimes />
            </button>
          </div>
          <p className={`text-xs px-6 mb-4 uppercase tracking-wider ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Business Analytics</p>
          
          <nav className="flex-1 px-4 space-y-2">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? linkActive : linkInactive(isDarkMode)}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            {!token && (
              <>
                <NavLink to="/login" className={({ isActive }) => isActive ? linkActive : linkInactive(isDarkMode)}>Login</NavLink>
                <NavLink to="/register" className={({ isActive }) => isActive ? linkActive : linkInactive(isDarkMode)}>Register</NavLink>
              </>
            )}
          </nav>

          {token && (
            <div className={`p-4 border-t ${isDarkMode ? "border-white/10" : "border-gray-200"}`}>
              <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 ${isDarkMode ? "bg-white/5" : "bg-gray-50"}`}>
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">U</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">User</p>
                  <p className="text-xs opacity-60 truncate">Logged in</p>
                </div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-all">
                <FaSignOutAlt /> Logout
              </button>
            </div>
          )}
        </aside>
      )}

      <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
        {!isAuthPage && !sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            <FaBars /> Open Menu
          </button>
        )}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} /></ProtectedRoute>} />
          <Route path="/forecast" element={<ProtectedRoute><Forecast isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;