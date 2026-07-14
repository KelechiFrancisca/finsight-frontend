import { useState, useEffect, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import Papa from "papaparse";
import { FaArrowUp, FaArrowDown, FaBalanceScale, FaPercentage, FaPlus } from "react-icons/fa";

// ✅ Currency symbols + formatter
const currencySymbols = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  JPY: "¥",
  NGN: "₦",
  ZAR: "R",
  KES: "KSh",
  GHS: "₵",
  EGP: "£E",
  XOF: "CFA",
  XAF: "CFA"
};
function formatAmount(amount, currency = "NGN") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount).toLocaleString()}`;
}

// ✅ Universal base URL (local vs Render)
const baseUrl =
  process.env.REACT_APP_API_URL || 
  (window.location.hostname === "localhost"
    ? "http://127.0.0.1:5000"
    : "https://ai-business-insights-dashboard.onrender.com");

// ✅ Universal API fetch helper
const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${baseUrl}/api${endpoint}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

function normalizeDate(dateStr) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTransactions, setNewTransactions] = useState([
    { date: "", type: "Expense", category: "", description: "", amount: "" }
  ]);
  const [darkMode, setDarkMode] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [currency, setCurrency] = useState("USD");

  // Protect dashboard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setTransactions([]);
      setAlerts([]);
      window.location.href = "/login";
    }
  }, []);

  // Load entries
  const loadEntries = useCallback(() => {
    apiFetch("/entries")
      .then(data => {
        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          setTransactions([]);
        }
      })
      .catch(err => console.error("Error fetching entries:", err));
  }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Load alerts
  const loadAlerts = useCallback(() => {
    apiFetch("/alerts")
      .then(data => {
        if (data && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
        } else {
          setAlerts([]);
        }
      })
      .catch(err => console.error("Error fetching alerts:", err));
  }, []);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Load settings for currency
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${baseUrl}/settings`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then(res => res.json())
      .then(data => setCurrency(data.currency || "USD"))
      .catch(err => console.error("Error fetching settings:", err));
  }, []);

  // Logout clears state
  const handleLogout = () => {
    apiFetch("/clear_entries", { method: "DELETE" });
    localStorage.clear();
    setTransactions([]);
    setAlerts([]);
    window.location.href = "/login";
  };

  // Handlers
  const handleAddRow = () =>
    setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);

  const handleChange = (i, f, v) => {
    const u = [...newTransactions];
    u[i][f] = v;
    setNewTransactions(u);
  };

  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({
      ...t,
      date: normalizeDate(t.date),
      type: t.type.toLowerCase(),
      amount: parseFloat(t.amount) || 0
    }));
    apiFetch("/add", { method: "POST", body: JSON.stringify(formatted) })
      .then(() => {
        loadEntries();
        loadAlerts();
        setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
        setShowForm(false);
      });
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.filter(r => r.Date && r.Amount).map(r => ({
          date: normalizeDate(r.Date.trim()),
          type: r.Type.trim().toLowerCase(),
          category: r.Category.trim(),
          description: r.Description.trim(),
          amount: parseFloat(r.Amount.replace(/[^0-9.-]/g, "")) || 0
        }));
        apiFetch("/add", { method: "POST", body: JSON.stringify(parsed) })
          .then(() => { loadEntries(); loadAlerts(); });
      }
    });
  };

  const editTransaction = (id) => {
    const entry = transactions.find(t => t.id === id); if (!entry) return;
    const newDescription = prompt("Edit description:", entry.description); if (newDescription === null) return;
    apiFetch("/edit_entry", { method: "PUT", body: JSON.stringify({ ...entry, description: newDescription }) })
      .then(() => { loadEntries(); loadAlerts(); });
  };

  const deleteTransaction = (id) => {
    apiFetch("/delete_entry", { method: "DELETE", body: JSON.stringify({ id }) })
      .then(() => { loadEntries(); loadAlerts(); });
  };

  // Metrics
  const totalRevenue = transactions.filter(t => t.type.toLowerCase() === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type.toLowerCase() === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Chart data
  const monthlyData = {};
  transactions.forEach(t => {
    const key = t.date.slice(0,7);
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type.toLowerCase() === "income") monthlyData[key].income += Number(t.amount);
    else monthlyData[key].expense += Number(t.amount);
  });
  const chartData = {
    labels: Object.keys(monthlyData),
    datasets: [
      { label: "Revenue", data: Object.values(monthlyData).map(m => m.income), backgroundColor: "rgba(34,197,94,0.7)" },
      { label: "Expenses", data: Object.values(monthlyData).map(m => m.expense), backgroundColor: "rgba(239,68,68,0.7)" },
    ],
  };
  const options = { responsive: true, plugins: { legend: { position: "top" }, title: { display: true, text: "Revenue vs Expenses" } } };

    // ✅ Expense change calculation
  const now = new Date();
  const thisMonthKey = now.toISOString().slice(0,7);
  now.setMonth(now.getMonth() - 1);
  const lastMonthKey = now.toISOString().slice(0,7);
  const lastMonthExpenses = monthlyData[lastMonthKey]?.expense || 0;
  const thisMonthExpenses = monthlyData[thisMonthKey]?.expense || 0;
  const expenseChange = lastMonthExpenses > 0
    ? (((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100).toFixed(1)
    : 0;

  return (
    <div className={darkMode ? "bg-gray-900 text-white min-h-screen p-6" : "bg-gray-50 text-black min-h-screen p-6"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-extrabold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <a href={`${baseUrl}/sample_csv`} className="px-4 py-2 bg-green-600 text-white rounded font-bold" download="sample.csv">
              Download Sample CSV
            </a>
            <p className="text-sm text-gray-500">Use this template to avoid upload errors.</p>
          </div>
          <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer font-bold">
            Upload CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>
          <button onClick={() => setShowForm(true)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded font-bold">
            <FaPlus className="mr-2" /> Add Transactions
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-2 bg-gray-800 text-white rounded font-bold">
            Toggle {darkMode ? "Light" : "Dark"} Mode
          </button>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded font-bold">Logout</button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={darkMode ? "bg-gray-800 p-6 rounded-lg shadow text-white" : "bg-green-100 p-6 rounded-lg shadow"}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Total Revenue</h3>
            <FaArrowUp className={darkMode ? "text-green-300" : "text-green-600"} />
          </div>
          <p className={darkMode ? "text-3xl font-extrabold text-green-300" : "text-3xl font-extrabold text-green-600"}>
            {formatAmount(totalRevenue, currency)}
          </p>
        </div>
        <div className={darkMode ? "bg-gray-800 p-6 rounded-lg shadow text-white" : "bg-red-100 p-6 rounded-lg shadow"}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Total Expenses</h3>
            <FaArrowDown className={darkMode ? "text-red-300" : "text-red-600"} />
          </div>
          <p className={darkMode ? "text-3xl font-extrabold text-red-300" : "text-3xl font-extrabold text-red-600"}>
            {formatAmount(totalExpenses, currency)}
          </p>
        </div>
        <div className={darkMode ? "bg-gray-800 p-6 rounded-lg shadow text-white" : "bg-blue-100 p-6 rounded-lg shadow"}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Net Profit</h3>
            <FaBalanceScale className={darkMode ? "text-blue-300" : "text-blue-600"} />
          </div>
          <p className={darkMode ? "text-3xl font-extrabold text-blue-300" : "text-3xl font-extrabold text-blue-600"}>
            {formatAmount(netProfit, currency)}
          </p>
        </div>
        <div className={darkMode ? "bg-gray-800 p-6 rounded-lg shadow text-white" : "bg-purple-100 p-6 rounded-lg shadow"}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Profit Margin</h3>
            <FaPercentage className={darkMode ? "text-purple-300" : "text-purple-600"} />
          </div>
          <p className={darkMode ? "text-3xl font-extrabold text-purple-300" : "text-3xl font-extrabold text-purple-600"}>
            {profitMargin.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Cashflow Insights */}
      <div className={darkMode ? "bg-gray-800 p-6 rounded-lg shadow-md mb-6 text-white" : `p-6 rounded-lg shadow-md mb-6 ${netProfit < 2000 ? "bg-red-100" : "bg-teal-50"}`}>
        <h2 className="text-lg font-bold mb-2">📊 Cashflow Insights</h2>
        <p>📊 Expenses increased by {expenseChange}% compared to last month.</p>
        <p>🔮 Forecast: Cashflow looks stable for the next 2 months.</p>
        <p>💡 Suggested Action: Consider renegotiating supplier contracts or cutting non‑essential costs.</p>
        <p>📈 Net Profit: <span className="font-bold">{formatAmount(netProfit, currency)}</span> (Margin: {profitMargin.toFixed(2)}%)</p>
      </div>

      {/* Alerts Panel */}
      <div className={darkMode ? "bg-gray-800 p-6 rounded shadow mb-8 text-white" : "bg-white p-6 rounded shadow mb-8"}>
        <h2 className="text-2xl font-bold mb-4">Alerts</h2>
        {alerts.length > 0 ? (
          alerts.map((a) => {
            const level = a.level.toLowerCase();
            let borderColor = darkMode ? "border-blue-300" : "border-blue-600";
            let titleColor = darkMode ? "text-blue-300" : "text-blue-600";
            let title = "Informational";

            if (level === "high") {
              borderColor = darkMode ? "border-red-300" : "border-red-600";
              titleColor = darkMode ? "text-red-300" : "text-red-600";
              title = "High Priority";
            } else if (level === "medium") {
              borderColor = darkMode ? "border-yellow-300" : "border-yellow-600";
              titleColor = darkMode ? "text-yellow-300" : "text-yellow-600";
              title = "Medium Priority";
            }

            return (
              <div key={a.id} className={`p-4 rounded shadow mb-4 border-l-4 ${borderColor}`}>
                <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>
                <p>{a.message}</p>
              </div>
            );
          })
        ) : (
          <p>No alerts available.</p>
        )}
      </div>

      {/* Chart */}
      <div className={darkMode ? "bg-gray-800 p-6 rounded shadow mb-8 text-white" : "bg-white p-6 rounded shadow mb-8"}>
        <Bar data={chartData} options={options} />
      </div>

            {/* Multi-row Form */}
      {showForm && (
        <div className={darkMode ? "bg-gray-800 p-6 rounded mb-8 text-white" : "bg-gray-100 p-6 rounded mb-8"}>
          <h2 className="text-2xl font-bold mb-4">New Transactions</h2>
          <form onSubmit={handleSaveAll} className="space-y-6">
            {newTransactions.map((t, index) => (
              <div key={index} className="grid grid-cols-5 gap-4">
                <input 
                  type="date" 
                  value={t.date} 
                  onChange={(e) => handleChange(index, "date", e.target.value)} 
                  className={darkMode ? "p-2 border-2 rounded bg-gray-700 text-white" : "p-2 border-2 rounded text-black"} 
                  required 
                />
                <select 
                  value={t.type} 
                  onChange={(e) => handleChange(index, "type", e.target.value)} 
                  className={darkMode ? "p-2 border-2 rounded bg-gray-700 text-white" : "p-2 border-2 rounded text-black"}
                >
                  <option>Expense</option>
                  <option>Income</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Category" 
                  value={t.category} 
                  onChange={(e) => handleChange(index, "category", e.target.value)} 
                  className={darkMode ? "p-2 border-2 rounded bg-gray-700 text-white" : "p-2 border-2 rounded text-black"} 
                  required 
                />
                <input 
                  type="text" 
                  placeholder="Description" 
                  value={t.description} 
                  onChange={(e) => handleChange(index, "description", e.target.value)} 
                  className={darkMode ? "p-2 border-2 rounded bg-gray-700 text-white" : "p-2 border-2 rounded text-black"} 
                  required 
                />
                <input 
                  type="number" 
                  placeholder="Amount" 
                  value={t.amount} 
                  onChange={(e) => handleChange(index, "amount", e.target.value)} 
                  className={darkMode ? "p-2 border-2 rounded bg-gray-700 text-white" : "p-2 border-2 rounded text-black"} 
                  required 
                />
              </div>
            ))}
            <div className="flex space-x-4 mt-4">
              <button type="button" onClick={handleAddRow} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Add Another Row</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-400 text-white font-bold rounded">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-green-600 text-white font-bold rounded">Save Transactions</button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Transactions */}
      <div className={darkMode ? "bg-gray-800 p-6 rounded shadow text-white" : "bg-white p-6 rounded shadow"}>
        <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
        <table className={darkMode ? "min-w-full text-left text-base border-collapse text-white" : "min-w-full text-left text-base border-collapse text-black"}>
          <thead>
            <tr className={darkMode ? "border-b bg-gray-700 font-bold" : "border-b bg-gray-100 font-bold"}>
              <th className="py-2 px-4">Date</th>
              <th className="py-2 px-4">Type</th>
              <th className="py-2 px-4">Category</th>
              <th className="py-2 px-4">Description</th>
              <th className="py-2 px-4">Amount</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={darkMode ? "border-b hover:bg-gray-700" : "border-b hover:bg-gray-50"}>
                <td className="py-2 px-4">{t.date}</td>
                <td className={`py-2 px-4 font-semibold ${t.type.toLowerCase() === "income" ? (darkMode ? "text-green-300" : "text-green-600") : (darkMode ? "text-red-300" : "text-red-600")}`}>
                  {t.type}
                </td>
                <td className="py-2 px-4">{t.category}</td>
                <td className="py-2 px-4">{t.description}</td>
                <td className={`py-2 px-4 font-bold ${t.type.toLowerCase() === "income" ? (darkMode ? "text-green-300" : "text-green-600") : (darkMode ? "text-red-300" : "text-red-600")}`}>
                  {formatAmount(t.amount, currency)}
                </td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    onClick={() => editTransaction(t.id)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 font-bold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTransaction(t.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 font-bold"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
