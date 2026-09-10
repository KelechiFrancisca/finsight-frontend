import React, { useState, useEffect, useRef } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import API_BASE_URL from "./apiConfig";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥", NGN: "₦", ZAR: "R",
  KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA"
};
function formatAmount(amount, currency = "NGN") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Alerts({ dashboardData }) {
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ high: 0, medium: 0, info: 0 });
  const [totals, setTotals] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [costCutSlider, setCostCutSlider] = useState(10);
  const [emailPreview, setEmailPreview] = useState(null);
  const reportRef = useRef();

  const currency = dashboardData?.currency || totals.currency || "NGN";
  const totalRevenue = dashboardData?.totalRevenue?? totals.total_income?? 0;
  const totalExpenses = dashboardData?.totalExpenses?? totals.total_expense?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;

  const generateEmailDraft = (alert) => {
    const ai = generateAIInsight(alert);
    const revenue = alert.income?? totalRevenue;
    const expenses = alert.expenses?? totalExpenses;
    const subject = `ACTION REQUIRED: ${ai.title} - ${ai.risk} Risk`;
    const body = `Hi Team,

Our AI detected: ${ai.title}

DETAILS:
- ${alert.message}
- Income: ${formatAmount(revenue, currency)}
- Expenses: ${formatAmount(expenses, currency)}
- Net: ${formatAmount(revenue - expenses, currency)}

AI ANALYSIS:
Root Cause: ${ai.rootCause}
Forecast: ${ai.forecast}
Recommended Actions:
${generateActions(alert).map(a => `- ${a}`).join('\n')}

Please review and take action.

- FinTrack AI Copilot`;
    return { subject, body };
  };

  const detectAnomalies = () => {
    const anomalies = [];
    const data = transactions.filter(t => t.type).slice(-60);
    const revThisMonth = data.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expThisMonth = data.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    if (expThisMonth > revThisMonth * 0.9 && revThisMonth > 0) {
      anomalies.push(`⚠️ Expenses are ${(expThisMonth/revThisMonth*100).toFixed(0)}% of income this period`);
    }
    if (totalExpenses > totalRevenue) {
      anomalies.push(`🔥 Burning cash: -${formatAmount(Math.abs(netProfit), currency)}/month`);
    }
    return anomalies;
  };

  const generateAIInsight = (alert) => {
    const expenseByCategory = {};
    transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => {
      expenseByCategory[t.category || "Other"] = (expenseByCategory[t.category || "Other"] || 0) + Number(t.amount || 0);
    });
    const topExpense = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topExpense?.[0] || "Expenses";
    const topAmount = topExpense?.[1] || 0;
    const monthlyBurn = totalExpenses / 6 || 1;
    const runway = monthlyBurn > 0? (Math.abs(netProfit) / monthlyBurn).toFixed(1) : "∞";
    if (alert.type === "expense") {
      const percent = totalRevenue > 0? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0;
      const risk = percent > 90? "Critical" : percent > 70? "High" : "Medium";
      return {
        title: `🚨 Burn Rate Alert`,
        risk,
        riskColor: risk === "Critical"? "#ef4444" : risk === "High"? "#f97316" : "#eab308",
        rootCause: `Main driver: ${topCategory} at ${formatAmount(topAmount, currency)}`,
        forecast: `At this rate, cash runs out in ${runway} months`,
        insight: `Expenses are ${percent}% of income. ${percent > 90? "URGENT" : "Warning"}`
      };
    }
    if (alert.type === "revenue") {
      const risk = profitMargin < 10? "Critical" : profitMargin < 20? "High" : "Medium";
      return {
        title: `📉 Profit Margin Drop`,
        risk,
        riskColor: risk === "Critical"? "#ef4444" : "#eab308",
        rootCause: `Margin dropped to ${profitMargin.toFixed(2)}%`,
        forecast: `Projected profit next 3M: ${formatAmount(netProfit * 3, currency)}`,
        insight: `Below 20% target. Revenue needs +15% to recover`
      };
    }
    return { title: "✅ System Check", risk: "Low", riskColor: "#10b981", rootCause: "All normal", forecast: "Stable", insight: "Monitoring active" };
  };

  const generateWhy = (alert) => {
    if (alert.why && alert.why.trim()!== "") return alert.why;
    return generateAIInsight(alert).insight;
  };

  const generateActions = (alert) => {
    const ai = generateAIInsight(alert);
    if (alert.actions && alert.actions.length > 0) return alert.actions;
    if (alert.type === "expense") return [ai.rootCause, `Cut costs by ${costCutSlider}%`, "Simulate in Forecast"];
    if (alert.type === "revenue") return [ai.rootCause, "Launch promo campaign", "Simulate in Forecast"];
    if (alert.type === "churn") return ["Send win-back emails", "Improve onboarding", "Survey customers"];
    return ["Review in Forecast tab", "Export data for review"];
  };

  const generateWhatsAppText = (alert) => {
    const ai = generateAIInsight(alert);
    if (alert.whatsapp_text) return alert.whatsapp_text;
    return `⚠️ ${ai.title}\nRisk: ${ai.risk}\n${ai.rootCause}\n${ai.forecast}`;
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/alerts`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
   .then((res) => res.json())
   .then((data) => {
      if (data && Array.isArray(data.alerts)) {
        const normalized = data.alerts.map((a) => ({
         ...a,
          level: (a.level || "").toLowerCase(),
        }));
        setAlerts(normalized);
        setCounts(data.counts);
        setTotals(data.totals || {});
      } else { setAlerts([]); }
    })
   .catch((err) => console.error("Error fetching alerts:", err));

    fetch(`${API_BASE_URL}/entries`, { headers: { Authorization: "Bearer " + localStorage.getItem("token") }})
   .then(res => res.json())
   .then(data => { if (Array.isArray(data)) setTransactions(data); })
   .catch(err => console.error(err));
  }, [dashboardData]);

  const highPriority = counts.high;
  const mediumPriority = counts.medium;
  const informational = counts.info;

  const topAlertType = () => {
    const expenseCount = alerts.filter((a) => a.type === "expense").length;
    const revenueCount = alerts.filter((a) => a.type === "revenue").length;
    const fraudCount = alerts.filter((a) => a.type === "fraud").length;
    const churnCount = alerts.filter((a) => a.type === "churn").length;
    const max = Math.max(expenseCount, revenueCount, fraudCount, churnCount);
    if (max === expenseCount) return `Expenses are driving most alerts (${expenseCount})`;
    if (max === revenueCount) return `Revenue alerts leading (${revenueCount})`;
    if (max === churnCount) return `Churn alerts leading (${churnCount})`;
    return `Fraud alerts leading (${fraudCount})`;
  };

  const exportCSV = () => {
    const rows = [["ID", "Level", "Message", "Analysis", "Actions"]];
    alerts.forEach((a) => rows.push([ a.id, a.level, a.message, generateWhy(a), (generateActions(a) || []).join("; ") ]));
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "alerts.csv"; link.click();
    setToast("📂 Alerts exported successfully!"); setTimeout(() => setToast(null), 3000);
  };

  return (
    <div ref={reportRef} className="bg-gradient-to-br from-gray-50 to-teal-50 min-h-screen p-6 text-base md:text-lg font-bold">
      <h1 className="text-2xl font-extrabold mb-6 text-gray-800">AI-Powered Alerts</h1>
      <p className="text-gray-600 mb-6 font-bold">Stay informed with intelligent alerts about your business finances.</p>

      {detectAnomalies().length > 0 && (
        <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-xl mb-4">
          <h3 className="font-extrabold text-indigo-700 mb-2">🔍 AI Anomaly Detection</h3>
          {detectAnomalies().map((a, i) => <p key={i} className="text-sm text-indigo-600">• {a}</p>)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl font-bold">
          <h2 className="text-lg font-bold text-red-600">High Priority</h2>
          <p className="text-3xl font-extrabold">{highPriority}</p>
          <p className="text-sm text-gray-500">{highPriority > 0? `⚠️ ${highPriority} urgent issue${highPriority > 1? "s" : ""} demand immediate action` : "✅ No high priority alerts right now"}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl font-bold">
          <h2 className="text-lg font-bold text-yellow-600">Medium Priority</h2>
          <p className="text-3xl font-extrabold">{mediumPriority}</p>
          <p className="text-sm text-gray-500">{mediumPriority > 0? `${mediumPriority} alert${mediumPriority > 1? "s" : ""} require monitoring` : "✅ Finances are steady"}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl font-bold">
          <h2 className="text-lg font-bold text-blue-600">Informational</h2>
          <p className="text-3xl font-extrabold">{informational}</p>
          <p className="text-sm text-gray-500">{informational > 0? `${informational} update${informational > 1? "s" : ""} for awareness` : "ℹ️ All systems normal"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-bold">
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl font-bold">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Alert Distribution</h2>
          <Pie data={{ labels: ["High", "Medium", "Info"], datasets: [{ data: [highPriority, mediumPriority, informational], backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6"] }] }}/>
          <p className="text-gray-600 mt-2 font-bold">{highPriority + mediumPriority + informational > 0? `Total ${alerts.length} alerts. ${topAlertType()}` : "Upload CSV data to see real alert analysis"}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl font-bold">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Alerts Trend</h2>
          <Line data={{
            labels: alerts.map((a, i) => {
              const d = a.created_at? new Date(a.created_at) : new Date();
              return d.toLocaleDateString() + ` #${i+1}`;
            }),
            datasets: [{ label: "Alerts Over Time", data: alerts.map((_, i) => i + 1), borderColor: "#10B981", backgroundColor: "#A7F3D0", fill: true, tension: 0.4 }]
          }}/>
          <p className="text-gray-600 mt-2 font-bold">{alerts.length > 0? `Alerts have grown to ${alerts.length} active issues` : "No alert trend data yet"}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl font-bold">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Alerts by Category</h2>
          <Bar
            data={{
              labels: ["Fraud", "Expenses", "Revenue", "Churn"],
              datasets: [{
                label: "Alerts by Category",
                data: [
                  alerts.filter((a) => a.type === "fraud").length,
                  alerts.filter((a) => a.type === "expense").length,
                  alerts.filter((a) => a.type === "revenue").length,
                  alerts.filter((a) => a.type === "churn").length,
                ],
                backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"],
              }],
            }}
            options={{ scales: { y: { beginAtZero: true } } }}
          />
          <p className="text-gray-600 mt-2 font-bold">{alerts.length > 0? `${topAlertType()}` : "No category data available"}</p>
        </div>
      </div>

      <div className="space-y-4 font-bold">
        {alerts.map((alert) => {
          const level = (alert.level || "").toLowerCase();
          let borderColor = "border-blue-600";
          let titleColor = "text-blue-600";
          if (level === "high") { borderColor = "border-red-600"; titleColor = "text-red-600"; }
          else if (level === "medium") { borderColor = "border-yellow-600"; titleColor = "text-yellow-600"; }
          const revenue = alert.income?? totalRevenue;
          const expenses = alert.expenses?? totalExpenses;
          const net = alert.net?? (revenue - expenses);
          const ai = generateAIInsight(alert);
          const cutAmount = expenses * (costCutSlider / 100);
          return (
            <div key={alert.id} className={`bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl border-l-4 ${borderColor} font-bold`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className={`text-lg font-bold ${titleColor}`}>{ai.title}</h3>
                <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{background: ai.riskColor}}>{ai.risk} RISK</span>
              </div>
              <p className="text-gray-700 font-bold">{alert.message}</p>
              <div className="bg-gray-100/70 p-4 rounded-xl mb-3 mt-2">
                <p className="text-sm mb-1">🧠 <span className="font-bold">Root Cause:</span> {ai.rootCause}</p>
                <p className="text-sm mb-1">🔮 <span className="font-bold">Forecast:</span> {ai.forecast}</p>
                <p className="text-sm">📊 <span className="font-bold">Analysis:</span> {ai.insight}</p>
              </div>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-600 text-sm">Income: <span className="font-extrabold">{formatAmount(revenue, currency)}</span></p>
                <p className="text-gray-600 text-sm">Expenses: <span className="font-extrabold">{formatAmount(expenses, currency)}</span></p>
                <p className="text-gray-600 text-sm">Net: <span className="font-extrabold">{formatAmount(net, currency)}</span></p>
              </div>
              {alert.type === "expense" && (
                <div className="mt-3 p-3 bg-teal-50 rounded-xl border-teal-200">
                  <h4 className="font-extrabold text-teal-700 mb-2">🔧 What-If Simulator</h4>
                  <input type="range" min="0" max="30" value={costCutSlider} onChange={(e) => setCostCutSlider(Number(e.target.value))} className="w-full"/>
                  <p className="text-sm mt-1">Cut by {costCutSlider}% = Save {formatAmount(cutAmount, currency)}/month</p>
                </div>
              )}
              <p className="text-gray-500 text-sm mt-1 font-bold">{generateWhy(alert)}</p>
              <ul className="text-sm text-gray-600 mt-2">{generateActions(alert).map((step, i) => (<li key={i}>👉 {step}</li>))}</ul>
              <span className={`px-2 py-1 rounded-lg font-extrabold inline-block mt-2 ${ alert.type === "revenue"? "bg-green-100 text-green-700" : alert.type === "expense"? "bg-yellow-100 text-yellow-700" : alert.type === "churn"? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700" }`}>{alert.type}</span>
              <div className="mt-3 flex space-x-4 font-bold flex-wrap gap-2">
                <button onClick={() => { setSelectedAlert(alert); setShowModal(true); }} className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold">Resolve</button>
                <a href={`/forecast?tab=${ alert.type === "expense"? "proportion" : alert.type === "churn"? "growth" : alert.type === "revenue"? "trend" : "liquidity" }`} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 font-bold">Simulate in Forecast →</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(generateWhatsAppText(alert))}`} target="_blank" rel="noreferrer" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-bold">Send to WhatsApp</a>
                <button onClick={() => setEmailPreview(generateEmailDraft(alert))} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-bold">✉️ Preview Email</button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && selectedAlert && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-md font-bold">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Alert Details</h3>
            <p className="text-gray-700 mb-4 font-bold">{selectedAlert.message}</p>
            <p className="text-gray-600 mb-4 font-bold">Explanation:</p>
            <p className="text-gray-500 mb-4">{generateWhy(selectedAlert)}</p>
            <p className="text-gray-600 mb-4 font-bold">Suggested Actions:</p>
            <ul className="text-sm text-gray-700 mb-4">{generateActions(selectedAlert).map((step, i) => (<li key={i}>👉 {step}</li>))}</ul>
            <div className="flex justify-between font-bold">
              <button onClick={() => setShowModal(false)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {emailPreview && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            <h3 className="font-extrabold text-lg mb-2">Subject: {emailPreview.subject}</h3>
            <pre className="bg-gray-100 p-4 rounded-xl text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">{emailPreview.body}</pre>
            <div className="flex justify-between mt-4">
              <button onClick={() => setEmailPreview(null)} className="bg-gray-300 px-4 py-2 rounded font-bold">Close</button>
              <button onClick={() => {
                navigator.clipboard.writeText(`Subject: ${emailPreview.subject}\n\n${emailPreview.body}`);
                setToast("✉️ Email draft copied to clipboard!");
                setTimeout(() => setToast(null), 3000);
                setEmailPreview(null);
              }} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 font-bold flex gap-4">
        <button onClick={exportCSV} className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold">Export Alerts CSV</button>
      </div>

      <div className="mt-6 font-bold">
        <button onClick={async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/alerts`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
              const data = await res.json();
              if (data && Array.isArray(data.alerts)) {
                const normalized = data.alerts.map((a) => ({...a, level: (a.level || "").toLowerCase()}));
                setAlerts(normalized); setCounts(data.counts); setTotals(data.totals || {});
                setToast(`🔄 Refreshed alerts — ${normalized.length} alerts currently active`); setTimeout(() => setToast(null), 3000);
              } else { setToast("ℹ️ No alerts found during refresh."); setTimeout(() => setToast(null), 3000); }
            } catch (err) { console.error("Error refreshing alerts:", err); setToast("❌ Error refreshing."); setTimeout(() => setToast(null), 3000); }
          }} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 font-bold">Refresh Alerts</button>
      </div>

      {toast && (<div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg font-bold z-50">{toast}</div>)}
    </div>
  );
}
export default Alerts;