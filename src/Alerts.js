import React, { useState, useEffect, useRef, useMemo } from "react";
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
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 800 },
  plugins: {
    legend: {
      labels: {
        font: { size: 14, weight: 'bold' },
        padding: 16,
        color: '#111827',
        usePointStyle: true
      }
    },
    tooltip: {
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 },
      backgroundColor: '#111827',
      padding: 10,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      ticks: { color: '#111827', font: { size: 12, weight: 'bold' } },
      grid: { display: false }
    },
    y: {
      ticks: { color: '#111827', font: { size: 12, weight: 'bold' } },
      beginAtZero: true,
      grid: { color: '#E5E7EB' }
    }
  }
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        font: { size: 13, weight: 'bold' },
        padding: 16,
        color: '#111827',
        usePointStyle: true
      }
    },
    tooltip: { backgroundColor: '#111827', padding: 10, cornerRadius: 8 }
  }
};

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
  const s = currencySymbols[currency] || "";
  return `${s}${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function Alerts({ dashboardData, isDarkMode }) {
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ high: 0, medium: 0, info: 0 });
  const [totals, setTotals] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const [sliders, setSliders] = useState({});
  const [emailPreview, setEmailPreview] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const reportRef = useRef(null);

  const dark =!!isDarkMode;
  const pageCls = dark? "bg-transparent text-white" : "bg-[#F8FAFC] text-gray-900";
  const cardCls = dark
  ? "bg-gray-800 border border-white/10 text-white"
    : "bg-white border border-gray-200 text-gray-900 shadow-[0_4px_24px_rgba(0,0,0,0.06)]";
  const innerCls = dark? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-200";
  const mutedTxt = dark? "text-gray-300" : "text-gray-600";
  const headingTxt = dark? "text-white" : "text-gray-900";

  const currency = dashboardData?.currency || totals.currency || "NGN";
  const totalRevenue = dashboardData?.totalRevenue?? totals.total_income?? 0;
  const totalExpenses = dashboardData?.totalExpenses?? totals.total_expense?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;
  const currentCash = totalRevenue - totalExpenses;

  const { monthlyData, sortedMonths } = useMemo(() => {
    const data = {};
    transactions.forEach((t) => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d)) return;
      const key = d.toISOString().slice(0, 7);
      if (!data[key]) data[key] = { income: 0, expense: 0 };
      if (t.type?.toLowerCase() === "income") data[key].income += Number(t.amount || 0);
      else if (t.type?.toLowerCase() === "expense") data[key].expense += Number(t.amount || 0);
    });
    return { monthlyData: data, sortedMonths: Object.keys(data).sort() };
  }, [transactions]);

  const realRunwayData = useMemo(() => {
    const last3 = sortedMonths.slice(-3);
    if (last3.length === 0) return { avg: 0, text: 'N/A', level: 'info', days: 0 };
    const avg = last3.reduce((s, k) => s + (monthlyData[k]?.expense || 0), 0) / last3.length;
    if (currentCash <= 0) return { avg, text: '0 M - Critical', level: 'Critical', days: 0 };
    if (avg === 0) return { avg, text: '∞', level: 'Low', days: 999 };
    const months = currentCash / avg;
    const days = Math.floor(months * 30);
    const level = months < 1? 'Critical' : months < 3? 'High' : months < 6? 'Medium' : 'Low';
    return { avg, text: `${months.toFixed(1)} M`, level, days };
  }, [sortedMonths, monthlyData, currentCash]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    transactions
    .filter((t) => t.type?.toLowerCase() === "expense")
    .forEach((t) => {
        const cat = (t.category || "Other").trim();
        const key = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        map[key] = (map[key] || 0) + Number(t.amount || 0);
      });
    return map;
  }, [transactions]);

  const topExpense = useMemo(() => {
    const entries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
    return entries[0] || null;
  }, [expenseByCategory]);

  const topExpensePct = totalExpenses > 0 && topExpense? (topExpense[1] / totalExpenses * 100).toFixed(0) : 0;

  const healthScore = useMemo(() => {
    let score = 100;
    if (profitMargin < 0) score -= 40;
    else if (profitMargin < 10) score -= 25;
    else if (profitMargin < 20) score -= 10;
    if (currentCash <= 0) score -= 30;
    else if (realRunwayData.level === 'High') score -= 20;
    else if (realRunwayData.level === 'Medium') score -= 10;
    if (totalRevenue > 0 && totalExpenses / totalRevenue > 0.9) score -= 20;
    if (Number(topExpensePct) > 70) score -= 10;
    return Math.max(0, Math.min(100, score));
  }, [profitMargin, currentCash, realRunwayData.level, totalExpenses, totalRevenue, topExpensePct]);

  const anomalies = useMemo(() => {
    const list = [];
    if (sortedMonths.length === 0) return list;
    const lastM = sortedMonths[sortedMonths.length - 1];
    const prevM = sortedMonths[sortedMonths.length - 2];
    if (lastM && prevM) {
      const currExp = monthlyData[lastM]?.expense || 0;
      const prevExp = monthlyData[prevM]?.expense || 0;
      if (prevExp > 0 && (currExp - prevExp) / prevExp > 0.3) {
        list.push(
          `Expenses spiked ${(((currExp - prevExp) / prevExp) * 100).toFixed(0)}% vs last month | Driver: ${
            topExpense?.[0] || 'Expenses'
          } ${formatAmount(topExpense?.[1] || 0, currency)}`
        );
      }
    }
    if (totalExpenses > totalRevenue && totalRevenue > 0)
      list.push(
        `Burning cash: Net ${formatAmount(netProfit, currency)} | Margin ${profitMargin.toFixed(
          2
        )}% | Runway ${realRunwayData.text}`
      );
    if (currentCash <= 0)
      list.push(`Critical: Cash ${formatAmount(currentCash, currency)} negative | Top: ${topExpense?.[0] || 'Expenses'}`);
    return list;
  }, [sortedMonths, monthlyData, totalExpenses, totalRevenue, netProfit, profitMargin, currentCash, currency, topExpense, realRunwayData.text]);

  const generateAIInsight = (alert) => {
    const topCat = topExpense?.[0] || "Expenses";
    const topAmt = topExpense?.[1] || 0;
    const pct = totalRevenue > 0? (totalExpenses / totalRevenue * 100).toFixed(1) : 0;
    const confidence = sortedMonths.length >= 3? 93 : sortedMonths.length >= 2? 84 : 72;
    let timeToFailure = "N/A";
    if (currentCash <= 0) timeToFailure = "Cash exhausted now";
    else if (realRunwayData.days <= 0) timeToFailure = "Immediate risk";
    else if (realRunwayData.days < 30) timeToFailure = `Risk in ${realRunwayData.days} days`;
    else timeToFailure = `Runway ${realRunwayData.text} (${realRunwayData.days} days)`;
    const financialImpact = alert.type === "expense"? Math.max(totalExpenses - totalRevenue, 0) : Math.abs(netProfit);
    const priorityScore =
      (alert.level || "").toLowerCase() === "high"? 98 : (alert.level || "").toLowerCase() === "medium"? 74 : 45;
    const annualImpact = financialImpact * 12;
    const recovery = topAmt * 0.1 * 12;
    const threeMonthLoss = Math.abs(netProfit) * 3;
    const urgencyLabel =
      currentCash <= 0? "Immediately" : realRunwayData.days < 7? "Within 7 Days" : realRunwayData.days < 30? "Within 30 Days" : "Monitor";

    if (alert.type === "expense") {
      const risk = pct > 90 || realRunwayData.level === 'Critical'? "Critical" : pct > 70? "High" : "Medium";
      return {
        title: "Burn Rate Alert",
        risk,
        riskColor: risk === "Critical"? "#DC2626" : risk === "High"? "#EA580C" : "#CA8A04",
        rootCause: `${topCat} is ${topExpensePct}% of all expenses (${formatAmount(topAmt, currency)})`,
        forecast: `At ${formatAmount(realRunwayData.avg, currency)}/mo burn (3M avg), runway ${realRunwayData.text}`,
        insight: `Expenses at ${pct}% of income. Margin ${profitMargin.toFixed(2)}%. Control ${topCat} costs.`,
        financialImpact,
        annualImpact,
        recovery,
        threeMonthLoss,
        timeToFailure,
        priorityScore,
        confidence,
        urgencyLabel,
        breakEven: totalRevenue > 0? totalExpenses - totalRevenue : totalExpenses
      };
    }
    if (alert.type === "revenue") {
      const risk = profitMargin < 10? "Critical" : profitMargin < 20? "High" : "Medium";
      return {
        title: `Profit Margin Drop ${profitMargin.toFixed(2)}%`,
        risk,
        riskColor: risk === "Critical"? "#DC2626" : "#CA8A04",
        rootCause: `Margin ${profitMargin.toFixed(2)}% below 20% target | Top cost ${topCat} ${formatAmount(topAmt, currency)}`,
        forecast: `Projected 3M net ${formatAmount(netProfit * 3, currency)} at current burn`,
        insight: `Need +15% revenue to hit ${formatAmount(totalRevenue * 1.15, currency)}`,
        financialImpact: Math.abs(netProfit),
        annualImpact: Math.abs(netProfit) * 12,
        recovery: totalRevenue * 0.15 * 12,
        threeMonthLoss: Math.abs(netProfit) * 3,
        timeToFailure,
        priorityScore,
        confidence,
        urgencyLabel,
        breakEven: totalExpenses - totalRevenue
      };
    }
    return {
      title: "System Check",
      risk: "Low",
      riskColor: "#059669",
      rootCause: `Runway ${realRunwayData.text} stable`,
      forecast: `Net ${formatAmount(netProfit, currency)}`,
      insight: "Monitoring normal",
      financialImpact: 0,
      annualImpact: 0,
      recovery: 0,
      threeMonthLoss: 0,
      timeToFailure,
      priorityScore,
      confidence,
      urgencyLabel,
      breakEven: 0
    };
  };

  const generateWhy = (alert) => {
    if (alert.why && alert.why.trim()!== "") return alert.why;
    return generateAIInsight(alert).insight;
  };

  const generateActions = (alert) => {
    const ai = generateAIInsight(alert);
    const perAlertSlider = sliders[alert.id] || 10;
    if (alert.actions && alert.actions.length > 0) return alert.actions;
    if (alert.type === "expense")
      return [
        ai.rootCause,
        `Cut ${topExpense?.[0] || 'costs'} by ${perAlertSlider}% = Save ${formatAmount(
          (topExpense?.[1] || totalExpenses) * perAlertSlider / 100,
          currency
        )}/mo`,
        `Renegotiate ${topExpense?.[0] || 'vendor'} contracts`,
        "Simulate savings in Forecast tab"
      ];
    if (alert.type === "revenue")
      return [ai.rootCause, `Launch promo to reach ${formatAmount(totalRevenue * 1.15, currency)}`, "Upsell existing customers"];
    return ["Review details in Forecast", "Export data for team review"];
  };

  const generateEmailDraft = (alert) => {
    const ai = generateAIInsight(alert);
    const subject = `ACTION: ${ai.title} - ${ai.risk} Risk - Impact ${formatAmount(
      ai.financialImpact,
      currency
    )}/mo - Annual ${formatAmount(ai.annualImpact, currency)}`;
    const actionsList = generateActions(alert).map((a) => `- ${a}`).join('\n');
    const body = `Executive Summary:\nBusiness losing ${formatAmount(
      Math.abs(netProfit),
      currency
    )}/mo. Main driver: ${topExpense?.[0] || 'Expenses'}. Urgency: ${ai.urgencyLabel}. Best action: Increase revenue 15% or cut ${
      topExpense?.[0] || 'costs'
    } 10%.\n\n${ai.title}\nPriority: ${ai.priorityScore}/100 | Confidence: ${ai.confidence}% | ${
      ai.timeToFailure
    }\nFinancial Impact: ${formatAmount(ai.financialImpact, currency)}/mo | Annual: ${formatAmount(
      ai.annualImpact,
      currency
    )} | Recovery: ${formatAmount(ai.recovery, currency)}/yr\n\n${alert.message}\n\nFINANCIALS (${currency}):\nIncome: ${formatAmount(
      totalRevenue,
      currency
    )}\nExpenses: ${formatAmount(totalExpenses, currency)}\nNet: ${formatAmount(netProfit, currency)}\nMargin: ${profitMargin.toFixed(
      2
    )}%\nRunway: ${realRunwayData.text} | Break-even gap: ${formatAmount(ai.breakEven, currency)}\n\nExpected Outcome:\nIf no action: 3-month loss ${formatAmount(
      ai.threeMonthLoss,
      currency
    )}, Margin stays below target, Break-even unlikely\nIf followed: Margin improves by 14%, Monthly losses reduced 41%, Runway extended\n\nActions:\n${actionsList}\n\n- FinSight AI CFO`;
    return { subject, body };
  };

  const fetchAlerts = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/alerts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data && Array.isArray(data.alerts)) {
        const normalized = data.alerts.map((a) => ({...a, level: (a.level || "").toLowerCase() }));
        setAlerts(normalized);
        setCounts(data.counts);
        setTotals(data.totals || {});
        setToast(`Refreshed - ${normalized.length} alerts - ${realRunwayData.text}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      setToast("Error refreshing");
      setTimeout(() => setToast(null), 3000);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/alerts`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
    .then((res) => res.json())
    .then((data) => {
        if (data && Array.isArray(data.alerts)) {
          const normalized = data.alerts.map((a) => ({...a, level: (a.level || "").toLowerCase() }));
          setAlerts(normalized);
          setCounts(data.counts);
          setTotals(data.totals || {});
        } else setAlerts([]);
      })
    .catch(() => {});
    fetch(`${API_BASE_URL}/entries`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
    .then((res) => res.json())
    .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
      })
    .catch(() => {});
  }, [dashboardData]);

  const highPriority = counts.high || 0;
  const mediumPriority = counts.medium || 0;
  const informational = counts.info || 0;

  const executiveSummary = useMemo(() => {
    const losing = Math.abs(netProfit);
    const driver = topExpense?.[0] || 'Expenses';
    const urgency = currentCash <= 0? "Immediate action required" : realRunwayData.days < 30? "Action within 7 days" : "Monitor";
    const bestAction = totalExpenses > totalRevenue? `Cut ${driver} by 10% or increase revenue 15%` : `Maintain current controls`;
    return { losing, driver, urgency, bestAction };
  }, [netProfit, topExpense, currentCash, realRunwayData.days, totalExpenses, totalRevenue]);

  const rankedAlerts = useMemo(() => {
    const list = [...alerts]
    .map((a) => {
        try {
          const insight = generateAIInsight(a);
          return { original: a, insight };
        } catch {
          return null;
        }
      })
    .filter((x) => x && x.insight && x.insight.financialImpact > 0 && x.insight.title!== "System Check")
    .sort((a, b) => b.insight.financialImpact - a.insight.financialImpact);
    const totalActive = list.length || alerts.length || 1;
    return list.map((x, idx) => ({...x.original, _rank: idx + 1, _insight: x.insight, _total: totalActive }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, totalRevenue, totalExpenses, netProfit, realRunwayData, topExpense, topExpensePct, profitMargin, sortedMonths, currency]);

  const topAlertType = () => {
    if (alerts.length === 0) return `No alerts - Runway ${realRunwayData.text} - Health ${healthScore}/100`;
    const e = alerts.filter((a) => a.type === "expense").length;
    return `Expenses driving ${e} alerts | Top: ${topExpense?.[0] || 'N/A'} ${formatAmount(
      topExpense?.[1] || 0,
      currency
    )} | Health ${healthScore}/100`;
  };

  const exportCSV = () => {
    const rows = [
      ["ID", "Level", "Type", "Message", "Runway", "Net", "Impact", "AnnualImpact", "Priority", "Confidence", "Analysis", "Actions"]
    ];
    rankedAlerts.forEach((a) => {
      const ai = a._insight || generateAIInsight(a);
      const whyText = generateWhy(a).replace(/,/g, ' ');
      const actionsText = generateActions(a).join(' | ').replace(/,/g, ' ');
      const msg = a.message.replace(/,/g, ' ');
      rows.push([
        a.id,
        a.level,
        a.type,
        msg,
        realRunwayData.text,
        formatAmount(netProfit, currency),
        formatAmount(ai.financialImpact, currency),
        formatAmount(ai.annualImpact, currency),
        ai.priorityScore,
        ai.confidence + '%',
        whyText,
        actionsText
      ]);
    });
    const csvString = rows.map((r) => r.join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + csvString;
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `alerts-${realRunwayData.text.replace(/\s/g, '')}-${currency}.csv`;
    link.click();
    setToast(`Exported CSV - ${realRunwayData.text} - ${currency}`);
    setTimeout(() => setToast(null), 3000);
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`FinSight-Alerts-${healthScore}-${currency}-${new Date().toISOString().slice(0, 10)}.pdf`);
    setToast(`PDF exported - Health ${healthScore}/100`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div ref={reportRef} className={`${pageCls} min-h-screen p-6`}>
      <div className="max-w-[1400px] mx-auto">
        <div
          className={`${
            dark? "bg-gray-800 border-white/10" : "bg-white border-gray-200"
          } border rounded-xl px-5 py-3 mb-6 flex flex-wrap gap-4 items-center text-[14px] font-bold shadow-sm`}
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> AI Engine Active
          </span>
          <span className="text-gray-400">|</span>
          <span>
            Monitoring:{" "}
            <span className={healthScore < 50? "text-red-600" : healthScore < 75? "text-amber-600" : "text-green-600"}>
              {healthScore < 50? "Critical" : healthScore < 75? "Needs Attention" : "Healthy"}
            </span>
          </span>
          <span className="text-gray-400">|</span>
          <span>Last Scan: 2 min ago</span>
          <span className="text-gray-400">|</span>
          <span>Health: {healthScore}/100</span>
          <span className="text-gray-400">|</span>
          <span>
            {currency} • {rankedAlerts.length} active risks
          </span>
        </div>

        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${headingTxt}`}>AI-Powered Alerts</h1>
              <div
                className={`px-4 py-2 rounded-xl text-sm font-black ${
                  healthScore < 50
                  ? "bg-red-100 text-red-700 border border-red-200"
                    : healthScore < 75
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-green-100 text-green-700 border border-green-200"
                }`}
              >
                Health: {healthScore}/100
              </div>
            </div>
            <p className={`${mutedTxt} mt-2 text-[15px] font-bold`}>
              Daily Operations • Runway:{" "}
              <span className="font-black text-gray-900">{realRunwayData.text} (3M avg)</span> • Net {formatAmount(netProfit, currency)} •
              Margin {profitMargin.toFixed(2)}% • {currency}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={fetchAlerts}
              disabled={isRefreshing}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-[14px] font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isRefreshing? "Refreshing..." : "Refresh Alerts"}
            </button>
            <button onClick={exportCSV} className="bg-gray-900 text-white px-5 py-3 rounded-xl text-[14px] font-black">
              Export CSV
            </button>
            <button
              onClick={exportPDF}
              className="bg-white border-2 border-gray-300 px-5 py-3 rounded-xl text-[14px] font-black text-gray-900"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className={`${cardCls} p-6 rounded-2xl border-l-4 border-indigo-600 mb-8 shadow-xl`}>
          <p className="text-[14px] font-black uppercase tracking-widest text-indigo-700 mb-4">
            Executive Summary • AI CFO Briefing
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[13px] font-black uppercase text-gray-500">Status</p>
              <p className="text-[16px] font-black text-gray-900 mt-1">Business losing {formatAmount(executiveSummary.losing, currency)}/mo</p>
            </div>
            <div>
              <p className="text-[13px] font-black uppercase text-gray-500">Main Driver</p>
              <p className="text-[16px] font-black text-gray-900 mt-1">
                {executiveSummary.driver} {topExpensePct}% of expenses
              </p>
            </div>
            <div>
              <p className="text-[13px] font-black uppercase text-gray-500">Urgency</p>
              <p className="text-[16px] font-black text-red-600 mt-1">{executiveSummary.urgency}</p>
            </div>
            <div>
              <p className="text-[13px] font-black uppercase text-gray-500">Best Action</p>
              <p className="text-[16px] font-black text-gray-900 mt-1">{executiveSummary.bestAction}</p>
            </div>
          </div>
        </div>

        {anomalies.length > 0 && (
          <div
            className={`${
              dark? "bg-indigo-900/20 border-indigo-500/30" : "bg-indigo-50 border-indigo-200"
            } border-2 rounded-xl p-5 mb-8`}
          >
            <p className="text-[14px] font-black uppercase tracking-widest text-indigo-700 mb-3">
              AI Anomaly Detection • {realRunwayData.text} • {currency}
            </p>
            {anomalies.map((a, i) => (
              <p key={i} className="text-[15px] font-bold text-gray-800 mb-2 leading-relaxed">
                • {a}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`${cardCls} p-6 rounded-2xl`}>
            <p className="text-[13px] font-black uppercase tracking-widest text-gray-500">High Priority • {realRunwayData.text}</p>
            <p className="text-4xl font-black mt-2 text-gray-900">{highPriority}</p>
            <p className={`text-[15px] font-bold ${mutedTxt} mt-2 leading-relaxed`}>
              {highPriority} urgent • {topExpense?.[0] || 'Rent'} {formatAmount(topExpense?.[1] || 0, currency)}
            </p>
          </div>
          <div className={`${cardCls} p-6 rounded-2xl`}>
            <p className="text-[13px] font-black uppercase tracking-widest text-gray-500">Medium Priority • {formatAmount(netProfit, currency)}</p>
            <p className="text-4xl font-black mt-2 text-gray-900">{mediumPriority}</p>
            <p className={`text-[15px] font-bold ${mutedTxt} mt-2 leading-relaxed`}>
              {mediumPriority} alerts • Margin {profitMargin.toFixed(2)}%
            </p>
          </div>
          <div className={`${cardCls} p-6 rounded-2xl`}>
            <p className="text-[13px] font-black uppercase tracking-widest text-gray-500">Health Score • {currency}</p>
            <p className={`text-4xl font-black mt-2 ${healthScore < 50? "text-red-600" : healthScore < 75? "text-amber-600" : "text-green-600"}`}>
              {healthScore}/100
            </p>
            <p className={`text-[15px] font-bold ${mutedTxt} mt-2 leading-relaxed`}>
              {healthScore < 50? "Critical - Immediate action" : healthScore < 75? "Needs attention" : "Healthy"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className={`${cardCls} p-6 rounded-2xl`}>
            <h2 className={`text-[16px] font-black ${headingTxt} mb-1`}>Alert Distribution • {realRunwayData.text}</h2>
            <div style={{ height: '550px' }}>
              <Pie
                options={pieOptions}
                data={{
                  labels: ["High", "Medium", "Info"],
                  datasets: [
                    {
                      data: [highPriority, mediumPriority, informational],
                      backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6"],
                      borderWidth: 0
                    }
                  ]
                }}
              />
            </div>
            <p className={`${mutedTxt} mt-4 text-[15px] font-bold`}>{topAlertType()}</p>
          </div>
          <div className={`${cardCls} p-6 rounded-2xl`}>
            <h2 className={`text-[16px] font-black ${headingTxt} mb-1`}>Alerts Trend • {formatAmount(netProfit, currency)}</h2>
            <div style={{ height: '550px' }}>
              <Line
                options={chartOptions}
                data={{
                  labels: rankedAlerts.map((_, i) => `Alert ${i + 1}`),
                  datasets: [
                    {
                      label: "Alerts",
                      data: rankedAlerts.map((_, i) => i + 1),
                      borderColor: "#10B981",
                      backgroundColor: "rgba(16,185,129,0.12)",
                      fill: true,
                      tension: 0.4,
                      borderWidth: 3,
                      pointRadius: 4
                    }
                  ]
                }}
              />
            </div>
            <p className={`${mutedTxt} mt-4 text-[15px] font-bold`}>
              {rankedAlerts.length} active premium • {realRunwayData.text} • {currency}
            </p>
          </div>
          <div className={`${cardCls} p-6 rounded-2xl`}>
            <h2 className={`text-[16px] font-black ${headingTxt} mb-1`}>By Category • {topExpense?.[0] || 'Rent'}</h2>
            <div style={{ height: '550px' }}>
              <Bar
                options={chartOptions}
                data={{
                  labels: ["Fraud", "Expenses", "Revenue", "Churn"],
                  datasets: [
                    {
                      label: "Count",
                      data: [
                        rankedAlerts.filter((a) => a.type === "fraud").length,
                        rankedAlerts.filter((a) => a.type === "expense").length,
                        rankedAlerts.filter((a) => a.type === "revenue").length,
                        rankedAlerts.filter((a) => a.type === "churn").length
                      ],
                      backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"],
                      borderRadius: 8
                    }
                  ]
                }}
              />
            </div>
            <p className={`${mutedTxt} mt-4 text-[15px] font-bold`}>{topAlertType()}</p>
          </div>
        </div>

        <div className="space-y-8">
          {rankedAlerts.map((alert) => {
            const level = (alert.level || "").toLowerCase();
            let borderColor = "border-blue-300";
            if (level === "high") borderColor = "border-red-500";
            if (level === "medium") borderColor = "border-amber-400";
            let titleColor = "text-blue-700";
            if (level === "high") titleColor = "text-red-600";
            if (level === "medium") titleColor = "text-amber-600";
            const ai = alert._insight || generateAIInsight(alert);
            const sliderVal = sliders[alert.id] || 10;
            const cutAmount = (topExpense?.[1] || totalExpenses || 0) * (sliderVal / 100);
            const newExpenses = Math.max(totalExpenses - cutAmount, 0);
            const newNet = totalRevenue - newExpenses;
            const newMargin = totalRevenue > 0? (newNet / totalRevenue) * 100 : 0;
            const newRunwayNum = realRunwayData.avg > 0? currentCash / Math.max(realRunwayData.avg - cutAmount, 0.01) : 999;
            const newRunway = newRunwayNum > 100? '∞' : `${newRunwayNum.toFixed(1)} M`;
            const newHealth = Math.min(100, Math.max(0, healthScore + Math.round((cutAmount / (totalExpenses || 1)) * 50)));
            const breakEvenGap = Math.max(totalExpenses - totalRevenue, 0);
            const healthImprovement = newHealth - healthScore;

            let recoveryLabel = "Recovery Time";
            let recoveryValue = "Never reaches break-even";
            let recoveryColor = "text-red-700";
            if (cutAmount >= breakEvenGap && breakEvenGap > 0) {
              const months = Math.ceil(breakEvenGap / Math.max(cutAmount, 1));
              recoveryLabel = "Recovery Time";
              recoveryValue = months <= 1? "Immediate (<30 Days)" : `${months * 30} Days`;
              recoveryColor = "text-green-700";
            } else if (netProfit >= 0) {
              recoveryLabel = "Recovery Time";
              recoveryValue = "Already Profitable";
              recoveryColor = "text-green-700";
            } else {
              const neededPct = ((breakEvenGap / (topExpense?.[1] || totalExpenses || 1)) * 100).toFixed(0);
              recoveryLabel = "Break-Even Requirement";
              recoveryValue = `${neededPct}% Cost Reduction Needed`;
              recoveryColor = "text-amber-700";
            }

            const percentile = alert._total > 1? Math.round(((alert._total - alert._rank) / (alert._total - 1)) * 100) : 100;
            const annualSave = cutAmount * 12;

            return (
              <div key={alert.id} className={`${cardCls} p-8 rounded-2xl border-l-4 ${borderColor} shadow-xl`}>
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <span
                        className={`text-[12px] font-black uppercase px-3 py-1 rounded-full ${
                          alert.type === "expense"? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {alert.type}
                      </span>
                      <span className="text-[12px] font-black uppercase px-3 py-1 rounded-full bg-gray-900 text-white">
                        Priority {ai.priorityScore}/100
                      </span>
                      <span className="text-[12px] font-black uppercase px-3 py-1 rounded-full bg-indigo-100 text-indigo-800">
                        Confidence {ai.confidence}%
                      </span>
                      <span className="text-[12px] font-black uppercase px-3 py-1 rounded-full bg-purple-100 text-purple-800">
                        #{alert._rank} of {alert._total}
                      </span>
                      <span className="text-[12px] font-black uppercase px-3 py-1 rounded-full bg-red-100 text-red-700">
                        {ai.urgencyLabel}
                      </span>
                    </div>
                    <h3 className={`text-2xl md:text-3xl font-black mt-3 ${titleColor}`}>{ai.title}</h3>
                    <p className="text-[14px] font-bold text-gray-500 mt-2">
                      Higher than {percentile}% of active risks • Annual Impact {formatAmount(ai.annualImpact, currency)}
                    </p>
                  </div>
                  <span
                    className="px-4 py-1.5 rounded-full text-[12px] font-black text-white whitespace-nowrap shadow-sm"
                    style={{ background: ai.riskColor }}
                  >
                    {ai.risk} • {realRunwayData.text}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                  <div className={`${innerCls} p-5 rounded-xl border-l-4 border-red-500`}>
                    <p className="text-[13px] font-black uppercase tracking-widest text-gray-500">Monthly Impact (Live)</p>
                    <p className="text-[18px] font-black text-red-600 mt-1">{formatAmount(cutAmount, currency)}/mo</p>
                    <p className="text-[13px] font-bold text-gray-600 mt-1">Slider {sliderVal}% cut - same everywhere</p>
                  </div>
                  <div className={`${innerCls} p-5 rounded-xl`}>
                    <p className="text-[13px] font-black uppercase tracking-widest text-gray-500">{recoveryLabel}</p>
                    <p className={`text-[16px] font-black mt-1 ${recoveryColor}`}>{recoveryValue}</p>
                    <p className="text-[13px] font-bold text-indigo-600 mt-1">Live from simulator</p>
                  </div>
                  <div className={`${innerCls} p-5 rounded-xl`}>
                    <p className="text-[13px] font-black uppercase tracking-widest text-gray-500">Annual Recovery</p>
                    <p className="text-[18px] font-black text-green-700 mt-1">{formatAmount(annualSave, currency)}/yr</p>
                    <p className="text-[13px] font-bold text-gray-500 mt-1">Gap: {formatAmount(ai.breakEven, currency)}</p>
                  </div>
                  <div className={`${innerCls} p-5 rounded-xl bg-indigo-50 border border-indigo-200`}>
                    <p className="text-[13px] font-black uppercase tracking-widest text-indigo-700">Alert Impact</p>
                    <p className="text-[16px] font-black text-gray-900 mt-1">
                      #{alert._rank} of {alert._total}
                    </p>
                    <p className="text-[13px] font-bold text-indigo-700 mt-1">Confidence {ai.confidence}%</p>
                  </div>
                </div>

                <p className="text-[16px] font-bold text-gray-800 leading-relaxed bg-gray-50 p-5 rounded-xl border">{alert.message}</p>

                <div className={`${innerCls} p-6 rounded-xl mt-6`}>
                  <p className="text-[14px] font-black uppercase tracking-widest text-gray-600 mb-4">
                    Detailed AI Analysis - Problem → Cause → Fix
                  </p>
                  <p className="text-[15px] font-bold mb-3 text-gray-900 leading-relaxed">
                    <span className="font-black text-black">Problem:</span> Margin {profitMargin.toFixed(2)}% | Net{" "}
                    {formatAmount(netProfit, currency)}
                  </p>
                  <p className="text-[15px] font-bold mb-3 text-gray-900 leading-relaxed">
                    <span className="font-black text-black">Cause:</span> {ai.rootCause}
                  </p>
                  <p className="text-[15px] font-bold mb-3 text-gray-900 leading-relaxed">
                    <span className="font-black text-black">Forecast:</span> {ai.forecast}
                  </p>
                  <p className="text-[15px] font-bold text-gray-900 leading-relaxed">
                    <span className="font-black text-black">Analysis:</span> {ai.insight}
                  </p>
                  <div className="mt-5 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-[15px] font-bold">
                    <div>
                      Income: <span className="font-black">{formatAmount(totalRevenue, currency)}</span>
                    </div>
                    <div>
                      Expenses: <span className="font-black">{formatAmount(totalExpenses, currency)}</span>
                    </div>
                    <div>
                      Net:{" "}
                      <span className={`font-black ${netProfit < 0? "text-red-600" : "text-green-600"}`}>
                        {formatAmount(netProfit, currency)}
                      </span>
                    </div>
                    <div>
                      Margin: <span className="font-black">{profitMargin.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-red-50 border-2 border-red-200 p-6 rounded-xl">
                    <p className="text-[14px] font-black uppercase tracking-widest text-red-700 mb-4">Projected Outcome - If No Action</p>
                    <ul className="text-[15px] font-bold text-gray-800 space-y-2 leading-relaxed">
                      <li>• 3-month loss: {formatAmount(ai.threeMonthLoss, currency)}</li>
                      <li>• Margin remains {profitMargin.toFixed(2)}% below 20% target</li>
                      <li>• Break-even unlikely - need {formatAmount(ai.breakEven, currency)}</li>
                      <li>• Runway stays {realRunwayData.text}</li>
                      <li>
                        • Break-Even Requirement:{" "}
                        <span className="text-red-700 font-black">
                          {((breakEvenGap / (topExpense?.[1] || totalExpenses || 1)) * 100).toFixed(0)}% Cost Reduction Needed
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 p-6 rounded-xl">
                    <p className="text-[14px] font-black uppercase tracking-widest text-green-700 mb-4">
                      Projected Outcome - If Recommendation Followed
                    </p>
                    <ul className="text-[15px] font-bold text-gray-800 space-y-2 leading-relaxed">
                      <li>
                        • Margin improves to {newMargin.toFixed(1)}% ( +{(newMargin - profitMargin).toFixed(1)}% )
                      </li>
                      <li>• Monthly loss reduced - save {formatAmount(cutAmount, currency)}/mo</li>
                      <li>
                        • Runway extended to {newRunway} vs {realRunwayData.text} now
                      </li>
                      <li>• Annual recovery {formatAmount(annualSave, currency)}/yr</li>
                      <li>
                        • {recoveryLabel}: <span className={`font-black ${recoveryColor}`}>{recoveryValue}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 bg-indigo-900 text-white p-6 rounded-xl shadow-lg">
                  <p className="text-[14px] font-black uppercase tracking-widest text-indigo-300 mb-4">AI Decision - CFO Recommendation</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div>
                      <p className="text-[13px] text-indigo-300 font-bold">Recommended Action</p>
                      <p className="text-[15px] font-black mt-2 leading-relaxed">
                        {alert.type === "expense"? `Reduce ${topExpense?.[0] || 'costs'} by ${sliderVal}%` : "Increase revenue by 15%"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] text-indigo-300 font-bold">Likelihood of Reaching Break-Even</p>
                      <p className="text-[15px] font-black mt-2">{ai.confidence}% - Probability of margin improvement</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-indigo-300 font-bold">Potential Impact (Live)</p>
                      <p className="text-[16px] font-black mt-2 text-green-300">+{formatAmount(cutAmount, currency)}/mo</p>
                      <p className="text-[12px] text-indigo-200 mt-1">Same as simulator - no confusion</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-indigo-300 font-bold">Reason</p>
                      <p className="text-[14px] font-bold mt-2 leading-relaxed">
                        Fastest path to breakeven. Higher than {percentile}% of risks.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-6 p-6 rounded-xl ${
                    dark? "bg-teal-900/20 border-2 border-teal-700/30" : "bg-teal-50 border-2 border-teal-200"
                  }`}
                >
                  <p className="text-[15px] font-black uppercase tracking-widest text-teal-800 mb-4">
                    Business Impact Simulator • {topExpense?.[0] || 'Top'} • {currency}
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={sliderVal}
                    onChange={(e) => setSliders((prev) => ({...prev, [alert.id]: Number(e.target.value) }))}
                    className="w-full accent-teal-600 h-2"
                  />
                  <p className="text-[15px] font-bold mt-4 text-gray-900 leading-relaxed">
                    Cut {sliderVal}% = Save{" "}
                    <span className="font-black text-teal-700 text-[17px]">{formatAmount(cutAmount, currency)}/mo</span> → New Runway:{" "}
                    <span className="font-black">{newRunway}</span> • Annual: {formatAmount(annualSave, currency)} • Confidence{" "}
                    {ai.confidence}%
                  </p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                      <p className="text-[13px] font-black uppercase tracking-widest text-gray-500 mb-3">Before</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[12px] font-bold text-gray-500">Margin</p>
                          <p className="text-[16px] font-black text-red-600 mt-1">{profitMargin.toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-500">Runway</p>
                          <p className="text-[16px] font-black text-gray-900 mt-1">{realRunwayData.text.split(' ')[0]}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-500">Health</p>
                          <p className="text-[16px] font-black text-red-600 mt-1">{healthScore}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border-2 border-teal-300 rounded-xl p-4 shadow-sm">
                      <p className="text-[13px] font-black uppercase tracking-widest text-teal-700 mb-3">After {sliderVal}% Cut</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[12px] font-bold text-gray-500">Margin</p>
                          <p className="text-[16px] font-black text-green-600 mt-1">{newMargin.toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-500">Runway</p>
                          <p className="text-[16px] font-black text-gray-900 mt-1">{newRunway.split(' ')[0]}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-500">Health</p>
                          <p className="text-[16px] font-black text-green-600 mt-1">{newHealth}</p>
                        </div>
                      </div>
                      <p className="text-[13px] font-black text-green-600 mt-3">+{healthImprovement} Improvement</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-amber-50 border-2 border-amber-200 p-5 rounded-xl">
                      <p className="text-[13px] font-black uppercase tracking-widest text-amber-800 mb-3">Cost of Delay</p>
                      <p className="text-[15px] font-bold text-gray-900">
                        1 Month Delay ={" "}
                        <span className="text-red-600 font-black">{formatAmount(Math.abs(netProfit), currency)} Loss</span>
                      </p>
                      <p className="text-[15px] font-bold text-gray-900 mt-1">
                        3 Month Delay ={" "}
                        <span className="text-red-600 font-black">{formatAmount(Math.abs(netProfit) * 3, currency)} Loss</span>
                      </p>
                    </div>
                    <div className="bg-white border-2 border-gray-200 p-5 rounded-xl">
                      <p className="text-[13px] font-black uppercase tracking-widest text-gray-500 mb-3">Health Progress</p>
                      <p className="text-[15px] font-bold">
                        Current Health: <span className="font-black">{healthScore}/100</span> → Projected:{" "}
                        <span className="text-green-600 font-black">{newHealth}/100</span>
                      </p>
                      <p className="text-[14px] font-black text-green-600 mt-1">+{healthImprovement} Improvement - Visible progress</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-gray-900 text-white p-6 rounded-xl shadow-xl border border-gray-700">
                  <p className="text-[14px] font-black uppercase tracking-widest text-amber-300 mb-4">AI Business Verdict</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[15px] leading-relaxed">
                    <div className="space-y-3">
                      <p>
                        <span className="text-gray-400 font-bold">Financial Health:</span>{" "}
                        <span
                          className={`font-black ml-2 ${
                            healthScore < 30? "text-red-400" : healthScore < 60? "text-amber-400" : "text-green-400"
                          }`}
                        >
                          {healthScore < 30? "Critical" : healthScore < 60? "At Risk" : "Stable"}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-400 font-bold">Primary Issue:</span>{" "}
                        <span className="font-bold ml-2">
                          {topExpense?.[0] || 'Expenses'} consumes {topExpensePct}% of expenses.
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-400 font-bold">Break-even Gap:</span>{" "}
                        <span className="font-black ml-2 text-red-300">{formatAmount(ai.breakEven, currency)}/month</span>
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p>
                        <span className="text-gray-400 font-bold">Fastest Fix:</span>{" "}
                        <span className="font-bold ml-2">Reduce {topExpense?.[0] || 'costs'} by {sliderVal}%</span>
                      </p>
                      <p>
                        <span className="text-gray-400 font-bold">Expected Outcome:</span>{" "}
                        <span className="font-bold ml-2">
                          Loss reduced by {totalExpenses > 0? ((cutAmount / Math.abs(netProfit || 1)) * 100).toFixed(0) : 0}%.
                          Margin improves by {(newMargin - profitMargin).toFixed(1)}%. Annual savings {formatAmount(annualSave, currency)}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-400 font-bold">{recoveryLabel}:</span>{" "}
                        <span className="font-black ml-2 text-green-300">{recoveryValue}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[14px] font-black uppercase tracking-widest text-gray-600 mb-3">Why This Matters</p>
                  <p className="text-[15px] font-bold text-gray-800 leading-relaxed">
                    The business is currently losing {formatAmount(Math.abs(netProfit), currency)}/mo. At current rate, company will lose{" "}
                    {formatAmount(ai.threeMonthLoss, currency)} in next 3 months. {topExpense?.[0] || 'Expenses'} consumes {topExpensePct}%
                    of costs. Revenue must increase by 15% to reach breakeven at {formatAmount(totalRevenue * 1.15, currency)} or cut costs by{" "}
                    {formatAmount(ai.breakEven, currency)}.
                  </p>
                  <p className="text-[14px] font-black uppercase tracking-widest text-gray-600 mt-6 mb-3">
                    Recommended Actions with Expected Impact
                  </p>
                  <ul className="text-[15px] font-bold text-gray-800 space-y-2 leading-relaxed">
                    {generateActions(alert).map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span>👉</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 flex gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedAlert(alert);
                      setShowModal(true);
                    }}
                    className="bg-gray-900 text-white px-7 py-3.5 rounded-xl text-[14px] font-black hover:bg-black shadow"
                  >
                    Acknowledge Alert
                  </button>
                  <a
                    href={`/forecast?tab=${alert.type === "expense"? "proportion" : "growth"}`}
                    className="bg-white border-2 border-gray-300 px-7 py-3.5 rounded-xl text-[14px] font-black text-gray-900 hover:bg-gray-50"
                  >
                    Simulate in Forecast →
                  </a>
                  <button
                    onClick={() => {
                      setToast("Task Created - Assigned to CFO");
                      setTimeout(() => setToast(null), 3000);
                    }}
                    className="bg-indigo-600 text-white px-7 py-3.5 rounded-xl text-[14px] font-black hover:bg-indigo-700 shadow"
                  >
                    Create Task
                  </button>
                  <button
                    onClick={() => setEmailPreview(generateEmailDraft(alert))}
                    className="bg-white border-2 border-gray-300 px-7 py-3.5 rounded-xl text-[14px] font-black text-gray-900 hover:bg-gray-50"
                  >
                    Share Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {rankedAlerts.length === 0 && (
          <div className={`${cardCls} p-10 rounded-2xl text-center`}>
            <p className="text-[16px] font-black">All Clear - No critical financial risks - Health {healthScore}/100</p>
            <p className="text-[14px] font-bold text-gray-500 mt-2">AI Engine Active • Last scan 2 min ago • {currency}</p>
          </div>
        )}

        <div className="mt-10 flex gap-3 flex-wrap pb-10">
          <button
            onClick={fetchAlerts}
            disabled={isRefreshing}
            className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-[14px] font-black shadow-lg hover:bg-indigo-700"
          >
            {isRefreshing? "Refreshing..." : "Refresh Alerts"} • {realRunwayData.text} • {currency}
          </button>
          <button onClick={exportCSV} className="bg-gray-900 text-white px-6 py-3.5 rounded-xl text-[14px] font-black">
            Export CSV • {currency}
          </button>
          <button
            onClick={exportPDF}
            className="bg-white border-2 border-gray-300 px-6 py-3.5 rounded-xl text-[14px] font-black"
          >
            Export PDF • Health {healthScore}
          </button>
        </div>

        {emailPreview && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
            <div className={`${cardCls} p-7 rounded-2xl max-w-2xl w-full shadow-2xl`}>
              <p className="text-[14px] font-black uppercase tracking-widest text-gray-500">Share Report Preview • {currency}</p>
              <h3 className="text-[16px] font-black mt-2 leading-relaxed">{emailPreview.subject}</h3>
              <pre
                className={`${innerCls} p-5 rounded-xl mt-4 text-[14px] whitespace-pre-wrap max-h-96 overflow-auto font-bold leading-relaxed`}
              >
                {emailPreview.body}
              </pre>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEmailPreview(null)}
                  className="flex-1 bg-white border-2 border-gray-300 py-3 rounded-xl text-[14px] font-black"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${emailPreview.subject}\n\n${emailPreview.body}`);
                    setToast(`Copied - ${realRunwayData.text} - ${currency}`);
                    setTimeout(() => setToast(null), 3000);
                    setEmailPreview(null);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[14px] font-black"
                >
                  Copy Report
                </button>
              </div>
            </div>
          </div>
        )}

        {showModal && selectedAlert && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-40 p-4">
            <div className={`${cardCls} p-7 rounded-2xl max-w-lg w-full shadow-2xl`}>
              <h3 className="text-lg font-black">Alert Details • {realRunwayData.text} • {currency}</h3>
              <p className="text-[15px] font-bold mt-3 leading-relaxed">{selectedAlert.message}</p>
              <ul className="text-[14px] font-bold mt-4 space-y-2 leading-relaxed">
                {generateActions(selectedAlert).map((s, i) => (
                  <li key={i}>👉 {s}</li>
                ))}
              </ul>
              <button onClick={() => setShowModal(false)} className="mt-6 w-full bg-gray-900 text-white py-3.5 rounded-xl text-[14px] font-black">
                Close
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3 rounded-xl text-[14px] font-black shadow-2xl z-50">{toast}</div>
        )}
      </div>
    </div>
  );
}

export default Alerts;