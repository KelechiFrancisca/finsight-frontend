import { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";

// ✅ Currency symbols + formatter
const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥",
  NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E",
  XOF: "CFA", XAF: "CFA"
};

function formatAmount(amount, currency) {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount).toLocaleString()}`;
}

function Settings() {
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch(`${baseUrl}/settings`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => {
        setBusinessName(data.business_name || "");
        setCurrency(data.currency || "");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Settings fetch error:", err);
        setLoading(false);
      });
  }, [baseUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    fetch(`${baseUrl}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ business_name: businessName, currency }),
    })
      .then((res) => res.json())
      .then((data) => {
        toast.success(
          <div className="flex items-center space-x-2 font-bold">
            <FaCheckCircle className="text-green-600" />
            <span>{data.message || "Settings saved!"}</span>
          </div>
        );
      })
      .catch((err) => {
        console.error("Settings save error:", err);
        toast.error(
          <div className="flex items-center space-x-2 font-bold">
            <FaTimesCircle className="text-red-600" />
            <span>Failed to save settings.</span>
          </div>
        );
      });
  };

  const handleClearEntries = () => {
    if (window.confirm("Clear all transactions?")) {
      const token = localStorage.getItem("token");
      fetch(`${baseUrl}/clear_entries`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      })
        .then(() => {
          toast.info(
            <div className="flex items-center space-x-2 font-bold">
              <FaInfoCircle className="text-blue-600" />
              <span>Transactions cleared!</span>
            </div>
          );
        })
        .catch((err) => {
          console.error("Error clearing entries:", err);
          toast.error(
            <div className="flex items-center space-x-2 font-bold">
              <FaTimesCircle className="text-red-600" />
              <span>Failed to clear transactions.</span>
            </div>
          );
        });
    }
  };

  const confirmClearAll = () => {
    if (confirmText === "RESET") {
      const token = localStorage.getItem("token");
      fetch(`${baseUrl}/clear_all`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      })
        .then(() => {
          toast.success(
            <div className="flex items-center space-x-2 font-bold">
              <FaCheckCircle className="text-green-600" />
              <span>All data cleared successfully!</span>
            </div>
          );
          setTimeout(() => {
            localStorage.clear();
            window.location.href = "/login";
          }, 2000);
        })
        .catch((err) => {
          console.error("Error clearing all data:", err);
          toast.error(
            <div className="flex items-center space-x-2 font-bold">
              <FaTimesCircle className="text-red-600" />
              <span>Failed to clear all data.</span>
            </div>
          );
        });
    } else {
      toast.warn(
        <div className="flex items-center space-x-2 font-bold">
          <FaExclamationTriangle className="text-yellow-500" />
          <span>You must type RESET to confirm.</span>
        </div>
      );
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6 text-base md:text-lg font-bold">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md rounded-lg mb-6 p-4 flex justify-between items-center font-bold">
        <h1 className="text-xl font-extrabold text-gray-800">Business Dashboard</h1>
        <div className="space-x-4">
          <a href="/dashboard" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Dashboard</a>
          <a href="/forecast" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Forecast</a>
          <a href="/alerts" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Alerts</a>
          <a href="/settings" className="px-3 py-2 rounded bg-teal-600 text-white font-bold">Settings</a>
        </div>
      </nav>

      <h1 className="text-2xl font-extrabold mb-6 text-gray-800">Settings Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-600">Business Name</h2>
          <p className="text-2xl font-extrabold text-teal-600">{businessName || "Not Set"}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-600">Currency</h2>
          <p className="text-2xl font-extrabold text-indigo-600">{currency || "Not Set"}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-600">Data Status</h2>
          <p className="text-2xl font-extrabold text-red-600">Active</p>
        </div>
      </div>
      {/* Business Info */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-bold mb-4">Business Information</h2>
        {loading ? (
          <p className="font-bold">Loading...</p>
        ) : (
          <form className="space-y-4 font-bold" onSubmit={handleSubmit}>
            <div>
              <label className="block text-gray-700 font-bold">Business Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 font-bold"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold">Currency</label>
              <select
                className="w-full border rounded px-3 py-2 font-bold"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="ZAR">ZAR (R)</option>
                <option value="KES">KES (KSh)</option>
                <option value="GHS">GHS (₵)</option>
                <option value="EGP">EGP (£E)</option>
                <option value="XOF">XOF (CFA West)</option>
                <option value="XAF">XAF (CFA Central)</option>
              </select>
            </div>

            {/* Example preview */}
            <div className="mt-4 text-gray-600 font-bold">
              <p>Example formatted amount: {formatAmount(12000, currency)}</p>
            </div>

            <button
              type="submit"
              className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-extrabold"
            >
              Save Settings
            </button>
          </form>
        )}
      </div>

      {/* Data Management */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 font-bold">
        <h2 className="text-lg font-bold mb-4">Data Management</h2>
        <p className="text-gray-700 mb-4 font-bold">Manage your financial records here.</p>
        <button
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mr-4 font-extrabold"
          onClick={handleClearEntries}
        >
          Clear Transactions
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-400 p-6 rounded-lg shadow-md font-bold">
        <h2 className="text-lg font-bold mb-4 text-red-700">Danger Zone</h2>
        <p className="text-red-600 mb-4 font-bold">
          Reset Everything will permanently delete all transactions, alerts, and settings.
          This action cannot be undone.
        </p>
        <button
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-extrabold"
          onClick={() => setShowModal(true)}
        >
          Reset Everything
        </button>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96 font-bold">
            <h2 className="text-xl font-extrabold mb-4 text-red-700">Confirm Reset</h2>
            <p className="text-gray-700 mb-4 font-bold">
              Type <span className="font-extrabold text-red-600">RESET</span> below to confirm.
            </p>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 mb-4 font-bold"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 bg-gray-300 rounded font-bold"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-extrabold"
                onClick={confirmClearAll}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Container */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
}

export default Settings;
