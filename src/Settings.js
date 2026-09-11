import { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaCheckCircle, FaExclamationTriangle, FaBuilding, FaCoins, FaDatabase } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥",
  NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E",
  XOF: "CFA", XAF: "CFA"
};

function formatAmount(amount, currency = "NGN") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Settings() {
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetch(`${API_BASE_URL}/settings`, {
      headers: { Authorization: "Bearer " + token },
    })
     .then((res) => res.json())
     .then((data) => {
        setBusinessName(data.business_name || "");
        setCurrency(data.currency || "NGN");
        setLoading(false);
      })
     .catch((err) => {
        console.error("Settings fetch error:", err);
        setLoading(false);
      });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.warn("Please enter a business name");
      return;
    }
    setSaving(true);
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ business_name: businessName.trim(), currency }),
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
        toast.error("Failed to save settings.");
      })
     .finally(() => setSaving(false));
  };

  const handleClearEntries = () => {
    if (window.confirm("Clear all transactions? This cannot be undone.")) {
      const token = localStorage.getItem("token");
      fetch(`${API_BASE_URL}/clear_entries`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      })
       .then(() => toast.info("Transactions cleared!"))
       .catch(() => toast.error("Failed to clear transactions."));
    }
  };

  const confirmClearAll = () => {
    if (confirmText!== "RESET") {
      toast.warn(
        <div className="flex items-center space-x-2 font-bold">
          <FaExclamationTriangle className="text-yellow-500" />
          <span>You must type RESET to confirm.</span>
        </div>
      );
      return;
    }
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/clear_all`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    })
     .then(() => {
        toast.success("All data cleared successfully!");
        setShowModal(false);
        setTimeout(() => {
          localStorage.clear();
          window.location.href = "/login";
        }, 2000);
      })
     .catch(() => toast.error("Failed to clear all data."));
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-teal-50 min-h-screen p-6 text-base md:text-lg">
      <nav className="bg-white/70 backdrop-blur-xl shadow-xl rounded-2xl mb-6 p-4 flex justify-between items-center font-bold">
        <h1 className="text-xl font-extrabold text-gray-800">Business Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          <a href="/dashboard" className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-teal-500 hover:text-white font-bold transition">Dashboard</a>
          <a href="/forecast" className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-teal-500 hover:text-white font-bold transition">Forecast</a>
          <a href="/alerts" className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-teal-500 hover:text-white font-bold transition">Alerts</a>
          <a href="/settings" className="px-3 py-2 rounded-xl bg-teal-600 text-white font-bold">Settings</a>
        </div>
      </nav>

      <h1 className="text-2xl font-extrabold mb-2 text-gray-800">Settings</h1>
      <p className="text-gray-600 mb-6 font-bold">Manage your business profile and data.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <FaBuilding className="text-teal-600" />
            <h2 className="font-bold text-gray-600">Business Name</h2>
          </div>
          <p className="text-2xl font-extrabold text-teal-600 truncate">{businessName || "Not Set"}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <FaCoins className="text-indigo-600" />
            <h2 className="font-bold text-gray-600">Currency</h2>
          </div>
          <p className="text-2xl font-extrabold text-indigo-600">{currency || "Not Set"} {currencySymbols[currency]}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <FaDatabase className="text-green-600" />
            <h2 className="font-bold text-gray-600">Data Status</h2>
          </div>
          <p className="text-2xl font-extrabold text-green-600">Active</p>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl mb-8">
        <h2 className="text-lg font-extrabold mb-4 text-gray-800">Business Information</h2>
        {loading? (
          <p className="font-bold animate-pulse">Loading...</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Business Name</label>
              <input
                type="text"
                placeholder="e.g. Divine Ventures"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Currency</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="CAD">CAD (C$) - Canadian Dollar</option>
                <option value="JPY">JPY (¥) - Japanese Yen</option>
                <option value="NGN">NGN (₦) - Nigerian Naira</option>
                <option value="ZAR">ZAR (R) - South African Rand</option>
                <option value="KES">KES (KSh) - Kenyan Shilling</option>
                <option value="GHS">GHS (₵) - Ghanaian Cedi</option>
                <option value="EGP">EGP (£E) - Egyptian Pound</option>
                <option value="XOF">XOF (CFA) - West African CFA</option>
                <option value="XAF">XAF (CFA) - Central African CFA</option>
              </select>
            </div>

            <div className="bg-teal-50 border border-teal-100 p-4 rounded-xl">
              <p className="text-sm text-gray-600 font-bold">Preview:</p>
              <p className="text-lg font-extrabold text-teal-700">{formatAmount(12500.5, currency)} • {formatAmount(1000000, currency)}</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-teal-600 text-white px-6 py-3 rounded-xl hover:bg-teal-700 font-extrabold disabled:opacity-50 transition"
            >
              {saving? "Saving..." : "Save Settings"}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl mb-8">
        <h2 className="text-lg font-extrabold mb-2 text-gray-800">Data Management</h2>
        <p className="text-gray-600 mb-4 font-bold">Clear transaction history but keep your settings.</p>
        <button
          className="bg-yellow-500 text-white px-6 py-3 rounded-xl hover:bg-yellow-600 font-extrabold transition"
          onClick={handleClearEntries}
        >
          Clear Transactions
        </button>
      </div>

      <div className="bg-red-50/70 backdrop-blur-xl border border-red-200 p-6 rounded-2xl shadow-xl">
        <h2 className="text-lg font-extrabold mb-2 text-red-700">Danger Zone</h2>
        <p className="text-red-600 mb-4 font-bold">
          Reset Everything will permanently delete all transactions, alerts, and settings. This cannot be undone.
        </p>
        <button
          className="bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 font-extrabold transition"
          onClick={() => setShowModal(true)}
        >
          Reset Everything
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h2 className="text-xl font-extrabold mb-2 text-red-700">Confirm Reset</h2>
            <p className="text-gray-700 mb-4 font-bold">
              Type <span className="font-extrabold text-red-600 bg-red-100 px-2 py-1 rounded">RESET</span> to confirm permanent deletion.
            </p>
            <input
              type="text"
              placeholder="Type RESET"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4 font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2.5 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition"
                onClick={() => { setShowModal(false); setConfirmText(""); }}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-extrabold transition"
                onClick={confirmClearAll}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default Settings;