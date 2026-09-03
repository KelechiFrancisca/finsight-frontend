import { useEffect, useState, useRef } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import API_BASE_URL from "./apiConfig"; // ✅ unified import
import jsPDF from "jspdf"; // UPGRADE
import html2canvas from "html2canvas"; // UPGRADE

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// ✅ Currency symbols + formatter - YOURS
const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥",
  NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E",
  XOF: "CFA", XAF: "CFA"
};

function formatAmount(amount, currency) {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function Forecast() {
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [activeScenario, setScenario] = useState("Realistic");
  const [showModal, setShowModal] = useState(false);
  const [horizon, setHorizon] = useState(12);
  const [currency, setCurrency] = useState("USD");
  const [toast, setToast] = useState(null); // UPGRADE
  const reportRef = useRef(); // UPGRADE

  useEffect(() => {
  // ✅ Restore saved horizon from localStorage
  const savedHorizon = localStorage.getItem("horizon");
  if (savedHorizon) setHorizon(Number(savedHorizon));

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  // ✅ Fetch entries
  fetch(`${API_BASE_URL}/entries`, {
    headers: { Authorization: "Bearer " + token },
  })
.then((res) => res.json())
.then((data) => {
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    })
.catch((err) => console.error("Error fetching entries:", err));

  // ✅ Fetch settings for currency + horizon
  fetch(`${API_BASE_URL}/settings`, {
    headers: { Authorization: "Bearer " + token },
  })
.then((res) => res.json())
.then((data) => {
      setCurrency(data.currency || "USD");
      if (data.horizon) setHorizon(data.horizon);
    })
.catch((err) => console.error("Error fetching settings:", err));

  // ✅ Read?tab= query parameter from URL
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  if (tabParam) {
    setActiveTab(tabParam);
  }
}, []); // ✅ empty dependency array, no ESLint warning

  // Totals - YOURS
const totalRevenue = transactions
.filter(t => t.type && t.type.toLowerCase() === "income")
.reduce((sum, t) => sum + Number(t.amount || 0), 0);

const totalExpenses = transactions
.filter(t => t.type && t.type.toLowerCase() === "expense")
.reduce((sum, t) => sum + Number(t.amount || 0), 0);

const netProfit = totalRevenue - totalExpenses;
const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;

// ✅ FIX 1: SMART DATE PARSING + NEVER SHOW "NO EXPENSES" IF DATA EXISTS
const monthlyData = {};
transactions.forEach(t => {
  if(!t.date) return;
  const d = new Date(t.date);
  if(isNaN(d)) return;
  const key = d.toISOString().slice(0, 7);
  if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
  if (t.type && t.type.toLowerCase() === "income") {
    monthlyData[key].income += Number(t.amount || 0);
  } else if (t.type && t.type.toLowerCase() === "expense") {
    monthlyData[key].expense += Number(t.amount || 0);
  }
});

const sortedMonths = Object.keys(monthlyData).sort();
const lastRecordedMonth = sortedMonths[sortedMonths.length - 1];
const lastRecordedExpenses = lastRecordedMonth? monthlyData[lastRecordedMonth].expense : 0;
const lastRecordedMonthName = lastRecordedMonth? new Date(lastRecordedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : '';

// SMART TEXT: finds last 2 months with data
let expenseChangeText = "";
if(sortedMonths.length === 0 || totalExpenses === 0){
  expenseChangeText = "No expenses recorded yet";
} else if(sortedMonths.length === 1){
  expenseChangeText = `First expense recorded: ${formatAmount(lastRecordedExpenses, currency)} in ${lastRecordedMonthName}`;
} else {
  const currentMonth = sortedMonths[sortedMonths.length - 1];
  const prevMonth = sortedMonths[sortedMonths.length - 2];
  const currentExp = monthlyData[currentMonth].expense;
  const prevExp = monthlyData[prevMonth].expense;
  if(prevExp > 0){
    const percentChange = ((currentExp - prevExp) / prevExp) * 100;
    const direction = percentChange > 0? "increased" : "decreased";
    expenseChangeText = `Expenses ${direction} by ${Math.abs(percentChange).toFixed(1)}% compared to ${new Date(prevMonth + '-01').toLocaleString('default', { month: 'long' })}`;
  } else {
    expenseChangeText = `Last recorded expenses: ${formatAmount(lastRecordedExpenses, currency)} in ${lastRecordedMonthName}`;
  }
}

  // ✅ FIX 2: Scenario datasets - CHANGED TO BEAT COMPETITORS
  const scenarios = {
    Optimistic: { revenueChange: 10, expenseChange: 3 }, // WAS -5
    Realistic: { revenueChange: 5, expenseChange: 2 }, // WAS 0
    Pessimistic: { revenueChange: 2, expenseChange: 5 },
  };

  const scenario = scenarios[activeScenario];

  // Adjusted values - YOURS
  const adjustedRevenue = totalRevenue * (1 + scenario.revenueChange / 100);
  const adjustedExpenses = totalExpenses * (1 + scenario.expenseChange / 100);
  const adjustedProfit = adjustedRevenue - adjustedExpenses;
  const adjustedMargin = adjustedRevenue > 0? (adjustedProfit / adjustedRevenue) * 100 : 0;

  // Multi‑month projections - YOURS
  const monthsAhead = Array.from({ length: horizon }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1);
    return d.toLocaleString("default", { month: "short", year: "numeric" });
  });

  const projectedRevenue = monthsAhead.map((_, i) =>
    adjustedRevenue * Math.pow(1 + scenario.revenueChange / 100, i + 1)
  );
  const projectedExpenses = monthsAhead.map((_, i) =>
    adjustedExpenses * Math.pow(1 + scenario.expenseChange / 100, i + 1)
  );
  const projectedProfit = projectedRevenue.map((rev, i) => rev - projectedExpenses[i]);
  const projectedMargin = projectedRevenue.map((rev, i) =>
    rev > 0? ((rev - projectedExpenses[i]) / rev) * 100 : 0
  );

  // Cumulative cashflow - YOURS
  const startingReserves = 5000;
  const cumulativeCashflow = projectedProfit.reduce((acc, profit, i) => {
    const prev = i === 0? startingReserves : acc[i - 1];
    acc.push(prev + profit);
    return acc;
  }, []);

  // ✅ FIX 2: Cash Runway - ONLY SHOW IF < 12 MONTHS + YOUR STYLE
  const monthlyBurn = lastRecordedExpenses > 0? lastRecordedExpenses : totalExpenses > 0? totalExpenses : 1;
  const cashRunway = startingReserves / monthlyBurn;
  const runOutMonthIndex = cumulativeCashflow.findIndex((c) => c <= 0);
  const willRunOut = runOutMonthIndex!== -1;
  const runOutMonth = willRunOut? monthsAhead[runOutMonthIndex] : `Not in next ${horizon} months`;

  // ✅ UPGRADE 3: Top Expense for "WHY"
  const expenseByCategory = {};
  transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => {
    expenseByCategory[t.category || "Other"] = (expenseByCategory[t.category || "Other"] || 0) + Number(t.amount || 0);
  });
  const topExpense = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  const topExpenseText = topExpense? `Top expense: ${topExpense[0]} - ${formatAmount(topExpense[1], currency)}` : "Add expenses to see breakdown";

  // Export CSV - YOURS + TOAST
  const exportCSV = () => {
    const rows = [["Month","Revenue","Expenses","Profit","Margin"]];
    monthsAhead.forEach((m, i) => {
      rows.push([m, projectedRevenue[i], projectedExpenses[i], projectedProfit[i], projectedMargin[i]]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "forecast.csv";
    link.click();
    setToast("📂 Forecast exported to CSV!");
    setTimeout(() => setToast(null), 3000);
  };

  // ✅ UPGRADE 4: Export PDF
  const exportPDF = async () => {
    const element = reportRef.current;
    if(!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`FinSightAI-Forecast-${new Date().toISOString().slice(0,10)}.pdf`);
    setToast("📄 Forecast exported to PDF!");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div ref={reportRef} className="bg-gray-100 min-h-screen p-6 text-base md:text-lg font-bold">
      <h1 className="text-2xl font-extrabold mb-6 text-gray-800">AI-Powered Forecast</h1>

      {/* KPI Cards - YOURS + UPGRADE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-green-100 p-4 rounded-lg shadow-md flex-col items-center">
          <span className="text-2xl">💰</span>
          <h2 className="text-sm font-bold text-gray-600">Revenue</h2>
          <p className="text-3xl font-extrabold text-green-700">{formatAmount(totalRevenue, currency)}</p>
        </div>
        <div className="bg-red-100 p-4 rounded-lg shadow-md flex-col items-center">
          <span className="text-2xl">📉</span>
          <h2 className="text-sm font-bold text-gray-600">Expenses</h2>
          <p className="text-3xl font-extrabold text-red-700">{formatAmount(totalExpenses, currency)}</p>
        </div>
        <div className="bg-blue-100 p-4 rounded-lg shadow-md flex-col items-center">
          <span className="text-2xl">📈</span>
          <h2 className="text-sm font-bold text-gray-600">Net Profit</h2>
          <p className="text-3xl font-extrabold text-blue-700">{formatAmount(netProfit, currency)}</p>
          {/* ✅ FIX 2: ONLY SHOW RUNWAY IF < 12 MONTHS */}
          {monthlyBurn > 0 && cashRunway < 12 && (
            <p className="text-xs text-gray-600 mt-1">
              {cashRunway < 1
          ? `⚠ At current spending, cash covers ~${Math.max(1, Math.round(cashRunway * 30))} days`
                : `✅ Cash covers ~${cashRunway.toFixed(1)} months`
              }
            </p>
          )}
        </div>
        <div className="bg-purple-100 p-4 rounded-lg shadow-md flex-col items-center">
          <span className="text-2xl">📊</span>
          <h2 className="text-sm font-bold text-gray-600">Margin</h2>
          <p className="text-3xl font-extrabold text-purple-700">{profitMargin.toFixed(2)}%</p>
          <p className="text-xs text-gray-600 mt-1">{topExpenseText}</p>
        </div>
      </div>

      {/* Cashflow Insights - YOURS + FIXED */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${netProfit < 0? "bg-red-100" : "bg-teal-50"}`}>
        <h2 className="text-lg font-bold mb-2 text-gray-800">📊 Cashflow Insights</h2>
        {/* ✅ FIX 1: SMART EXPENSE TEXT */}
        <p className="text-gray-700">📊 {expenseChangeText}</p>
        <p className="text-gray-700">🔮 Forecast: Cashflow looks {projectedProfit.every(p => p > 0)? "stable" : "at risk"} for the next {horizon} months.</p>
        <p className="text-gray-700">💡 Suggested Action: {netProfit < 0? `Cut costs in ${topExpense?.[0] || "top categories"}` : "Explore growth investments to boost revenue."}</p>
        <p className="text-gray-700">📈 Net Profit: <span className="font-extrabold">{formatAmount(netProfit, currency)}</span> (Margin: {profitMargin.toFixed(2)}%)</p>
      </div>

      {/* Scenario Compare Toggle - YOURS */}
      <div className="flex space-x-4 mb-6 font-bold">
        {["Optimistic", "Realistic", "Pessimistic"].map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`px-4 py-2 rounded-lg font-bold ${activeScenario === s? "bg-teal-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Forecast Horizon Dropdown - YOURS + PDF + BANK BUTTON */}
<div className="mb-6 flex items-center space-x-4 font-bold flex-wrap">
  <div>
    <label className="block text-sm font-bold text-gray-700">Forecast Horizon</label>
    <select
      value={horizon}
      onChange={(e) => {
        const val = Number(e.target.value);
        setHorizon(val);
        localStorage.setItem("horizon", val);
      }}
      className="border p-2 rounded w-40 font-bold"
    >
      <option value={6}>6 months</option>
      <option value={12}>12 months</option>
      <option value={24}>24 months</option>
    </select>
    <p className="text-xs text-gray-500 mt-1">All reports will use {currency}</p>
  </div>
  <button onClick={exportCSV} className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold">Export CSV</button>
  <button onClick={exportPDF} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-bold">Export PDF</button>
  <button disabled className="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed font-bold">Connect Bank/POS - Coming in v2</button>
</div>

      {/* Forecast Summary Card - YOURS */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-300 text-white p-6 rounded-lg shadow-md mb-8 font-bold">
        <h2 className="text-xl font-bold mb-2">Forecast Summary ({activeScenario})</h2>
        <p className="text-lg">{netProfit < 0? "⚠ Cash reserves may dip below safe levels. Consider reducing expenses or boosting revenue." : "✅ Cashflow looks stable. Current reserves are sufficient to sustain operations."}</p>
        <p className="mt-2">Current Margin: <span className="font-extrabold">{profitMargin.toFixed(2)}%</span></p>
        <p>Projected Profit in {horizon} months: <span className="font-extrabold">{formatAmount(projectedProfit[horizon-1] || 0, currency)}</span></p>
        <p>Projected Margin in {horizon} months: <span className="font-extrabold">{(projectedMargin[horizon-1] || 0).toFixed(2)}%</span>{" "}{(projectedMargin[horizon-1] || 0) > profitMargin? "⬆" : (projectedMargin[horizon-1] || 0) < profitMargin? "⬇" : "➡"}</p>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-extrabold mt-2 inline-block">Adjusted Margin: {adjustedMargin.toFixed(2)}%{" "}{adjustedMargin > profitMargin? "⬆" : adjustedMargin < profitMargin? "⬇" : "➡"}</span>
        <div className="mt-4">
          <button onClick={() => setShowModal(true)} className="bg-white text-teal-600 font-bold px-4 py-2 rounded-lg shadow hover:bg-gray-100">{netProfit < 0? "Cut Costs by 10%" : "Invest in Growth"}</button>
        </div>
      </div>

      {/* Modal Popup - YOURS + UPGRADE */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md font-bold">
            <h3 className="text-lg font-bold mb-4 text-gray-800">{netProfit < 0? "⚠ Action Plan: Cashflow Risk" : "✅ Action Plan: Growth"}</h3>
            {netProfit < 0? (
              <div className="text-gray-700 mb-4">
                <p className="mb-2">Problem: You are losing money</p>
                <p className="text-sm text-gray-500 mb-3">Biggest leak: {topExpense?.[0] || "Expenses"}</p>
                <p className="font-bold mb-2">Suggested Actions:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Cut {topExpense?.[0] || "biggest expense"} by 10%</li>
                  <li>Delay non-critical purchases for 30 days</li>
                  <li>Switch to "Pessimistic" scenario to see impact</li>
                </ol>
              </div>
            ) : (
              <div className="text-gray-700 mb-4">
                <p className="font-bold mb-2">Suggested Actions:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Reinvest 20% of profit into marketing</li>
                  <li>Hire to remove bottleneck</li>
                  <li>Build 3-month cash reserve</li>
                </ol>
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setShowModal(false)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 font-bold">Close</button>
              <a href="/alerts" className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold">Take Action →</a>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Charts - YOURS EXACTLY */}
<div className="bg-white p-6 rounded-lg shadow-md font-bold">
  <h2 className="text-lg font-bold text-gray-800 mb-4">Forecast Visuals</h2>
  <div className="flex space-x-4 mb-6 flex-wrap font-bold">
    {["trend","proportion","liquidity","growth","risk","efficiency","breakdown","heatmap"].map(tab => (
      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded mb-2 font-bold ${activeTab === tab? "bg-teal-600 text-white" : "bg-gray-200"}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
    ))}
  </div>

  {/* Trend Chart */}
  {activeTab === "trend" && (
    <div>
      <Line data={{ labels: monthsAhead, datasets: [ { label: "Revenue", data: projectedRevenue, borderColor: "#10B981", backgroundColor: "#A7F3D0", fill: true, tension: 0.4 }, { label: "Expenses", data: projectedExpenses, borderColor: "#EF4444", backgroundColor: "#FCA5A5", fill: true, tension: 0.4 }, { label: "Profit", data: projectedProfit, borderColor: "#3B82F6", backgroundColor: "#93C5FD", fill: true, tension: 0.4 }, ] }} />
      <p className="mt-3 text-sm text-gray-700 font-bold">📈 By {monthsAhead[horizon-1]}, revenue is projected at {formatAmount(projectedRevenue[horizon-1], currency)}, expenses at {formatAmount(projectedExpenses[horizon-1], currency)}, and profit at {formatAmount(projectedProfit[horizon-1], currency)}.</p>
      {willRunOut && <p className="mt-2 text-base text-red-700 font-extrabold">⚠ We predict you’ll run out of cash in {runOutMonth} in {activeScenario} mode</p>}
    </div>
  )}

  {/* Proportion Chart */}
  {activeTab === "proportion" && (
    <div>
      <Bar data={{ labels: monthsAhead, datasets: [ { label: "Expenses", data: projectedExpenses, backgroundColor: "#FCA5A5", stack: "combined" }, { label: "Profit", data: projectedProfit, backgroundColor: "#A7F3D0", stack: "combined" }, ] }} options={{ scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }}} />
      <p className="mt-3 text-sm text-gray-700 font-bold">💰 In {monthsAhead[horizon-1]}, expenses are {((projectedExpenses[horizon-1] / projectedRevenue[horizon-1]) * 100).toFixed(1)}% of revenue, leaving a profit margin of {projectedMargin[horizon-1].toFixed(1)}%.</p>
    </div>
  )}

  {/* Liquidity Chart */}
  {activeTab === "liquidity" && (
    <div>
      <Line data={{ labels: monthsAhead, datasets: [ { label: "Cash Reserves", data: cumulativeCashflow, borderColor: "#14B8A6", backgroundColor: "#67E8F9", fill: true, tension: 0.4, }, ] }} />
      <p className="mt-3 text-sm text-gray-700 font-bold">📊 Cash reserves start at {formatAmount(cumulativeCashflow[0], currency)} and are projected to reach {formatAmount(cumulativeCashflow[horizon-1], currency)} by {monthsAhead[horizon-1]}.</p>
    </div>
  )}

  {/* Growth Tab */}
  {activeTab === "growth" && (
    <div>
      <Line data={{ labels: monthsAhead, datasets: [ { label: "Sales Growth (%)", data: projectedRevenue.map((rev, i) => i === 0? 0 : ((rev - projectedRevenue[i - 1]) / projectedRevenue[i - 1]) * 100), borderColor: "#10B981", backgroundColor: "#A7F3D0", fill: false, tension: 0.4, pointRadius: 5, }, { label: "Expense Growth (%)", data: projectedExpenses.map((exp, i) => i === 0? 0 : ((exp - projectedExpenses[i - 1]) / projectedExpenses[i - 1]) * 100), borderColor: "#EF4444", backgroundColor: "#FCA5A5", fill: false, tension: 0.4, pointRadius: 5, }, ] }} />
      <p className="mt-3 text-sm text-gray-700 font-bold">📈 Latest sales growth is {(((projectedRevenue[horizon-1] - projectedRevenue[horizon-2]) / projectedRevenue[horizon-2]) * 100).toFixed(1)}%, while expense growth is {(((projectedExpenses[horizon-1] - projectedExpenses[horizon-2]) / projectedExpenses[horizon-2]) * 100).toFixed(1)}%.</p>
    </div>
  )}

  {/* Risk Tab */}
  {activeTab === "risk" && (
    <div>
      <Line data={{ labels: monthsAhead, datasets: [ { label: "Best Case Profit", data: projectedProfit.map((p, i) => p + (projectedProfit[i] * 0.2)), borderColor: "#3B82F6", backgroundColor: "#93C5FD", fill: true, tension: 0.4, pointRadius: 5, }, { label: "Most Likely Profit", data: projectedProfit, borderColor: "#14B8A6", backgroundColor: "#67E8F9", fill: true, tension: 0.4, pointRadius: 5, }, { label: "Worst Case Profit", data: projectedProfit.map((p, i) => p - (projectedProfit[i] * 0.2)), borderColor: "#EF4444", backgroundColor: "#FCA5A5", fill: true, tension: 0.4, pointRadius: 5, }, ] }} />
      <p className="mt-3 text-sm text-gray-700 font-bold">⚠ By {monthsAhead[horizon-1]}, profit could range between {formatAmount(projectedProfit[horizon-1] * 0.8, currency)} (worst case) and {formatAmount(projectedProfit[horizon-1] * 1.2, currency)} (best case), with most likely profit at {formatAmount(projectedProfit[horizon-1], currency)}.</p>
    </div>
  )}

  {/* Efficiency Tab */}
  {activeTab === "efficiency" && (
    <div>
      <Bar data={{ labels: monthsAhead, datasets: [ { label: "Inventory Turnover (x/month)", data: projectedRevenue.map((rev, i) => projectedExpenses[i] > 0? rev / projectedExpenses[i] : 0), backgroundColor: "#A7F3D0", stack: "efficiency", }, { label: "Expense Ratio (% of Revenue)", data: projectedExpenses.map((exp, i) => projectedRevenue[i] > 0? (exp / projectedRevenue[i]) * 100 : 0), backgroundColor: "#93C5FD", stack: "efficiency", }, ] }} options={{ scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }}} />
      <p className="mt-3 text-sm text-gray-700 font-bold">⚙ In {monthsAhead[horizon-1]}, inventory turnover is {(projectedRevenue[horizon-1] / projectedExpenses[horizon-1]).toFixed(2)}x and expenses represent {(projectedExpenses[horizon-1] / projectedRevenue[horizon-1] * 100).toFixed(1)}% of revenue.</p>
    </div>
  )}

  {/* Breakdown Tab */}
  {activeTab === "breakdown" && (
    <div>
      <Bar data={{ labels: ["Revenue", "Expenses", "Profit"], datasets: [ { label: "Financial Flow", data: [adjustedRevenue, -adjustedExpenses, adjustedProfit], backgroundColor: ["#10B981", "#EF4444", "#3B82F6"], }, ] }} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } }, }} />
      <p className="mt-3 text-sm text-gray-700 font-bold">🔎 Adjusted revenue is {formatAmount(adjustedRevenue, currency)}, expenses are {formatAmount(adjustedExpenses, currency)}, leaving a net profit of {formatAmount(adjustedProfit, currency)}.</p>
    </div>
  )}

  {/* ✅ FINAL FIX: Heatmap Tab - TRIM SPACES + TITLE CASE + FORCED COLORS */}
  {activeTab === "heatmap" && (
    <div>
      <Bar
        data={{
          labels: sortedMonths.map(m => new Date(m + '-01').toLocaleString('default', { month: 'short', year: '2-digit' })),
          datasets: (() => {
            const expenseByMonthCat = {};
            const COLOR_MAP = {
              "Rent": "#EF4444",
              "Marketing": "#F59E0B", 
              "Operations": "#3B82F6",
              "Other": "#10B981",
              "Uncategorized": "#8B5CF6"
            };

            sortedMonths.forEach(m => {
              expenseByMonthCat[m] = {};
              transactions.filter(t => new Date(t.date).toISOString().slice(0,7) === m && t.type?.toLowerCase() === "expense")
        .forEach(t => {
                // ✅ NUCLEAR FIX: Trim spaces + Title Case
                const rawCat = (t.category || "Uncategorized").trim();
                const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
                expenseByMonthCat[m][cat] = (expenseByMonthCat[m][cat] || 0) + Number(t.amount || 0);
              })
            });

            const allCats = [...new Set(Object.values(expenseByMonthCat).flatMap(obj => Object.keys(obj)))].slice(0,6);
            
            return allCats.map((cat) => ({
              label: cat,
              data: sortedMonths.map(m => expenseByMonthCat[m][cat] || 0),
              backgroundColor: COLOR_MAP[cat] || "#6B7280",
            }))
          })()
        }}
        options={{ responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: (v) => formatAmount(v, currency) } }}}}
      />

      {/* AI INSIGHT CARD */}
      {(() => {
        const expenseByMonthCat = {};
        sortedMonths.forEach(m => {
          expenseByMonthCat[m] = {};
          transactions.filter(t => new Date(t.date).toISOString().slice(0,7) === m && t.type?.toLowerCase() === "expense")
    .forEach(t => {
            // ✅ NUCLEAR FIX: Trim spaces + Title Case
            const rawCat = (t.category || "Uncategorized").trim();
            const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
            expenseByMonthCat[m][cat] = (expenseByMonthCat[m][cat] || 0) + Number(t.amount || 0);
          })
        });
        const lastM = lastRecordedMonth;
        const prevM = sortedMonths[sortedMonths.length - 2];
        const lastTotal = Object.values(expenseByMonthCat[lastM] || {}).reduce((a,b) => a+b, 0);
        const prevTotal = Object.values(expenseByMonthCat[prevM] || {}).reduce((a,b) => a+b, 0);
        const percentChange = prevTotal > 0? ((lastTotal - prevTotal) / prevTotal) * 100 : 0;
        const topLastCat = Object.entries(expenseByMonthCat[lastM] || {}).sort((a,b) => b[1]-a[1])[0];
        
        if(lastTotal === 0) return null;
        
        return (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
            <p className="font-extrabold text-yellow-900">💡 AI Insight</p>
            {percentChange > 20? (
              <p className="text-sm text-gray-800 mt-1">
                Spending up {percentChange.toFixed(0)}% in {new Date(lastM + '-01').toLocaleString('default', { month: 'long' })}. 
                Biggest cost: <span className="font-bold">{topLastCat?.[0]}</span> at {formatAmount(topLastCat?.[1], currency)}.
              </p>
            ) : (
              <p className="text-sm text-gray-800 mt-1">
                Biggest cost in {new Date(lastM + '-01').toLocaleString('default', { month: 'long' })}: <span className="font-bold">{topLastCat?.[0]}</span> at {formatAmount(topLastCat?.[1], currency)}
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )}
</div>

      {/* UPGRADE 5: FOOTER + WHATSAPP - FIXED */}
      <div className="mt-8 pt-6 border-t border-gray-300 text-center text-xs text-gray-500 space-y-3">
        <p>🔒 Bank-level security. Coming in v2</p>
        <p>FinSight AI | Support: support@finsight.ai</p>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Hi FinSight Support, I need help with my forecast. Current Net Profit: ${formatAmount(netProfit, currency)}, Margin: ${profitMargin.toFixed(2)}%`)}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-bold">💬 Send Forecast to WhatsApp</a>
      </div>

      {/* UPGRADE 6: Toast Notification */}
      {toast && (<div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg font-bold">{toast}</div>)}
    </div>
  );
}

export default Forecast;