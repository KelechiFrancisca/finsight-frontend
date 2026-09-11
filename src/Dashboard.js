import { useState, useEffect, useCallback, useMemo } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import Papa from "papaparse";
import { FaArrowUp, FaArrowDown, FaBalanceScale, FaPercentage, FaPlus, FaDownload } from "react-icons/fa";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import API_BASE_URL from "./apiConfig";
import Alerts from "./Alerts";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

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
  const headers = { "Content-Type": "application/json",...(token? { Authorization: `Bearer ${token}` } : {}),...options.headers };
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
  const [currency, setCurrency] = useState("USD");
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const glassCard = isDarkMode
  ? "bg-gray-800/70 backdrop-blur-xl border border-white/10 text-white"
    : "bg-white/70 backdrop-blur-xl border border-white/40 text-gray-900";
  const glassInput = isDarkMode
  ? "border border-white/10 rounded-xl px-3 py-2 bg-gray-700/70 backdrop-blur-xl text-white [color-scheme:dark] text-sm"
    : "border border-gray-200 rounded-xl px-3 py-2 bg-white/70 backdrop-blur-xl text-gray-900 [color-scheme:light] text-sm";

  // Professional KPI - glass + accent, not neon gradient
  const kpiBase = `${glassCard} p-5 rounded-2xl shadow-lg border-t-4 hover:scale-[1.02] transition cursor-pointer`;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setTransactions([]); window.location.href = "/login"; }
  }, []);

  const loadEntries = useCallback(() => {
    apiFetch("/entries").then(data => setTransactions(Array.isArray(data)? data : [])).catch(err => console.error("Error fetching entries:", err));
  }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token } })
  .then(res => res.json()).then(data => setCurrency(data.currency || "USD")).catch(err => console.error("Error fetching settings:", err));
  }, []);

  
  const handleAddRow = () => setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const handleChange = (i, f, v) => { const u = [...newTransactions]; u[i][f] = v; setNewTransactions(u); };

  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({...t, date: normalizeDate(t.date), type: t.type.toLowerCase(), category: normalizeCategory(t.category), amount: parseFloat(t.amount) || 0 }));
    apiFetch("/add", { method: "POST", body: JSON.stringify(formatted) }).then(() => { loadEntries(); setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]); setShowForm(false); });
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, complete: (results) => {
        const parsed = results.data.filter(r => r.Date && r.Amount).map(r => ({
          date: normalizeDate(r.Date.trim()), type: r.Type.trim().toLowerCase(), category: normalizeCategory(r.Category.trim()),
          description: r.Description.trim(), amount: parseFloat(r.Amount.replace(/[^0-9.-]/g, "")) || 0
        }));
        apiFetch("/add", { method: "POST", body: JSON.stringify(parsed) }).then(() => { loadEntries(); });
      }
    });
  };

  const editTransaction = (id) => {
    const entry = transactions.find(t => t.id === id); if (!entry) return;
    const newDescription = prompt("Edit description:", entry.description); if (newDescription === null) return;
    apiFetch("/edit_entry", { method: "PUT", body: JSON.stringify({...entry, description: newDescription }) }).then(() => { loadEntries(); });
  };
  const deleteTransaction = (id) => {
    apiFetch("/delete_entry", { method: "DELETE", body: JSON.stringify({ id }) }).then(() => { loadEntries(); });
  };
  const exportPDF = async () => {
    const input = document.getElementById('dashboard-to-pdf');
    const canvas = await html2canvas(input, { scale: 2, backgroundColor: isDarkMode? '#111827' : '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Financial-Report-${new Date().toLocaleDateString()}.pdf`);
  };
  const exportCSV = () => {
    const csv = Papa.unparse(filteredTransactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `transactions-${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const totalRevenue = transactions.filter(t => t.type?.toLowerCase() === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type?.toLowerCase() === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;

  const monthlyData = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const key = t.date.slice(0, 7);
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    const amt = Number(t.amount || 0);
    if (t.type?.toLowerCase() === "income") monthlyData[key].income += amt;
    else if (t.type?.toLowerCase() === "expense") monthlyData[key].expense += amt;
  });
  const allMonthKeys = getMonthRange(Object.keys(monthlyData));
  const filterByType = (type) => {
    setFilterType(type); setCurrentPage(1);
    document.getElementById('transactions-table')?.scrollIntoView({ behavior: 'smooth' });
  };
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
    datasets: [{
      label: "Net Profit", data: allMonthKeys.map(k => (monthlyData[k]?.income || 0) - (monthlyData[k]?.expense || 0)),
      borderColor: isDarkMode? "#60A5FA" : "#2563EB", backgroundColor: isDarkMode? "rgba(96,165,250,0.2)" : "rgba(37,99,235,0.15)",
      borderWidth: 4, tension: 0.4, fill: true, pointRadius: 6, pointBorderWidth: 3,
      segment: { borderColor: ctx => ctx.p0.parsed.y < 0 || ctx.p1.parsed.y < 0? '#F43F5E' : (isDarkMode? "#60A5FA" : "#2563EB") }
    }],
  };
  const textColor = isDarkMode? '#F9FAFB' : '#111827';
  const gridColor = isDarkMode? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: textColor, font: { size: 14, weight: 'bold' }, padding: 20 } },
      title: { display: true, text: "Revenue vs Expenses", color: textColor, font: { size: 20, weight: 'bold' }, padding: 20 },
      tooltip: { backgroundColor: isDarkMode? '#1F2937' : '#FFFFFF', titleColor: textColor, bodyColor: textColor, callbacks: { label: (c) => `${c.dataset.label}: ${formatAmount(c.parsed.y, currency)}` } }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => formatAmount(v, currency) } },
      x: { grid: { color: gridColor }, ticks: { color: textColor, maxRotation: 45, minRotation: 45 } }
    }
  };
  const categoryOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: textColor, font: { size: 14 } } },
      title: { display: true, text: "Expenses by Category", color: textColor, font: { size: 20, weight: 'bold' } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${formatAmount(c.parsed, currency)}` } }
    }
  };
  const profitOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: textColor } },
      title: { display: true, text: "Net Profit Trend", color: textColor, font: { size: 20, weight: 'bold' } },
      tooltip: { callbacks: { label: (c) => `Net Profit: ${formatAmount(c.parsed.y, currency)}` } }
    },
    scales: {
      y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => formatAmount(v, currency) } },
      x: { grid: { color: gridColor }, ticks: { color: textColor, maxRotation: 45, minRotation: 45 } }
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || tx.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || tx.type?.toLowerCase() === filterType;
      const txDate = new Date(tx.date);
      const matchesDate = (!dateRange.start || txDate >= new Date(dateRange.start)) && (!dateRange.end || txDate <= new Date(dateRange.end));
      return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, searchTerm, filterType, dateRange]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const highlightText = (text) => {
    if (!searchTerm) return text;
    const parts = String(text).split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => part.toLowerCase() === searchTerm.toLowerCase()? <span key={i} className="bg-yellow-300 text-black px-1 rounded">{part}</span> : part);
  };
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const calcTotalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const calcTotalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const calcCurrentCash = calcTotalIncome - calcTotalExpenses;
  const calcRecentExpenses = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= thirtyDaysAgo);
  const calcAvgMonthlyBurn = calcRecentExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  let calcRunway = 'N/A';
  if (calcAvgMonthlyBurn > 0 && calcCurrentCash > 0) { calcRunway = `${(calcCurrentCash / calcAvgMonthlyBurn).toFixed(1)} M`; }
  else if (calcAvgMonthlyBurn === 0 && calcCurrentCash > 0) { calcRunway = '∞'; }
  else if (calcCurrentCash <= 0) { calcRunway = '0 M'; }

  return (
    <div id="dashboard-to-pdf" className={isDarkMode? "bg-gradient-to-br from-gray-900 to-gray-800 text-white min-h-screen p-6" : "bg-gradient-to-br from-gray-50 to-teal-50 text-gray-900 min-h-screen p-6"}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportPDF} className="flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold"><FaDownload className="mr-2" /> PDF</button>
          <button onClick={exportCSV} className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold"><FaDownload className="mr-2" /> CSV</button>
          <a href={`${API_BASE_URL}/sample_csv`} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold">Sample CSV</a>
          <label className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer text-sm font-bold">Upload CSV<input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" /></label>
          <button onClick={() => setShowForm(true)} className="flex items-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold"><FaPlus className="mr-2" /> Add</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-bold">Toggle {isDarkMode? "Light" : "Dark"}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div onClick={() => filterByType('income')} className={`${kpiBase} border-green-500`}>
          <div className="flex justify-between items-center"><span className="text-sm font-semibold opacity-70">Total Revenue</span><FaArrowUp className="text-green-500" /></div>
          <p className="text-2xl font-extrabold mt-2">{formatAmount(totalRevenue, currency)}</p>
        </div>
        <div onClick={() => filterByType('expense')} className={`${kpiBase} border-red-500`}>
          <div className="flex justify-between items-center"><span className="text-sm font-semibold opacity-70">Total Expenses</span><FaArrowDown className="text-red-500" /></div>
          <p className="text-2xl font-extrabold mt-2">{formatAmount(totalExpenses, currency)}</p>
        </div>
        <div onClick={() => filterByType('all')} className={`${kpiBase} border-blue-500`}>
          <div className="flex justify-between items-center"><span className="text-sm font-semibold opacity-70">Net Profit</span><FaBalanceScale className="text-blue-500" /></div>
          <p className="text-2xl font-extrabold mt-2">{formatAmount(netProfit, currency)}</p>
        </div>
        <div className={`${kpiBase} border-purple-500`}>
          <div className="flex justify-between items-center"><span className="text-sm font-semibold opacity-70">Profit Margin</span><FaPercentage className="text-purple-500" /></div>
          <p className="text-2xl font-extrabold mt-2">{profitMargin.toFixed(2)}%</p>
        </div>
        <div className={`${kpiBase} border-orange-500`}>
          <div className="flex justify-between items-center"><span className="text-sm font-semibold opacity-70">Runway</span><FaBalanceScale className="text-orange-500" /></div>
          <p className="text-2xl font-extrabold mt-2">{calcRunway}</p>
          <p className="text-xs mt-1 opacity-60">Based on last 30 days</p>
        </div>
      </div>

      <div className={`${glassCard} p-5 rounded-2xl shadow-lg mb-6 border-l-4 border-cyan-500`}><h2 className="text-lg font-bold mb-3">Cashflow Insights</h2>{(() => { const sortedMonths = Object.keys(monthlyData).sort(); const lastM = sortedMonths[sortedMonths.length - 1]; const prevM = sortedMonths[sortedMonths.length - 2]; const lastExp = monthlyData[lastM]?.expense || 0; const prevExp = monthlyData[prevM]?.expense || 0; let changeText = ""; if (prevExp > 0) { const pct = ((lastExp - prevExp) / prevExp) * 100; changeText = `(${pct >= 0? 'Up' : 'Down'} ${Math.abs(pct).toFixed(1)}% vs last month)`; } else if (lastExp > 0) { changeText = `(First month with expenses)`; } const cashflowStatus = netProfit < 0? "unstable" : "stable"; const suggestedAction = totalExpenses > totalRevenue? "Consider renegotiating supplier contracts or cutting non-essential costs." : "Explore growth investments to boost revenue."; return (<div className="space-y-2 text-sm"><p>Expenses this month: <span className="font-bold">{formatAmount(lastExp, currency)}</span> {changeText}</p><p>Total Expenses All-Time: <span className="font-bold">{formatAmount(totalExpenses, currency)}</span></p><p>Forecast: Cashflow looks <span className="font-bold">{cashflowStatus}</span> based on all-time data.</p><p>Suggested Action: {suggestedAction}</p><p>Net Profit: <span className="font-bold">{formatAmount(netProfit, currency)}</span> (Margin: {profitMargin.toFixed(2)}%)</p></div>) })()}</div>

      <Alerts dashboardData={{ totalRevenue, totalExpenses, netProfit, profitMargin }} isDarkMode={isDarkMode} />

      <div className={`${glassCard} p-5 rounded-2xl shadow-lg mb-6`}><div style={{ height: '380px' }}><Bar data={chartData} options={options} /></div></div>
      <div className={`${glassCard} p-5 rounded-2xl shadow-lg mb-6`}><div style={{ height: '380px' }}><Doughnut data={categoryChartData} options={categoryOptions} /></div></div>
      <div className={`${glassCard} p-5 rounded-2xl shadow-lg mb-6`}><div style={{ height: '380px' }}><Line data={profitTrendData} options={profitOptions} /></div></div>

      {showForm && (<div className={`${glassCard} p-5 rounded-2xl mb-6 shadow-lg`}><h2 className="text-xl font-bold mb-4">New Transactions</h2><form onSubmit={handleSaveAll} className="space-y-4">{newTransactions.map((t, index) => (<div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3"><input type="date" value={t.date} onChange={(e) => handleChange(index, "date", e.target.value)} className={glassInput} required /><select value={t.type} onChange={(e) => handleChange(index, "type", e.target.value)} className={glassInput}><option>Expense</option><option>Income</option></select><input type="text" placeholder="Category" value={t.category} onChange={(e) => handleChange(index, "category", e.target.value)} className={glassInput} required /><input type="text" placeholder="Description" value={t.description} onChange={(e) => handleChange(index, "description", e.target.value)} className={glassInput} required /><input type="number" placeholder="Amount" value={t.amount} onChange={(e) => handleChange(index, "amount", e.target.value)} className={glassInput} required /></div>))}<div className="flex gap-3 mt-4"><button type="button" onClick={handleAddRow} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">Add Row</button><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-400 text-white rounded-xl text-sm font-bold">Cancel</button><button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold">Save</button></div></form></div>)}

      <div id="transactions-table" className={`${glassCard} p-5 rounded-2xl shadow-lg`}>
        <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className={glassInput} />
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }} className={glassInput}><option value="all">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select>
          {/* Single native date inputs - no wrapper, fixes double calendar */}
          <input type="date" value={dateRange.start} onChange={(e) => { setDateRange({...dateRange, start: e.target.value }); setCurrentPage(1); }} onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }} className={glassInput} />
<input type="date" value={dateRange.end} onChange={(e) => { setDateRange({...dateRange, end: e.target.value }); setCurrentPage(1); }} onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }} className={glassInput} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className={isDarkMode? "border-b border-white/10 bg-white/5" : "border-b bg-black/5"}><th className="py-3 px-4">Date</th><th className="py-3 px-4">Type</th><th className="py-3 px-4">Category</th><th className="py-3 px-4">Description</th><th className="py-3 px-4">Amount</th><th className="py-3 px-4">Actions</th></tr></thead>
            <tbody>{paginatedTransactions.length > 0? (paginatedTransactions.map((t, idx) => (<tr key={t.id || idx} className={isDarkMode? `border-b border-white/5 hover:bg-white/5` : `border-b hover:bg-black/5`}><td className="py-3 px-4">{t.date}</td><td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${t.type?.toLowerCase() === "income"? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{t.type}</span></td><td className="py-3 px-4">{highlightText(normalizeCategory(t.category))}</td><td className="py-3 px-4">{highlightText(t.description)}</td><td className="py-3 px-4 font-bold">{formatAmount(t.amount, currency)}</td><td className="py-3 px-4 space-x-2"><button onClick={() => editTransaction(t.id)} className="px-3 py-1 bg-yellow-500 text-white rounded-md text-xs font-bold">Edit</button><button onClick={() => deleteTransaction(t.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold">Delete</button></td></tr>))) : (<tr><td colSpan="6" className="py-4 text-center">No transactions found.</td></tr>)}</tbody>
          </table>
        </div>
        {filteredTransactions.length > itemsPerPage && (
          <div className="flex justify-between items-center mt-4 text-sm">
            <p>Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}</p>
            <div className="flex gap-2 items-center">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-gray-600 text-white rounded-lg disabled:opacity-50">Prev</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 bg-gray-600 text-white rounded-lg disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default Dashboard;