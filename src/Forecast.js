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
import API_BASE_URL from "./apiConfig";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend
);

// PREMIUM COLOR PALETTE
const chartColors = {
  revenue: { border: "#10B981", bg: "rgba(16, 185, 129, 0.2)" },
  expense: { border: "#F43F5E", bg: "rgba(244, 63, 94, 0.2)" },
  profit: { border: "#3B82F6", bg: "rgba(59, 130, 246, 0.2)" },
  cash: { border: "#14B8A6", bg: "rgba(20, 184, 166, 0.2)" },
  warning: { border: "#F59E0B", bg: "rgba(245, 158, 11, 0.2)" },
}

const chartOptions = {
  responsive: true,
  animation: { duration: 1200, easing: 'easeOutQuart' },
  plugins: { 
    legend: { 
      labels: { 
        font: { size: 14, weight: 'bold' }, 
        color: '#374151' 
      } 
    } 
  },
  scales: { 
    x: { ticks: { color: '#6B7280' } }, 
    y: { ticks: { color: '#6B7280' } }
  } // <- ADDED THIS } TO CLOSE scales
};

const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥",
  NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA"
};

function formatAmount(amount, currency) {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Forecast() {
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [activeScenario, setScenario] = useState("Realistic");
  const [showModal, setShowModal] = useState(false);
  const [horizon, setHorizon] = useState(12);
  const [currency, setCurrency] = useState("USD");
  const [toast, setToast] = useState(null);
  const [costCutSlider, setCostCutSlider] = useState(10);
  const reportRef = useRef();

  useEffect(() => {
    const savedHorizon = localStorage.getItem("horizon");
    if (savedHorizon) setHorizon(Number(savedHorizon));
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }

    fetch(`${API_BASE_URL}/entries`, { headers: { Authorization: "Bearer " + token }})
   .then(res => res.json())
   .then(data => { if (Array.isArray(data)) setTransactions(data); })
   .catch(err => console.error("Error fetching entries:", err));

    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token }})
   .then(res => res.json())
   .then(data => { setCurrency(data.currency || "USD"); if (data.horizon) setHorizon(data.horizon); })
   .catch(err => console.error("Error fetching settings:", err));

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) setActiveTab(tabParam);
  }, []);

  const totalRevenue = transactions.filter(t => t.type?.toLowerCase() === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type?.toLowerCase() === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;
  const currentCash = totalRevenue - totalExpenses;

  const monthlyData = {};
  transactions.forEach(t => {
    if(!t.date) return;
    const d = new Date(t.date);
    if(isNaN(d)) return;
    const key = d.toISOString().slice(0, 7);
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type?.toLowerCase() === "income") monthlyData[key].income += Number(t.amount || 0);
    else if (t.type?.toLowerCase() === "expense") monthlyData[key].expense += Number(t.amount || 0);
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const lastRecordedMonth = sortedMonths[sortedMonths.length - 1];
  const lastRecordedExpenses = lastRecordedMonth? monthlyData[lastRecordedMonth].expense : 0;
  const lastRecordedMonthName = lastRecordedMonth? new Date(lastRecordedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : '';

  let expenseChangeText = "";
  if(sortedMonths.length === 0 || totalExpenses === 0){ expenseChangeText = "No expenses recorded yet"; }
  else if(sortedMonths.length === 1){ expenseChangeText = `First expense recorded: ${formatAmount(lastRecordedExpenses, currency)} in ${lastRecordedMonthName}`; }
  else {
    const currentMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const currentExp = monthlyData[currentMonth].expense;
    const prevExp = monthlyData[prevMonth].expense;
    if(prevExp > 0){
      const percentChange = ((currentExp - prevExp) / prevExp) * 100;
      const direction = percentChange > 0? "increased" : "decreased";
      expenseChangeText = `Expenses ${direction} by ${Math.abs(percentChange).toFixed(1)}% compared to ${new Date(prevMonth + '-01').toLocaleString('default', { month: 'long' })}`;
    } else { expenseChangeText = `Last recorded expenses: ${formatAmount(lastRecordedExpenses, currency)} in ${lastRecordedMonthName}`; }
  }

  const expenseByCategory = {};
  transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => {
    expenseByCategory[t.category || "Other"] = (expenseByCategory[t.category || "Other"] || 0) + Number(t.amount || 0);
  });
  const topExpense = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  const topExpenseText = topExpense? `Top expense: ${topExpense[0]} - ${formatAmount(topExpense[1], currency)}` : "Add expenses to see breakdown";

  // AI ANOMALY DETECTOR
  const anomalyAlert = sortedMonths.length > 1 && monthlyData[sortedMonths[sortedMonths.length - 2]].expense > 0 && ((monthlyData[lastRecordedMonth].expense - monthlyData[sortedMonths[sortedMonths.length - 2]].expense) / monthlyData[sortedMonths[sortedMonths.length - 2]].expense) > 0.3
  ? `🚨 AI Alert: Expenses spiked ${(((monthlyData[lastRecordedMonth].expense - monthlyData[sortedMonths[sortedMonths.length - 2]].expense) / monthlyData[sortedMonths[sortedMonths.length - 2]].expense)*100).toFixed(0)}% vs last month. Main driver: ${topExpense?.[0] || 'Expenses'}`
    : null;

  const scenarios = {
    Optimistic: { revenueChange: 10, expenseChange: 3 },
    Realistic: { revenueChange: 5, expenseChange: 2 },
    Pessimistic: { revenueChange: 2, expenseChange: 5 },
  };
  const scenario = scenarios[activeScenario];
  const adjustedRevenue = totalRevenue * (1 + scenario.revenueChange / 100);
  const adjustedExpenses = totalExpenses * (1 + scenario.expenseChange / 100);
  const adjustedProfit = adjustedRevenue - adjustedExpenses;
  const adjustedMargin = adjustedRevenue > 0? (adjustedProfit / adjustedRevenue) * 100 : 0;

  const monthsAhead = Array.from({ length: horizon }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() + i + 1);
    return d.toLocaleString("default", { month: "short", year: "numeric" });
  });

  const monthsWithData = Object.keys(monthlyData).length || 1;
  const avgMonthlyRevenue = totalRevenue / monthsWithData;
  const avgMonthlyExpense = totalExpenses / monthsWithData;

  const projectedRevenue = monthsAhead.map((_, i) => avgMonthlyRevenue * Math.pow(1 + scenario.revenueChange / 100, i + 1));
  const projectedExpenses = monthsAhead.map((_, i) => avgMonthlyExpense * Math.pow(1 + scenario.expenseChange / 100, i + 1));
  const projectedProfit = projectedRevenue.map((rev, i) => rev - projectedExpenses[i]);
  const projectedMargin = projectedRevenue.map((rev, i) => rev > 0? ((rev - projectedExpenses[i]) / rev) * 100 : 0);

  const startingReserves = currentCash;
  const cumulativeCashflow = projectedProfit.reduce((acc, profit, i) => {
    const prev = i === 0? startingReserves : acc[i - 1];
    acc.push(prev + profit);
    return acc;
  }, []);

  const cutAmount = (topExpense?.[1] || 0) * (costCutSlider / 100);
  const newRunway = avgMonthlyExpense - cutAmount > 0? (currentCash + (cutAmount * horizon)) / (avgMonthlyExpense - cutAmount) : 999;

  const avgMonthlyBurn = avgMonthlyExpense;
  let runwayText = '';
  if (avgMonthlyBurn === 0 && currentCash > 0) runwayText = 'Runway: ∞';
  else if (currentCash <= 0) runwayText = 'Runway: 0 M';
  else { const months = currentCash / avgMonthlyBurn; runwayText = `Runway: ${months.toFixed(1)} M`; }

  const runOutMonthIndex = cumulativeCashflow.findIndex((c) => c <= 0);
  const willRunOut = runOutMonthIndex!== -1;
  const runOutMonth = willRunOut? monthsAhead[runOutMonthIndex] : `Not in next ${horizon} months`;

  const exportCSV = () => {
    const rows = [["Month","Revenue","Expenses","Profit","Margin"]];
    monthsAhead.forEach((m, i) => { rows.push([m, projectedRevenue[i], projectedExpenses[i], projectedProfit[i], projectedMargin[i]]); });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "forecast.csv"; link.click();
    setToast("📂 Forecast exported to CSV!"); setTimeout(() => setToast(null), 3000);
  };

  const exportPDF = async () => {
    const element = reportRef.current; if(!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`FinSightAI-Forecast-${new Date().toISOString().slice(0,10)}.pdf`);
    setToast("📄 Forecast exported to PDF!"); setTimeout(() => setToast(null), 3000);
  };

  return (
    <div ref={reportRef} className="bg-gradient-to-br from-gray-50 to-teal-50 min-h-screen p-6 text-base md:text-lg font-bold">
      <h1 className="text-2xl font-extrabold mb-6 text-gray-800">AI-Powered Forecast</h1>

      {anomalyAlert && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-md">{anomalyAlert}</div>}

      {(() => {
  const projectedCash = cumulativeCashflow?.[horizon-1] ?? currentCash;
  const projectedProfitVal = projectedProfit?.[horizon-1] ?? 0;
  const monthlyBurn = (totalExpenses || 0) / (horizon || 6);
  const monthlyNet = projectedProfitVal / horizon;

  let runway = "∞";
  if (monthlyNet < 0 && monthlyBurn > 0) runway = (projectedCash / monthlyBurn).toFixed(1);

  let riskLevel = "Low";
  let bgColor = "#10b981";
  if (projectedProfitVal < 0) { riskLevel = "Critical"; bgColor = "#ef4444"; }
  else {
    const monthsCovered = monthlyBurn > 0 ? projectedCash / monthlyBurn : 999;
    if (monthsCovered < 1) { riskLevel = "High"; bgColor = "#f97316"; }
    else if (monthsCovered < 3) { riskLevel = "Medium"; bgColor = "#eab308"; }
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8 font-bold">
      <h2 className="text-xl font-extrabold mb-4 text-teal-600">Forecast Summary ({activeScenario})</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-400 text-white p-4 rounded-xl shadow-lg">
          <p className="text-sm opacity-90">Projected Cash in {horizon}M</p>
          <p className="text-2xl font-extrabold">{formatAmount(projectedCash, currency)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-400 text-white p-4 rounded-xl shadow-lg">
          <p className="text-sm opacity-90">Projected Runway</p>
          <p className="text-2xl font-extrabold">{runway} M</p>
        </div>
        <div style={{background: `linear-gradient(to bottom right, ${bgColor}, ${bgColor}dd)`}} className="text-white p-4 rounded-xl shadow-lg">
          <p className="text-sm opacity-90">Risk Level</p>
          <p className="text-2xl font-extrabold">{riskLevel}</p>
        </div>
      </div>
      <p className="text-lg mb-2">{netProfit < 0 ? "⚠ Cash reserves may dip below safe levels. Consider reducing expenses or boosting revenue." : "✅ Cashflow looks stable. Current reserves are sufficient to sustain operations."}</p>
      <p className="mt-2">Current Margin: <span className="font-extrabold">{profitMargin.toFixed(2)}%</span></p>
      <p>Projected Profit in {horizon} months: <span className="font-extrabold">{formatAmount(projectedProfit[horizon-1] || 0, currency)}</span></p>
      <p>Projected Margin in {horizon} months: <span className="font-extrabold">{(projectedMargin[horizon-1] || 0).toFixed(2)}%</span>{" "}{(projectedMargin[horizon-1] || 0) > profitMargin ? "⬆" : (projectedMargin[horizon-1] || 0) < profitMargin ? "⬇" : "➡"}</p>
      <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg font-extrabold mt-2 inline-block">Adjusted Margin: {adjustedMargin.toFixed(2)}%{" "}{adjustedMargin > profitMargin ? "⬆" : adjustedMargin < profitMargin ? "⬇" : "➡"}</span>
      <div className="mt-4">
        <button onClick={() => setShowModal(true)} className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold px-4 py-2 rounded-lg shadow-lg hover:scale-105 transition">{netProfit < 0 ? "Cut Costs by 10%" : "Invest in Growth"}</button>
      </div>
    </div>
  )
})()}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white/70 backdrop-blur-xl border-white/20 p-4 rounded-2xl shadow-xl"><span className="text-2xl">💰</span><h2 className="text-sm font-bold text-gray-600">Revenue</h2><p className="text-3xl font-extrabold text-emerald-600">{formatAmount(totalRevenue, currency)}</p></div>
        <div className="bg-white/70 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-xl"><span className="text-2xl">📉</span><h2 className="text-sm font-bold text-gray-600">Expenses</h2><p className="text-3xl font-extrabold text-rose-600">{formatAmount(totalExpenses, currency)}</p></div>
        <div className="bg-white/70 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-xl"><span className="text-2xl">📈</span><h2 className="text-sm font-bold text-gray-600">Net Profit</h2><p className="text-3xl font-extrabold text-blue-600">{formatAmount(netProfit, currency)}</p><p className="text-xs text-gray-600 mt-1">{runwayText}</p></div>
        <div className="bg-white/70 backdrop-blur-xl border-white/20 p-4 rounded-2xl shadow-xl"><span className="text-2xl">📊</span><h2 className="text-sm font-bold text-gray-600">Margin</h2><p className="text-3xl font-extrabold text-purple-600">{profitMargin.toFixed(2)}%</p><p className="text-xs text-gray-600 mt-1">{topExpenseText}</p></div>
      </div>

      {(() => {
  const scenarioColors = { Optimistic: "bg-green-100 border-l-4 border-green-500", Realistic: "bg-teal-50 border-l-4 border-teal-500", Pessimistic: projectedProfit[horizon-1] < 0? "bg-red-100 border-l-4 border-red-500" : "bg-yellow-50 border-l-4 border-yellow-500" };
  const scenarioEmojis = { Optimistic: "🚀", Realistic: "📊", Pessimistic: "⚠️" };
  
  const projectedCash = cumulativeCashflow?.[horizon-1]?? currentCash;
  const projectedProfitVal = projectedProfit?.[horizon-1]?? 0;
  const monthlyBurn = (totalExpenses || 0) / (horizon || 6);
  const monthlyNet = projectedProfitVal / horizon;

  let runway = "∞";
  if (monthlyNet < 0 && monthlyBurn > 0) runway = (projectedCash / monthlyBurn).toFixed(1);

  let riskLevel = "Low";
  let bgColor = "#10b981";
  if (projectedProfitVal < 0) { riskLevel = "Critical"; bgColor = "#ef4444"; }
  else {
    const monthsCovered = monthlyBurn > 0? projectedCash / monthlyBurn : 999;
    if (monthsCovered < 1) { riskLevel = "High"; bgColor = "#f97316"; }
    else if (monthsCovered < 3) { riskLevel = "Medium"; bgColor = "#eab308"; }
  }

  const aiInsight = activeScenario === "Pessimistic" && projectedProfit[horizon-1] < 0? `🧠 AI Insight: Revenue dropping but ${topExpense?.[0] || "fixed costs"} remain high. This creates negative cash in ${runOutMonth}.` : activeScenario === "Optimistic"? `🧠 AI Insight: Revenue growth of 15% with flat expenses will push margin to ${(profitMargin + 15).toFixed(2)}%` : `🧠 AI Insight: Margin recovering from ${profitMargin.toFixed(2)}% to 15.09%. Main driver: revenue normalization.`;
  const topRisk = topExpense?.[0]? `${topExpense[0]} is ${((topExpense[1]/totalExpenses)*100).toFixed(0)}% of all expenses` : "No expense data";
  const topOpportunity = `If Revenue +15%, Profit becomes ${formatAmount(projectedProfit[horizon-1], currency)}`;
  const quickWin = topExpense?.[0]? `Cut ${topExpense[0]} by 10% = Save ${formatAmount(topExpense[1]*0.1, currency)}` : "Review all expenses";
  
  return (
    <div className={`bg-white/70 backdrop-blur-xl border-white/20 p-6 rounded-2xl shadow-xl mb-6 ${scenarioColors[activeScenario]}`}>
      <h2 className="text-lg font-bold mb-4 text-gray-800">{scenarioEmojis[activeScenario]} Cashflow Insights - {activeScenario} Scenario</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white/60 p-3 rounded-lg border-l-4 border-red-400">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-red-700 text-sm">⚠️ Top Risk</h3>
            <span 
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: bgColor + '20', color: bgColor }}
            >
              {riskLevel}
            </span>
          </div>
          <p className="text-xs text-gray-700">{topRisk}</p>
<p className="text-xs text-gray-500 mt-1">Runway: {runway} months</p>
        </div>
        <div className="bg-white/60 p-3 rounded-lg border-l-4 border-green-400"><h3 className="font-bold text-green-700 text-sm">🚀 Top Opportunity</h3><p className="text-xs text-gray-700">{topOpportunity}</p></div>
        <div className="bg-white/60 p-3 rounded-lg border-l-4 border-blue-400"><h3 className="font-bold text-blue-700 text-sm">💡 Quick Win</h3><p className="text-xs text-gray-700">{quickWin}</p></div>
      </div>
      <p className="text-gray-700">📊 Total Expenses All-Time: {formatAmount(totalExpenses, currency)}</p>
      <p className="text-gray-700">📊 {expenseChangeText}</p>
      <p className="text-gray-700 font-semibold">{aiInsight}</p>
      <p className="text-gray-700">🔮 {activeScenario} Forecast: Cashflow looks {projectedProfit[horizon-1] > 0? "stable" : "at risk"} for the next {horizon} months. Projected cash: {formatAmount(cumulativeCashflow[horizon-1], currency)}</p>
      <p className="text-gray-700">💡 Suggested Action: {activeScenario === "Pessimistic" && projectedProfit[horizon-1] < 0? ` URGENT: Cut ${topExpense?.[0] || "expenses"} by 15%. Cash runs out in ${runOutMonth}` : activeScenario === "Pessimistic"? ` Build 3-month cash buffer. Risk is high in this scenario.` : activeScenario === "Optimistic"? ` Reinvest 20% of projected profit into growth to hit ${formatAmount(projectedRevenue[horizon-1], currency)} revenue` : netProfit < 0? ` Cut costs in ${topExpense?.[0] || "top categories"}` : " Explore growth investments to boost revenue."}</p>
      <p className="text-gray-700">📈 Net Profit: <span className="font-extrabold">{formatAmount(netProfit, currency)}</span> (Margin: {profitMargin.toFixed(2)}%)</p>
    </div>
  )
})()}

      <div className="flex space-x-4 mb-6 font-bold flex-wrap">
        {["Optimistic", "Realistic", "Pessimistic"].map((s) => (<button key={s} onClick={() => setScenario(s)} className={`px-4 py-2 rounded-lg font-bold ${activeScenario === s? "bg-teal-500 text-white shadow-lg" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>{s}</button>))}
        <button onClick={() => setActiveTab("compare")} className={`px-4 py-2 rounded-lg font-bold ${activeTab === "compare"? "bg-purple-600 text-white shadow-lg" : "bg-purple-200 text-purple-700 hover:bg-purple-300"}`}>Compare All</button>
      </div>

      <div className="bg-white/70 backdrop-blur-xl border-white/20 p-4 rounded-2xl shadow-xl mb-6">
        <h3 className="font-extrabold text-gray-800 mb-2">🔧 What-If Simulator: Cut {topExpense?.[0] || 'Expenses'}</h3>
        <input type="range" min="0" max="30" value={costCutSlider} onChange={(e) => setCostCutSlider(Number(e.target.value))} className="w-full"/>
        <p className="text-sm text-gray-700">Cut by {costCutSlider}% = Save {formatAmount(cutAmount, currency)}/month. New Runway: {newRunway.toFixed(1)} months</p>
      </div>

      <div className="mb-6 flex items-center space-x-4 font-bold flex-wrap">
        <div><label className="block text-sm font-bold text-gray-700">Forecast Horizon</label><select value={horizon} onChange={(e) => { const val = Number(e.target.value); setHorizon(val); localStorage.setItem("horizon", val); }} className="border p-2 rounded w-40 font-bold bg-white/70 backdrop-blur-sm"><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select><p className="text-xs text-gray-500 mt-1">All reports will use {currency}</p></div>
        <button onClick={exportCSV} className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-2 rounded-lg hover:scale-105 transition font-bold shadow-lg">Export CSV</button>
        <button onClick={exportPDF} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:scale-105 transition font-bold shadow-lg">Export PDF</button>
        <button disabled className="bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed font-bold">Connect Bank/POS - Coming in v2</button>
      </div>

      {showModal && (<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4"><div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-md font-bold"><h3 className="text-lg font-bold mb-4 text-gray-800">{netProfit < 0? "⚠ Action Plan: Cashflow Risk" : "✅ Action Plan: Growth"}</h3>{netProfit < 0? (<div className="text-gray-700 mb-4"><p className="mb-2">Problem: You are losing money</p><p className="text-sm text-gray-500 mb-3">Biggest leak: {topExpense?.[0] || "Expenses"}</p><p className="font-bold mb-2">Suggested Actions:</p><ol className="list-decimal list-inside space-y-2 text-sm"><li>Cut {topExpense?.[0] || "biggest expense"} by 10%</li><li>Delay non-critical purchases for 30 days</li><li>Switch to "Pessimistic" scenario to see impact</li></ol></div>) : (<div className="text-gray-700 mb-4"><p className="font-bold mb-2">Suggested Actions:</p><ol className="list-decimal list-inside space-y-2 text-sm"><li>Reinvest 20% of profit into marketing</li><li>Hire to remove bottleneck</li><li>Build 3-month cash reserve</li></ol></div>)}<div className="flex justify-between"><button onClick={() => setShowModal(false)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 font-bold">Close</button><a href="/alerts" className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold">Take Action →</a></div></div></div>)}

      <div className="bg-white/70 backdrop-blur-xl border-white/20 p-6 rounded-2xl shadow-2xl font-bold">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Forecast Visuals</h2>
        <div className="flex space-x-4 mb-6 flex-wrap font-bold">{["trend","proportion","liquidity","growth","risk","efficiency","breakdown","heatmap","compare"].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded mb-2 font-bold ${activeTab === tab? "bg-teal-600 text-white shadow-lg" : "bg-gray-200"}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>))}</div>

        {/* CHART TABS WRAPPED IN GLASS CARDS */}
{activeTab === "trend" && (
  <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">📈 Revenue vs Expenses vs Profit Trend</h2>
    <Line options={chartOptions} data={{ labels: monthsAhead, datasets: [ { label: "Revenue", data: projectedRevenue, borderColor: chartColors.revenue.border, backgroundColor: chartColors.revenue.bg, fill: true, tension: 0.4 }, { label: "Expenses", data: projectedExpenses, borderColor: chartColors.expense.border, backgroundColor: chartColors.expense.bg, fill: true, tension: 0.4 }, { label: "Profit", data: projectedProfit, borderColor: chartColors.profit.border, backgroundColor: chartColors.profit.bg, fill: true, tension: 0.4 }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">📈 By {monthsAhead[horizon-1]}, revenue is projected at {formatAmount(projectedRevenue[horizon-1], currency)}, expenses at {formatAmount(projectedExpenses[horizon-1], currency)}, and profit at {formatAmount(projectedProfit[horizon-1], currency)}.</p>
    {willRunOut && <p className="mt-2 text-base text-red-700 font-extrabold">⚠ We predict you’ll run out of cash in {runOutMonth} in {activeScenario} mode</p>}
  </div>
)}

{activeTab === "proportion" && (
  <div className="bg-white/70 backdrop-blur-xl border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">💰 Expense vs Profit Breakdown</h2>
    <Bar options={{...chartOptions, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }}} data={{ labels: monthsAhead, datasets: [ { label: "Expenses", data: projectedExpenses, backgroundColor: chartColors.expense.bg, stack: "combined" }, { label: "Profit", data: projectedProfit, backgroundColor: chartColors.revenue.bg, stack: "combined" }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">💰 In {monthsAhead[horizon-1]}, expenses are {((projectedExpenses[horizon-1] / projectedRevenue[horizon-1]) * 100).toFixed(1)}% of revenue, leaving a profit margin of {projectedMargin[horizon-1].toFixed(1)}%.</p>
  </div>
)}

{activeTab === "liquidity" && (
  <div className="bg-white/70 backdrop-blur-xl border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">📊 Cash Reserves Over Time</h2>
    <Line options={chartOptions} data={{ labels: monthsAhead, datasets: [ { label: "Cash Reserves", data: cumulativeCashflow, borderColor: chartColors.cash.border, backgroundColor: chartColors.cash.bg, fill: true, tension: 0.4, }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">📊 Cash reserves start at {formatAmount(cumulativeCashflow[0], currency)} and are projected to reach {formatAmount(cumulativeCashflow[horizon-1], currency)} by {monthsAhead[horizon-1]}.</p>
  </div>
)}

{activeTab === "growth" && (
  <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">📈 Growth Rate Analysis</h2>
    <Line options={chartOptions} data={{ labels: monthsAhead, datasets: [ { label: "Sales Growth (%)", data: projectedRevenue.map((rev, i) => i === 0? 0 : ((rev - projectedRevenue[i - 1]) / projectedRevenue[i - 1]) * 100), borderColor: chartColors.revenue.border, backgroundColor: chartColors.revenue.bg, fill: false, tension: 0.4, pointRadius: 5, }, { label: "Expense Growth (%)", data: projectedExpenses.map((exp, i) => i === 0? 0 : ((exp - projectedExpenses[i - 1]) / projectedExpenses[i - 1]) * 100), borderColor: chartColors.expense.border, backgroundColor: chartColors.expense.bg, fill: false, tension: 0.4, pointRadius: 5, }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">📈 Latest sales growth is {(((projectedRevenue[horizon-1] - projectedRevenue[horizon-2]) / projectedRevenue[horizon-2]) * 100).toFixed(1)}%, while expense growth is {(((projectedExpenses[horizon-1] - projectedExpenses[horizon-2]) / projectedExpenses[horizon-2]) * 100).toFixed(1)}%.</p>
  </div>
)}

{activeTab === "risk" && (
  <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">⚠️ Risk Scenario Analysis</h2>
    <Line options={chartOptions} data={{ labels: monthsAhead, datasets: [ { label: "Best Case Profit", data: projectedProfit.map((p, i) => p + (projectedProfit[i] * 0.2)), borderColor: chartColors.profit.border, backgroundColor: chartColors.profit.bg, fill: true, tension: 0.4, pointRadius: 5, }, { label: "Most Likely Profit", data: projectedProfit, borderColor: chartColors.cash.border, backgroundColor: chartColors.cash.bg, fill: true, tension: 0.4, pointRadius: 5, }, { label: "Worst Case Profit", data: projectedProfit.map((p, i) => p - (projectedProfit[i] * 0.2)), borderColor: chartColors.expense.border, backgroundColor: chartColors.expense.bg, fill: true, tension: 0.4, pointRadius: 5, }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">⚠ By {monthsAhead[horizon-1]}, profit could range between {formatAmount(projectedProfit[horizon-1] * 0.8, currency)} (worst case) and {formatAmount(projectedProfit[horizon-1] * 1.2, currency)} (best case), with most likely profit at {formatAmount(projectedProfit[horizon-1], currency)}.</p>
  </div>
)}

{activeTab === "efficiency" && (
  <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">⚙️ Efficiency Metrics</h2>
    <Bar options={{...chartOptions, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }}} data={{ labels: monthsAhead, datasets: [ { label: "Inventory Turnover (x/month)", data: projectedRevenue.map((rev, i) => projectedExpenses[i] > 0? rev / projectedExpenses[i] : 0), backgroundColor: chartColors.revenue.bg, stack: "efficiency", }, { label: "Expense Ratio (% of Revenue)", data: projectedExpenses.map((exp, i) => projectedRevenue[i] > 0? (exp / projectedRevenue[i]) * 100 : 0), backgroundColor: chartColors.profit.bg, stack: "efficiency", }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">⚙ In {monthsAhead[horizon-1]}, inventory turnover is {(projectedRevenue[horizon-1] / projectedExpenses[horizon-1]).toFixed(2)}x and expenses represent {(projectedExpenses[horizon-1] / projectedRevenue[horizon-1] * 100).toFixed(1)}% of revenue.</p>
  </div>
)}

{activeTab === "breakdown" && (
  <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">🔎 Financial Flow Breakdown</h2>
    <Bar options={{...chartOptions, plugins: {...chartOptions.plugins, legend: { display: false } }, scales: { y: { beginAtZero: true } }}} data={{ labels: ["Revenue", "Expenses", "Profit"], datasets: [ { label: "Financial Flow", data: [adjustedRevenue, -adjustedExpenses, adjustedProfit], backgroundColor: [chartColors.revenue.border, chartColors.expense.border, chartColors.profit.border], }, ] }} />
    <p className="mt-3 text-sm text-gray-700 font-bold">🔎 Adjusted revenue is {formatAmount(adjustedRevenue, currency)}, expenses are {formatAmount(adjustedExpenses, currency)}, leaving a net profit of {formatAmount(adjustedProfit, currency)}.</p>
  </div>
)}

        {activeTab === "heatmap" && (
  <div className="bg-white/70 backdrop-blur-xl border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">🗺️ Cashflow Heatmap</h2>
    
    <Bar 
      options={{
       ...chartOptions, 
        scales: { 
          x: { stacked: true }, 
          y: { 
            stacked: true, 
            beginAtZero: true, 
            ticks: { callback: (v) => formatAmount(Number(v), currency) } 
          } 
        }
      }} 
      data={{ 
        labels: sortedMonths.map(m => new Date(m + '-01').toLocaleString('default', { month: 'short', year: '2-digit' })), 
        datasets: (() => {
          const expenseByMonthCat = {}; 
          const COLOR_MAP = {
            "Rent": "#F43F5E",
            "Marketing": "#F59E0B", 
            "Operations": "#3B82F6",
            "Other": "#10B981",
            "Uncategorized": "#8B5CF6"
          };
          
          sortedMonths.forEach(m => { 
            expenseByMonthCat[m] = {}; 
            transactions
             .filter(t => new Date(t.date).toISOString().slice(0,7) === m && t.type?.toLowerCase() === "expense")
             .forEach(t => { 
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
    />
    
    {(() => {
      const expenseByMonthCat = {}; 
      sortedMonths.forEach(m => { 
        expenseByMonthCat[m] = {}; 
        transactions
         .filter(t => new Date(t.date).toISOString().slice(0,7) === m && t.type?.toLowerCase() === "expense")
         .forEach(t => { 
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
        <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
          <p className="font-extrabold text-amber-900">💡 AI Insight</p>
          {percentChange > 20? (
            <p className="text-sm text-gray-800 mt-1">
              Spending up {percentChange.toFixed(0)}% in {new Date(lastM + '-01').toLocaleString('default', { month: 'long' })}. 
              Biggest cost: <span className="font-bold">{topLastCat?.[0]}</span> at {formatAmount(topLastCat?.[1] || 0, currency)}.
            </p>
          ) : (
            <p className="text-sm text-gray-800 mt-1">
              Biggest cost in {new Date(lastM + '-01').toLocaleString('default', { month: 'long' })}: 
              <span className="font-bold">{topLastCat?.[0]}</span> at {formatAmount(topLastCat?.[1] || 0, currency)}
            </p>
          )}
        </div>
      )
    })()}
  </div>
)}

{activeTab === "compare" && (
  <div className="bg-white/70 backdrop-blur-xl border border-white/20 text-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
    <h2 className="text-xl font-extrabold mb-4 text-teal-600">⚖️ Scenario Comparison</h2>
    
    <Line 
      options={chartOptions} 
      data={{
        labels: monthsAhead,
        datasets: [
          { 
            label: "Optimistic Cash", 
            data: monthsAhead.map((_, i) => {
              const optRev = avgMonthlyRevenue * Math.pow(1.10, i + 1);
              const optExp = avgMonthlyExpense * Math.pow(1.03, i + 1);
              const optProfit = optRev - optExp;
              return startingReserves + (optProfit * (i+1))
            }), 
            borderColor: "#10B981", 
            backgroundColor: "rgba(16, 185, 129, 0.1)", 
            fill: false, 
            tension: 0.4, 
            borderWidth: 3 
          },
          { 
            label: "Realistic Cash", 
            data: cumulativeCashflow, 
            borderColor: "#14B8A6", 
            backgroundColor: "rgba(20, 184, 166, 0.1)", 
            fill: false, 
            tension: 0.4, 
            borderWidth: 3 
          },
          { 
            label: "Pessimistic Cash", 
            data: monthsAhead.map((_, i) => {
              const pesRev = avgMonthlyRevenue * Math.pow(1.02, i + 1);
              const pesExp = avgMonthlyExpense * Math.pow(1.05, i + 1);
              const pesProfit = pesRev - pesExp;
              return startingReserves + (pesProfit * (i+1))
            }), 
            borderColor: "#F43F5E", 
            backgroundColor: "rgba(244, 63, 94, 0.1)", 
            fill: false, 
            tension: 0.4, 
            borderWidth: 3 
          },
        ]
      }} 
    />
    
    <p className="mt-3 text-sm text-gray-700 font-bold">
      📊 Compare all 3 scenarios on 1 chart. Green = Best case, Teal = Most likely, Red = Worst case. This is what investors want to see.
    </p>
  </div>
)}

{/* Footer */}
<div className="mt-8 pt-6 border-t border-gray-300 text-center text-xs text-gray-500 space-y-3">
  <p>🔒 Bank-level security. Coming in v2</p>
  <p>FinSight AI | Support: support@finsight.ai</p>
  <a 
    href={`https://wa.me/?text=${encodeURIComponent(`Hi FinSight Support, I need help with my forecast. Current Net Profit: ${formatAmount(netProfit, currency)}, Margin: ${profitMargin.toFixed(2)}%`)}`} 
    target="_blank" 
    rel="noopener noreferrer" 
    className="inline-block bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 font-bold shadow-lg"
  >
    💬 Send Forecast to WhatsApp
  </a>
</div>

{toast && (
  <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg font-bold">
    {toast}
  </div>
)}

      </div>
    </div>
  );
}

export default Forecast;