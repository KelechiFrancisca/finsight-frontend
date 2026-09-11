import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
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

  // Hide sidebar on auth pages
  const isAuthPage = ["/login", "/register", "/forgot-password"].some(path => 
    location.pathname.startsWith(path)
  ) || location.pathname.startsWith("/reset-password");

  console.log("Backend URL:", process.env.REACT_APP_API_URL);

  return (
    <div className={`flex min-h-screen ${isDarkMode ? "dark bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      
      {/* Sidebar - only show if NOT auth page */}
      {!isAuthPage && sidebarOpen && (
        <aside className={`w-64 sm:w-56 md:w-64 shadow-md p-6 transition-transform duration-300 
          ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-bold text-blue-600">$</span>
              <h2 className="text-2xl font-bold">Financial Tracker</h2>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-500 hover:text-blue-600"
            >
              ✖
            </button>
          </div>
          <p className="text-sm mb-6">Business Analytics</p>
          <nav className="space-y-4">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Dashboard</NavLink>
            <NavLink to="/forecast" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Forecast</NavLink>
            <NavLink to="/alerts" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Alerts</NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Settings</NavLink>
            <NavLink to="/profile" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Profile</NavLink>
            {/* Only show auth links when NOT logged in */}
            {!token && (
              <>
                <NavLink to="/login" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Login</NavLink>
                <NavLink to="/register" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Register</NavLink>
                <NavLink to="/forgot-password" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block hover:text-blue-600"}>Forgot Password</NavLink>
              </>
            )}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        {!isAuthPage && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="mb-4 w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-lg text-lg hover:bg-blue-700"
          >
            ☰ Open Menu
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