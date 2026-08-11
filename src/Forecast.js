import { useEffect, useState } from "react";
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

function Forecast() {
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [activeScenario, setScenario] = useState("Realistic");
  const [showModal, setShowModal] = useState(false);
  const [horizon, setHorizon] = useState(12);
  const [currency, setCurrency] = useState("USD");

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

  // ✅ Read ?tab= query parameter from URL
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  if (tabParam) {
    setActiveTab(tabParam);
  }
}, []); // ✅ empty dependency array, no ESLint warning

  // Totals
  const totalRevenue = transactions
    .filter(t => t.type && t.type.toLowerCase() === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type && t.type.toLowerCase() === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // ✅ Dynamic expense change vs last month
  const expenseChange = (() => {
    const expenses = transactions.filter(t => t.type && t.type.toLowerCase() === "expense");
    if (expenses.length < 2) return 0;
    const sorted = expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
    const prev = Number(sorted[sorted.length - 2].amount);
    const curr = Number(sorted[sorted.length - 1].amount);
    return prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  })();

  // Scenario datasets (still placeholders, but can be replaced with backend data later)
  const scenarios = {
    Optimistic: { revenueChange: 10, expenseChange: -5 },
    Realistic: { revenueChange: 5, expenseChange: 0 },
    Pessimistic: { revenueChange: 2, expenseChange: 5 },
  };

  const scenario = scenarios[activeScenario];

  // Adjusted values
  const adjustedRevenue = totalRevenue * (1 + scenario.revenueChange / 100);
  const adjustedExpenses = totalExpenses * (1 + scenario.expenseChange / 100);
  const adjustedProfit = adjustedRevenue - adjustedExpenses;
  const adjustedMargin = adjustedRevenue > 0 ? (adjustedProfit / adjustedRevenue) * 100 : 0;

  // Multi‑month projections (dynamic horizon)
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
    rev > 0 ? ((rev - projectedExpenses[i]) / rev) * 100 : 0
  );

  // Cumulative cashflow
  const startingReserves = 5000;
  const cumulativeCashflow = projectedProfit.reduce((acc, profit, i) => {
    const prev = i === 0 ? startingReserves : acc[i - 1];
    acc.push(prev + profit);
    return acc;
  }, []);

  // Export CSV
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
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6 text-base md:text-lg font-bold">
      <h1 className="text-2xl font-extrabold mb-6 text-gray-800">AI-Powered Forecast</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* Revenue */}
        <div className="bg-green-100 p-4 rounded-lg shadow-md flex flex-col items-center">
          <span className="text-2xl">💰</span>
          <h2 className="text-sm font-bold text-gray-600">Revenue</h2>
          <p className="text-3xl font-extrabold text-green-700">{formatAmount(totalRevenue, currency)}</p>
        </div>
        {/* Expenses */}
        <div className="bg-red-100 p-4 rounded-lg shadow-md flex flex-col items-center">
          <span className="text-2xl">📉</span>
          <h2 className="text-sm font-bold text-gray-600">Expenses</h2>
          <p className="text-3xl font-extrabold text-red-700">{formatAmount(totalExpenses, currency)}</p>
        </div>
        {/* Net Profit */}
        <div className="bg-blue-100 p-4 rounded-lg shadow-md flex flex-col items-center">
          <span className="text-2xl">📈</span>
          <h2 className="text-sm font-bold text-gray-600">Net Profit</h2>
          <p className="text-3xl font-extrabold text-blue-700">{formatAmount(netProfit, currency)}</p>
        </div>
        {/* Margin */}
        <div className="bg-purple-100 p-4 rounded-lg shadow-md flex flex-col items-center">
          <span className="text-2xl">📊</span>
          <h2 className="text-sm font-bold text-gray-600">Margin</h2>
          <p className="text-3xl font-extrabold text-purple-700">{profitMargin.toFixed(2)}%</p>
        </div>
      </div>

            {/* Cashflow Insights */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${netProfit < 2000 ? "bg-red-100" : "bg-teal-50"}`}>
        <h2 className="text-lg font-bold mb-2 text-gray-800">📊 Cashflow Insights</h2>
        <p className="text-gray-700">
          📊 Expenses changed by {expenseChange.toFixed(1)}% compared to last month.
        </p>
        <p className="text-gray-700">
          🔮 Forecast: Cashflow looks {projectedProfit.every(p => p > 0) ? "stable" : "unstable"} for the next {horizon} months.
        </p>
        <p className="text-gray-700">
          💡 Suggested Action: {netProfit < 0 ? "Consider renegotiating supplier contracts or cutting non‑essential costs." : "Explore growth investments to boost revenue."}
        </p>
        <p className="text-gray-700">
          📈 Net Profit:{" "}
          <span className="font-extrabold">{formatAmount(netProfit, currency)}</span> (Margin:{" "}
          {profitMargin.toFixed(2)}%)
        </p>
      </div>

      {/* Scenario Compare Toggle */}
      <div className="flex space-x-4 mb-6 font-bold">
        {["Optimistic", "Realistic", "Pessimistic"].map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`px-4 py-2 rounded-lg font-bold ${
              activeScenario === s ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Forecast Horizon Dropdown */}
<div className="mb-6 flex items-center space-x-4 font-bold">
  <div>
    <label className="block text-sm font-bold text-gray-700">Forecast Horizon</label>
    <select
      value={horizon}
      onChange={(e) => {
        const val = Number(e.target.value);
        setHorizon(val);
        localStorage.setItem("horizon", val); // ✅ save selection
      }}
      className="border p-2 rounded w-40 font-bold"
    >
      <option value={6}>6 months</option>
      <option value={12}>12 months</option>
      <option value={24}>24 months</option>
    </select>
  </div>
  <button
    onClick={exportCSV}
    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold"
  >
    Export CSV
  </button>
</div>

      {/* Forecast Summary Card */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-300 text-white p-6 rounded-lg shadow-md mb-8 font-bold">
        <h2 className="text-xl font-bold mb-2">Forecast Summary ({activeScenario})</h2>
        <p className="text-lg">
          {netProfit < 2000
            ? "⚠️ Cash reserves may dip below safe levels. Consider reducing expenses or boosting revenue."
            : "✅ Cashflow looks stable. Current reserves are sufficient to sustain operations."}
        </p>
        <p className="mt-2">
          Current Margin: <span className="font-extrabold">{profitMargin.toFixed(2)}%</span>
        </p>
        <p>
          Projected Profit in {horizon} months:{" "}
          <span className="font-extrabold">{formatAmount(projectedProfit[horizon-1], currency)}</span>
        </p>
        <p>
          Projected Margin in {horizon} months:{" "}
          <span className="font-extrabold">{projectedMargin[horizon-1].toFixed(2)}%</span>{" "}
          {projectedMargin[horizon-1] > profitMargin ? "⬆️" : projectedMargin[horizon-1] < profitMargin ? "⬇️" : "➡️"}
        </p>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-extrabold mt-2 inline-block">
          Adjusted Margin: {adjustedMargin.toFixed(2)}%{" "}
          {adjustedMargin > profitMargin ? "⬆️" : adjustedMargin < profitMargin ? "⬇️" : "➡️"}
        </span>
        <div className="mt-4">
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-teal-600 font-bold px-4 py-2 rounded-lg shadow hover:bg-gray-100"
          >
            {netProfit < 2000 ? "Cut Costs by 10%" : "Invest in Growth"}
          </button>
        </div>
      </div>

      {/* Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md font-bold">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Recommended Action</h3>
            <p className="text-gray-700 mb-4">
              {netProfit < 2000
                ? "Reducing costs by 10% saves ~" + formatAmount(totalExpenses * 0.1, currency) + "/month."
                : "Investing in growth could raise revenue by ~15%, boosting profit margins and long-term stability."}
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 font-bold"
              >
                Close
              </button>
              <a
                href="/alerts"
                className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold"
              >
                Take Action →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Charts */}
<div className="bg-white p-6 rounded-lg shadow-md font-bold">
  <h2 className="text-lg font-bold text-gray-800 mb-4">Forecast Visuals</h2>
  <div className="flex space-x-4 mb-6 flex-wrap font-bold">
    {["trend","proportion","liquidity","growth","risk","efficiency","breakdown","heatmap"].map(tab => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 rounded mb-2 font-bold ${
          activeTab === tab ? "bg-teal-600 text-white" : "bg-gray-200"
        }`}
      >
        {tab.charAt(0).toUpperCase() + tab.slice(1)}
      </button>
    ))}
  </div>

  {/* Trend Chart */}
{activeTab === "trend" && (
  <div>
    <Line
      data={{
        labels: monthsAhead,
        datasets: [
          { label: "Revenue", data: projectedRevenue, borderColor: "#10B981", backgroundColor: "#A7F3D0", fill: true, tension: 0.4 },
          { label: "Expenses", data: projectedExpenses, borderColor: "#EF4444", backgroundColor: "#FCA5A5", fill: true, tension: 0.4 },
          { label: "Profit", data: projectedProfit, borderColor: "#3B82F6", backgroundColor: "#93C5FD", fill: true, tension: 0.4 },
        ],
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      📈 By {monthsAhead[horizon-1]}, revenue is projected at {formatAmount(projectedRevenue[horizon-1], currency)}, 
      expenses at {formatAmount(projectedExpenses[horizon-1], currency)}, and profit at {formatAmount(projectedProfit[horizon-1], currency)}.
    </p>
  </div>
)}

{/* Proportion Chart */}
{activeTab === "proportion" && (
  <div>
    <Bar
      data={{
        labels: monthsAhead,
        datasets: [
          { label: "Expenses", data: projectedExpenses, backgroundColor: "#FCA5A5", stack: "combined" },
          { label: "Profit", data: projectedProfit, backgroundColor: "#A7F3D0", stack: "combined" },
        ],
      }}
      options={{ scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }}}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      💰 In {monthsAhead[horizon-1]}, expenses are {((projectedExpenses[horizon-1] / projectedRevenue[horizon-1]) * 100).toFixed(1)}% of revenue, 
      leaving a profit margin of {projectedMargin[horizon-1].toFixed(1)}%.
    </p>
  </div>
)}

  {/* Liquidity Chart */}
{activeTab === "liquidity" && (
  <div>
    <Line
      data={{
        labels: monthsAhead,
        datasets: [
          {
            label: "Cash Reserves",
            data: cumulativeCashflow,
            borderColor: "#14B8A6",
            backgroundColor: "#67E8F9",
            fill: true,
            tension: 0.4,
          },
        ],
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      📊 Cash reserves start at {formatAmount(cumulativeCashflow[0], currency)} 
      and are projected to reach {formatAmount(cumulativeCashflow[horizon-1], currency)} 
      by {monthsAhead[horizon-1]}.
    </p>
  </div>
)}

{/* Growth Tab */}
{activeTab === "growth" && (
  <div>
    <Line
      data={{
        labels: monthsAhead,
        datasets: [
          {
            label: "Sales Growth (%)",
            data: projectedRevenue.map((rev, i) =>
              i === 0 ? 0 : ((rev - projectedRevenue[i - 1]) / projectedRevenue[i - 1]) * 100
            ),
            borderColor: "#10B981",
            backgroundColor: "#A7F3D0",
            fill: false,
            tension: 0.4,
            pointRadius: 5,
          },
          {
            label: "Customer Churn (%)",
            data: projectedExpenses.map((exp, i) =>
              i === 0 ? 0 : ((exp - projectedExpenses[i - 1]) / projectedExpenses[i - 1]) * 100
            ),
            borderColor: "#EF4444",
            backgroundColor: "#FCA5A5",
            fill: false,
            tension: 0.4,
            pointRadius: 5,
          },
        ],
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      📈 Latest sales growth is {(((projectedRevenue[horizon-1] - projectedRevenue[horizon-2]) / projectedRevenue[horizon-2]) * 100).toFixed(1)}%, 
      while churn is {(((projectedExpenses[horizon-1] - projectedExpenses[horizon-2]) / projectedExpenses[horizon-2]) * 100).toFixed(1)}%.
    </p>
  </div>
)}


{/* Risk Tab */}
{activeTab === "risk" && (
  <div>
    <Line
      data={{
        labels: monthsAhead,
        datasets: [
          {
            label: "Best Case Profit",
            data: projectedProfit.map((p, i) => p + (projectedProfit[i] * 0.2)),
            borderColor: "#3B82F6",
            backgroundColor: "#93C5FD",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
          },
          {
            label: "Most Likely Profit",
            data: projectedProfit,
            borderColor: "#14B8A6",
            backgroundColor: "#67E8F9",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
          },
          {
            label: "Worst Case Profit",
            data: projectedProfit.map((p, i) => p - (projectedProfit[i] * 0.2)),
            borderColor: "#EF4444",
            backgroundColor: "#FCA5A5",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
          },
        ],
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      ⚠️ By {monthsAhead[horizon-1]}, profit could range between 
      {formatAmount(projectedProfit[horizon-1] * 0.8, currency)} (worst case) 
      and {formatAmount(projectedProfit[horizon-1] * 1.2, currency)} (best case), 
      with most likely profit at {formatAmount(projectedProfit[horizon-1], currency)}.
    </p>
  </div>
)}

{/* Efficiency Tab */}
{activeTab === "efficiency" && (
  <div>
    <Bar
      data={{
        labels: monthsAhead,
        datasets: [
          {
            label: "Inventory Turnover (x/month)",
            data: projectedRevenue.map((rev, i) =>
              projectedExpenses[i] > 0 ? rev / projectedExpenses[i] : 0
            ),
            backgroundColor: "#A7F3D0",
            stack: "efficiency",
          },
          {
            label: "Expense Ratio (% of Revenue)",
            data: projectedExpenses.map((exp, i) =>
              projectedRevenue[i] > 0 ? (exp / projectedRevenue[i]) * 100 : 0
            ),
            backgroundColor: "#93C5FD",
            stack: "efficiency",
          },
        ],
      }}
      options={{
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      ⚙️ In {monthsAhead[horizon-1]}, inventory turnover is 
      {(projectedRevenue[horizon-1] / projectedExpenses[horizon-1]).toFixed(2)}x 
      and expenses represent {(projectedExpenses[horizon-1] / projectedRevenue[horizon-1] * 100).toFixed(1)}% of revenue.
    </p>
  </div>
)}

{/* Breakdown Tab */}
{activeTab === "breakdown" && (
  <div>
    <Bar
      data={{
        labels: ["Revenue", "Expenses", "Profit"],
        datasets: [
          {
            label: "Financial Flow",
            data: [adjustedRevenue, -adjustedExpenses, adjustedProfit],
            backgroundColor: ["#10B981", "#EF4444", "#3B82F6"],
          },
        ],
      }}
      options={{
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      🔎 Adjusted revenue is {formatAmount(adjustedRevenue, currency)}, 
      expenses are {formatAmount(adjustedExpenses, currency)}, 
      leaving a net profit of {formatAmount(adjustedProfit, currency)}.
    </p>
  </div>
)}

{/* Heatmap Tab */}
{activeTab === "heatmap" && (
  <div>
    <Bar
      data={{
        labels: monthsAhead,
        datasets: [
          {
            label: "Marketing",
            data: transactions.filter(t => t.category === "Marketing").map(t => Number(t.amount)),
            backgroundColor: "#F59E0B",
          },
          {
            label: "Operations",
            data: transactions.filter(t => t.category === "Operations").map(t => Number(t.amount)),
            backgroundColor: "#3B82F6",
          },
          {
            label: "Miscellaneous",
            data: transactions.filter(t => t.category === "Miscellaneous").map(t => Number(t.amount)),
            backgroundColor: "#10B981",
          },
        ],
      }}
      options={{
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      🌍 Latest month shows Marketing spend at {formatAmount(transactions.filter(t => t.category === "Marketing").map(t => Number(t.amount)).slice(-1)[0] || 0, currency)}, 
      Operations at {formatAmount(transactions.filter(t => t.category === "Operations").map(t => Number(t.amount)).slice(-1)[0] || 0, currency)}, 
      and Miscellaneous at {formatAmount(transactions.filter(t => t.category === "Miscellaneous").map(t => Number(t.amount)).slice(-1)[0] || 0, currency)}.
    </p>
  </div>
)}


        {/* Heatmap Tab */}
{activeTab === "heatmap" && (
  <div>
    <Bar
      data={{
        labels: monthsAhead,
        datasets: [
          {
            label: "Marketing",
            data: transactions.filter(t => t.category === "Marketing").map(t => Number(t.amount)),
            backgroundColor: "#F59E0B",
          },
          {
            label: "Operations",
            data: transactions.filter(t => t.category === "Operations").map(t => Number(t.amount)),
            backgroundColor: "#3B82F6",
          },
          {
            label: "Miscellaneous",
            data: transactions.filter(t => t.category === "Miscellaneous").map(t => Number(t.amount)),
            backgroundColor: "#10B981",
          },
        ],
      }}
      options={{
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      }}
    />
    <p className="mt-3 text-sm text-gray-700 font-bold">
      🌍 In {monthsAhead[horizon-1]}, Marketing spend is 
      {formatAmount(transactions.filter(t => t.category === "Marketing").map(t => Number(t.amount)).slice(-1)[0] || 0, currency)}, 
      Operations spend is 
      {formatAmount(transactions.filter(t => t.category === "Operations").map(t => Number(t.amount)).slice(-1)[0] || 0, currency)}, 
      and Miscellaneous spend is 
      {formatAmount(transactions.filter(t => t.category === "Miscellaneous").map(t => Number(t.amount)).slice(-1)[0] || 0, currency)}.
    </p>
  </div>
)}
</div>
</div>
);
}

export default Forecast;
