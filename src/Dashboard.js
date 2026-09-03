import { useState, useEffect, useCallback } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import Papa from "papaparse";
import { FaArrowUp, FaArrowDown, FaBalanceScale, FaPercentage, FaPlus } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥", NGN: "₦", ZAR: "R",
  KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA"
};
function formatAmount(amount, currency = "NGN") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString()}`;
}

const normalizeCategory = (cat) => {
  if (!cat) return "Uncategorized";
  const trimmed = String(cat).trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
...(token? { Authorization: `Bearer ${token}` } : {}),
...options.headers,
  };
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

function normalizeDate(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

const formatMonthLabel = (key) => {
  const [year, month] = key.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const getMonthRange = (monthKeys) => {
  if (monthKeys.length === 0) return [];
  const sorted = [...monthKeys].sort();
  const start = new Date(sorted[0] + "-01");
  const end = new Date(sorted[sorted.length - 1] + "-01");
  const months = [];
  let current = new Date(start);
  while (current <= end) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
};

function Dashboard({ isDarkMode, setIsDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTransactions, setNewTransactions] = useState([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const [alerts, setAlerts] = useState([]);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setTransactions([]); setAlerts([]); window.location.href = "/login"; }
  }, []);

  const loadEntries = useCallback(() => {
    apiFetch("/entries").then(data => setTransactions(Array.isArray(data)? data : [])).catch(err => console.error("Error fetching entries:", err));
  }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const loadAlerts = useCallback(() => {
    apiFetch("/alerts").then(data => setAlerts(data && Array.isArray(data.alerts)? data.alerts : [])).catch(err => console.error("Error fetching alerts:", err));
  }, []);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token } })
.then(res => res.json()).then(data => setCurrency(data.currency || "USD")).catch(err => console.error("Error fetching settings:", err));
  }, []);

  const handleLogout = () => {
    apiFetch("/clear_entries", { method: "DELETE" });
    localStorage.clear(); setTransactions([]); setAlerts([]); window.location.href = "/login";
  };

  const handleAddRow = () => setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const handleChange = (i, f, v) => { const u = [...newTransactions]; u[i][f] = v; setNewTransactions(u); };

  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({...t, date: normalizeDate(t.date), type: t.type.toLowerCase(), category: normalizeCategory(t.category), amount: parseFloat(t.amount) || 0 }));
    apiFetch("/add", { method: "POST", body: JSON.stringify(formatted) }).then(() => { loadEntries(); loadAlerts(); setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]); setShowForm(false); });
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => {
      const parsed = results.data.filter(r => r.Date && r.Amount).map(r => ({
        date: normalizeDate(r.Date.trim()), type: r.Type.trim().toLowerCase(), category: normalizeCategory(r.Category.trim()),
        description: r.Description.trim(), amount: parseFloat(r.Amount.replace(/[^0-9.-]/g, "")) || 0
      }));
      apiFetch("/add", { method: "POST", body: JSON.stringify(parsed) }).then(() => { loadEntries(); loadAlerts(); });
    }});
  };

  const editTransaction = (id) => {
    const entry = transactions.find(t => t.id === id); if (!entry) return;
    const newDescription = prompt("Edit description:", entry.description); if (newDescription === null) return;
    apiFetch("/edit_entry", { method: "PUT", body: JSON.stringify({...entry, description: newDescription }) }).then(() => { loadEntries(); loadAlerts(); });
  };

  const deleteTransaction = (id) => {
    apiFetch("/delete_entry", { method: "DELETE", body: JSON.stringify({ id }) }).then(() => { loadEntries(); loadAlerts(); });
  };

  const totalRevenue = transactions.filter(t => t.type?.toLowerCase() === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type?.toLowerCase() === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;

  const monthlyData = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const key = t.date.slice(0,7);
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    const amt = Number(t.amount || 0);
    if (t.type?.toLowerCase() === "income") monthlyData[key].income += amt;
    else if (t.type?.toLowerCase() === "expense") monthlyData[key].expense += amt;
  });

  const allMonthKeys = getMonthRange(Object.keys(monthlyData));

  // ✅ BRIGHT CHART COLORS FOR LIGHT MODE
  const chartData = {
    labels: allMonthKeys.map(formatMonthLabel),
    datasets: [
      { label: "Revenue", data: allMonthKeys.map(k => monthlyData[k]?.income || 0), backgroundColor: "#10B981", borderColor: "#059669", borderWidth: 2, borderRadius: 8 },
      { label: "Expenses", data: allMonthKeys.map(k => monthlyData[k]?.expense || 0), backgroundColor: "#F43F5E", borderColor: "#E11D48", borderWidth: 2, borderRadius: 8 },
    ],
  };

  const categoryData = {};
  transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => {
    const cat = normalizeCategory(t.category);
    categoryData[cat] = (categoryData[cat] || 0) + Number(t.amount || 0);
  });
  const categoryChartData = {
    labels: Object.keys(categoryData),
    datasets: [{ label: "Expenses by Category", data: Object.values(categoryData), backgroundColor: ["#F43F5E", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"], borderColor: isDarkMode? "#1F2937" : "#fff", borderWidth: 3, hoverOffset: 12, cutout: '60%' }],
  };

  const profitTrendData = {
    labels: allMonthKeys.map(formatMonthLabel),
    datasets: [{ label: "Net Profit", data: allMonthKeys.map(k => (monthlyData[k]?.income || 0) - (monthlyData[k]?.expense || 0)), borderColor: isDarkMode? "#60A5FA" : "#2563EB", backgroundColor: isDarkMode? "rgba(96,165,250,0.2)" : "rgba(37,99,235,0.15)", borderWidth: 4, tension: 0.4, fill: true, pointRadius: 6, pointBorderWidth: 3 }],
  };

  const textColor = isDarkMode? '#F9FAFB' : '#111827';
  const gridColor = isDarkMode? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: textColor, font: { size: 15, weight: 'bold' }, padding: 20 } },
      title: { display: true, text: "Revenue vs Expenses", color: textColor, font: { size: 22, weight: 'bold' }, padding: 20 },
      tooltip: {
        backgroundColor: isDarkMode? '#1F2937' : '#FFFFFF',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: gridColor,
        borderWidth: 2,
        callbacks: {
          label: function(context) { return `${context.dataset.label}: ${formatAmount(context.parsed.y, currency)}`; }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor, font: { weight: '600', size: 13 }, callback: function(value) { return formatAmount(value, currency); } }
      },
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { weight: '600', size: 13 }, maxRotation: 45, minRotation: 45 }
      }
    }
  };

  const categoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: textColor, font: { size: 15, weight: '600' }, padding: 15 } },
      title: { display: true, text: "Expenses by Category", color: textColor, font: { size: 22, weight: 'bold' }, padding: 20 },
      tooltip: {
        backgroundColor: isDarkMode? '#1F2937' : '#FFFFFF',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: gridColor,
        borderWidth: 2,
        callbacks: {
          label: function(context) { return `${context.label}: ${formatAmount(context.parsed, currency)}`; }
        }
      }
    }
  };

  const profitOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: textColor, font: { weight: 'bold', size: 15 } } },
      title: { display: true, text: "Net Profit Trend", color: textColor, font: { size: 22, weight: 'bold' }, padding: 20 },
      tooltip: {
        backgroundColor: isDarkMode? '#1F2937' : '#FFFFFF',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: gridColor,
        borderWidth: 2,
        callbacks: {
          label: function(context) { return `Net Profit: ${formatAmount(context.parsed.y, currency)}`; }
        }
      }
    },
    scales: {
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { weight: '600', size: 13 }, callback: function(value) { return formatAmount(value, currency); } }
      },
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { weight: '600', size: 13 }, maxRotation: 45, minRotation: 45 }
      }
    }
  };

  return (
  <div className={isDarkMode? "bg-gray-900 text-white min-h-screen p-6" : "bg-gray-100 text-gray-900 min-h-screen p-6"}>
    <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
      <h1 className="text-4xl font-extrabold">Dashboard</h1>
      <div className="flex items-center space-x-4 flex-wrap">
        <div className="flex flex-col">
          <a href={`${API_BASE_URL}/sample_csv`} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg">Download Sample CSV</a>
          <p className={isDarkMode? "text-xs text-gray-400" : "text-xs text-gray-600"}>Use this template to avoid upload errors.</p>
        </div>
        <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer font-bold shadow-lg">Upload CSV<input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" /></label>
        <button onClick={() => setShowForm(true)} className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg"><FaPlus className="mr-2" /> Add Transactions</button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold shadow-lg">Toggle {isDarkMode? "Light" : "Dark"} Mode</button>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg">Logout</button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-xl shadow-xl text-white"><div className="flex justify-between items-center"><h3 className="text-xl font-bold">Total Revenue</h3><FaArrowUp className="text-white text-2xl" /></div><p className="text-3xl font-extrabold mt-2">{formatAmount(totalRevenue, currency)}</p></div>
      <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 rounded-xl shadow-xl text-white"><div className="flex justify-between items-center"><h3 className="text-xl font-bold">Total Expenses</h3><FaArrowDown className="text-white text-2xl" /></div><p className="text-3xl font-extrabold mt-2">{formatAmount(totalExpenses, currency)}</p></div>
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-xl shadow-xl text-white"><div className="flex justify-between items-center"><h3 className="text-xl font-bold">Net Profit</h3><FaBalanceScale className="text-white text-2xl" /></div><p className="text-3xl font-extrabold mt-2">{formatAmount(netProfit, currency)}</p></div>
      <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 p-6 rounded-xl shadow-xl text-white"><div className="flex justify-between items-center"><h3 className="text-xl font-bold">Profit Margin</h3><FaPercentage className="text-white text-2xl" /></div><p className="text-3xl font-extrabold mt-2">{profitMargin.toFixed(2)}%</p></div>
    </div>

    <div className={isDarkMode? "bg-gray-800 p-6 rounded-xl shadow-lg mb-6 text-white border-l-4 border-cyan-400" : "bg-white p-6 rounded-xl shadow-lg mb-6 text-gray-900 border-l-4 border-cyan-500"}><h2 className="text-lg font-bold mb-3">📊 Cashflow Insights</h2>{(() => {const sortedMonths = Object.keys(monthlyData).sort(); const lastM = sortedMonths[sortedMonths.length - 1]; const prevM = sortedMonths[sortedMonths.length - 2]; const lastExp = monthlyData[lastM]?.expense || 0; const prevExp = monthlyData[prevM]?.expense || 0; let changeText = ""; if (prevExp > 0) {const pct = ((lastExp - prevExp) / prevExp) * 100; changeText = `(${pct >= 0? 'Up' : 'Down'} ${Math.abs(pct).toFixed(1)}% vs last month)`;} else if (lastExp > 0) {changeText = `(First month with expenses)`;} const cashflowStatus = netProfit < 0? "unstable" : "stable"; const suggestedAction = totalExpenses > totalRevenue? "Consider renegotiating supplier contracts or cutting non‑essential costs." : "Explore growth investments to boost revenue."; return (<div className="space-y-2"><p>📊 Expenses this month: <span className="font-bold">{formatAmount(lastExp, currency)}</span> {changeText}</p><p>📊 Total Expenses All-Time: <span className="font-bold">{formatAmount(totalExpenses, currency)}</span></p><p>🔮 Forecast: Cashflow looks <span className="font-bold">{cashflowStatus}</span> based on all-time data.</p><p>💡 Suggested Action: {suggestedAction}</p><p>📈 Net Profit: <span className="font-bold">{formatAmount(netProfit, currency)}</span> (Margin: {profitMargin.toFixed(2)}%)</p></div>)})()}</div>

    <div className={isDarkMode? "bg-gray-800 p-6 rounded-xl shadow-lg mb-8 text-white" : "bg-white p-6 rounded-xl shadow-lg mb-8 text-gray-900"}><h2 className="text-2xl font-bold mb-4">Alerts</h2>{alerts.length > 0? (alerts.map((a) => {const level = a.level?.toLowerCase() || 'info'; let borderColor = "border-blue-500"; let titleColor = "text-blue-600"; let title = "Informational"; if (level === "high") {borderColor = "border-red-500"; titleColor = "text-red-600"; title = "High Priority";} else if (level === "medium") {borderColor = "border-yellow-500"; titleColor = "text-yellow-600"; title = "Medium Priority";} return (<div key={a.id} className={`p-4 rounded-lg shadow mb-4 border-l-4 ${borderColor} ${isDarkMode? "bg-gray-700" : "bg-blue-50"}`}><h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3><p>{a.message}</p></div>);})) : (<p>No alerts available.</p>)}</div>

    <div className={isDarkMode? "bg-gray-800 p-6 rounded-xl shadow-lg mb-8" : "bg-white p-6 rounded-xl shadow-lg mb-8"}><div style={{ height: '400px', padding: '10px 0' }}><Bar data={chartData} options={options} /></div></div>
    <div className={isDarkMode? "bg-gray-800 p-6 rounded-xl shadow-lg mb-8" : "bg-white p-6 rounded-xl shadow-lg mb-8"}><div style={{ height: '400px', padding: '10px 0' }}><Doughnut data={categoryChartData} options={categoryOptions} /></div></div>
    <div className={isDarkMode? "bg-gray-800 p-6 rounded-xl shadow-lg mb-8" : "bg-white p-6 rounded-xl shadow-lg mb-8"}><div style={{ height: '400px', padding: '10px 0' }}><Line data={profitTrendData} options={profitOptions} /></div></div>

    {showForm && (<div className={isDarkMode? "bg-gray-800 p-6 rounded-xl mb-8 text-white" : "bg-white p-6 rounded-xl mb-8 text-gray-900 shadow-lg"}><h2 className="text-2xl font-bold mb-4">New Transactions</h2><form onSubmit={handleSaveAll} className="space-y-6">{newTransactions.map((t, index) => (<div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4"><input type="date" value={t.date} onChange={(e) => handleChange(index, "date", e.target.value)} className={isDarkMode? "p-2 border-2 border-gray-600 rounded-lg bg-gray-700 text-white" : "p-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"} required /><select value={t.type} onChange={(e) => handleChange(index, "type", e.target.value)} className={isDarkMode? "p-2 border-2 border-gray-600 rounded-lg bg-gray-700 text-white" : "p-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"}><option>Expense</option><option>Income</option></select><input type="text" placeholder="Category" value={t.category} onChange={(e) => handleChange(index, "category", e.target.value)} className={isDarkMode? "p-2 border-2 border-gray-600 rounded-lg bg-gray-700 text-white" : "p-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"} required /><input type="text" placeholder="Description" value={t.description} onChange={(e) => handleChange(index, "description", e.target.value)} className={isDarkMode? "p-2 border-2 border-gray-600 rounded-lg bg-gray-700 text-white" : "p-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"} required /><input type="number" placeholder="Amount" value={t.amount} onChange={(e) => handleChange(index, "amount", e.target.value)} className={isDarkMode? "p-2 border-2 border-gray-600 rounded-lg bg-gray-700 text-white" : "p-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"} required /></div>))}<div className="flex space-x-4 mt-4"><button type="button" onClick={handleAddRow} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Add Another Row</button><button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg">Cancel</button><button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg">Save Transactions</button></div></form></div>)}

    <div className={isDarkMode? "bg-gray-800 p-6 rounded-xl shadow-lg text-white" : "bg-white p-6 rounded-xl shadow-lg text-gray-900"}>
      <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-base border-collapse">
          <thead><tr className={isDarkMode? "border-b border-gray-700 bg-gray-700" : "border-b bg-gray-200"}><th className="py-3 px-4 font-bold">Date</th><th className="py-3 px-4 font-bold">Type</th><th className="py-3 px-4 font-bold">Category</th><th className="py-3 px-4 font-bold">Description</th><th className="py-3 px-4 font-bold">Amount</th><th className="py-3 px-4 font-bold">Actions</th></tr></thead>
          <tbody>{transactions.length > 0? ([...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).map((t, idx) => (<tr key={t.id} className={isDarkMode? `border-b border-gray-700 hover:bg-gray-700` : `border-b hover:bg-gray-100 ${idx % 2 === 0? 'bg-white' : 'bg-gray-50'}`}><td className="py-3 px-4">{t.date}</td><td className="py-3 px-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${t.type?.toLowerCase() === "income"? (isDarkMode? "bg-green-900 text-green-300" : "bg-green-100 text-green-700") : (isDarkMode? "bg-red-900 text-red-300" : "bg-red-100 text-red-700")}`}>{t.type}</span></td><td className="py-3 px-4">{normalizeCategory(t.category)}</td><td className="py-3 px-4">{t.description}</td><td className={`py-3 px-4 font-bold ${t.type?.toLowerCase() === "income"? (isDarkMode? "text-green-400" : "text-green-600") : (isDarkMode? "text-red-400" : "text-red-600")}`}>{formatAmount(t.amount, currency)}</td><td className="py-3 px-4 space-x-2"><button onClick={() => editTransaction(t.id)} className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md font-bold">Edit</button><button onClick={() => deleteTransaction(t.id)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md font-bold">Delete</button></td></tr>))) : (<tr><td colSpan="6" className="py-4 text-center">No transactions available.</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>
  );
}

export default Dashboard;