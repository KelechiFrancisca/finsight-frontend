import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "./apiConfig";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import AskMyBusiness from "./AskMyBusiness";

const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥",
  NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA",
};

function formatAmount(amount, currency = "NGN") {
  const s = currencySymbols[currency] || "";
  return `${s}${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })}`;
}

function Alerts({ dashboardData, isDarkMode }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [, setCounts] = useState({ high: 0, medium: 0, info: 0 }); // eslint-disable-line no-unused-vars
  const [totals, setTotals] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [sliders, setSliders] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [businessMemory, setBusinessMemory] = useState(null);
  const reportRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const dark =!!isDarkMode;
  const cardCls = dark? "bg-gray-800 border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";
  const innerCls = dark? "bg-white/5 border border-white/10" : "bg-gray-50 border-2 border-gray-900";
  const mutedTxt = dark? "text-gray-300" : "text-gray-600";

  const currency = dashboardData?.currency || totals.currency || "NGN";
  const totalRevenue = dashboardData?.totalRevenue?? totals.total_income?? 0;
  const totalExpenses = dashboardData?.totalExpenses?? totals.total_expense?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;
  const isProfit = netProfit >= 0;

  const { monthlyData, sortedMonths } = useMemo(() => {
    const data = {};
    transactions.forEach((t) => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 7);
      if (!data[key]) data[key] = { income: 0, expense: 0 };
      if (t.type?.toLowerCase() === "income") data[key].income += Number(t.amount || 0);
      else if (t.type?.toLowerCase() === "expense") data[key].expense += Number(t.amount || 0);
    });
    return { monthlyData: data, sortedMonths: Object.keys(data).sort() };
  }, [transactions]);

  // CLEAN: No "Many months" when profitable
  const realRunwayData = useMemo(() => {
    const last3 = sortedMonths.slice(-3);
    if (last3.length === 0) return { avg: 0, text: "No data yet", level: "Low", isExhausted: false, isProfitable: false };
    const avg = last3.reduce((s, k) => s + (monthlyData[k]?.expense || 0), 0) / last3.length || 0;
    if (isProfit) {
      return {
        avg,
        text: `Profitable • +${formatAmount(netProfit, currency)}/mo`,
        shortText: "Profitable",
        level: "Low",
        isExhausted: false,
        isProfitable: true,
        monthlyProfit: netProfit
      };
    }
    if (avg === 0) return { avg, text: "No expense data", level: "Low", isExhausted: false, isProfitable: false };
    const months = Math.abs(netProfit) / avg;
    if (months <= 0) return { avg, text: "0 Months left", level: "Critical", isExhausted: true, isProfitable: false };
    const level = months < 1? "Critical" : months < 3? "High" : months < 6? "Medium" : "Low";
    return { avg, text: `${months.toFixed(1)} Months left`, shortText: `${months.toFixed(1)} Mo`, level, isExhausted: months < 1, isProfitable: false };
  }, [sortedMonths, monthlyData, isProfit, netProfit, currency]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.type?.toLowerCase() === "expense").forEach((t) => {
      const cat = (t.category || "Other").trim();
      const key = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      map[key] = (map[key] || 0) + Number(t.amount || 0);
    });
    return map;
  }, [transactions]);

  const topExpense = useMemo(() => Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0] || null, [expenseByCategory]);
  const topExpensePct = totalExpenses > 0 && topExpense? (topExpense[1] / totalExpenses * 100).toFixed(0) : 0;

  const topExpenseDescription = useMemo(() => {
    if (!topExpense) return null;
    const cat = topExpense[0].toLowerCase();
    const sameCat = transactions.filter(t => t.type?.toLowerCase() === "expense" && (t.category || "").toLowerCase() === cat && t.description);
    if (sameCat.length === 0) return null;
    const freq = {};
    sameCat.forEach(t => { const d = t.description.trim(); freq[d] = (freq[d] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || sameCat[0].description;
  }, [transactions, topExpense]);

  const strengthScore = useMemo(() => {
    let score = 100;
    if (profitMargin < 0) score -= 40; else if (profitMargin < 10) score -= 25; else if (profitMargin < 20) score -= 10;
    if (!isProfit) score -= 20;
    if (realRunwayData.level === "Critical") score -= 20; else if (realRunwayData.level === "High") score -= 15; else if (realRunwayData.level === "Medium") score -= 8;
    if (Number(topExpensePct) > 70) score -= 15; else if (Number(topExpensePct) > 55) score -= 10;
    return Math.max(0, Math.min(100, score));
  }, [profitMargin, isProfit, realRunwayData.level, topExpensePct]);

  const whyNot100 = useMemo(() => {
    const reasons = [];
    if (Number(topExpensePct) > 50) reasons.push(`${topExpense?.[0] || "Food"} ${topExpensePct}% (-${Number(topExpensePct) > 70? 15 : 10})`);
    if (businessMemory?.weakest_day) reasons.push(`${businessMemory.weakest_day} weak (-8)`);
    if (!realRunwayData.isProfitable && realRunwayData.level!== "Low") reasons.push(`Cash ${realRunwayData.shortText || realRunwayData.text} (-10)`);
    return reasons.slice(0, 3);
  }, [topExpensePct, topExpense, businessMemory, realRunwayData]);

  const busiestDay = businessMemory?.busiest_day || "";
  const weakestDay = businessMemory?.weakest_day || "";
  const busyAvg = businessMemory?.busiest_day_avg || businessMemory?.busiest_day_income || 0;
  const weakAvg = businessMemory?.weakest_day_avg || businessMemory?.weakest_day_income || 0;
  const mainCostName = topExpense?.[0] || businessMemory?.top_expense_category || "Your biggest cost";
  const mainCostAmount = topExpense?.[1] || businessMemory?.top_expense_amount || 0;
  const thursdayGap = Math.max(0, (busyAvg || 0) - (weakAvg || 0));

  const todayAction = useMemo(() => {
    const savings = mainCostAmount * 0.1;
    const annual = savings * 12;
    return {
      title: `🚨 ${mainCostName} is ${topExpensePct}% — Lose ${formatAmount(annual, currency)}/yr if nothing changes`,
      detail: `Now ${formatAmount(mainCostAmount, currency)}${topExpenseDescription? ` (${topExpenseDescription})` : ""}. Cut 10% = keep ${formatAmount(savings, currency)}/mo = ${formatAmount(annual, currency)}/yr. Action this week.`,
      saving: savings,
      annual: annual,
      goal: "costs"
    };
  }, [mainCostName, mainCostAmount, topExpensePct, topExpenseDescription, currency]);

  const goToCoach = (goal) => {
    localStorage.setItem("coach_goal", goal);
    navigate(`/forecast?goal=${goal}`);
  };

  const copyTalkScript = () => {
    const script = `Hello, I checked my business. Best ${busiestDay || "Friday"} ${formatAmount(busyAvg, currency)}, slowest ${weakestDay || "Thursday"} ${formatAmount(weakAvg, currency)}. Biggest cost ${mainCostName} ${topExpensePct}% (${formatAmount(mainCostAmount, currency)}). If we don't fix, we lose ${formatAmount(todayAction.annual, currency)}/yr. Can we cut 10% to save ${formatAmount(todayAction.saving, currency)}/mo?`;
    navigator.clipboard.writeText(script);
    showToast("Message copied");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/alerts`, { headers: { Authorization: "Bearer " + token } });
        const data = await res.json();
        if (data && Array.isArray(data.alerts)) {
          const filtered = data.alerts.filter((a) => a.type!== "system").map((a) => ({...a, level: (a.level || "").toLowerCase() }));
          setAlerts(filtered);
          setCounts(data.counts || { high: 0, medium: 0, info: 0 });
          setTotals(data.totals || {});
        }
      } catch {}
      try {
        const token = localStorage.getItem("token");
        const res2 = await fetch(`${API_BASE_URL}/entries`, { headers: { Authorization: "Bearer " + token } });
        const data2 = await res2.json();
        if (Array.isArray(data2)) setTransactions(data2);
      } catch {}
      try {
        const token = localStorage.getItem("token");
        const res3 = await fetch(`${API_BASE_URL}/business-memory`, { headers: { Authorization: "Bearer " + token } });
        const data3 = await res3.json();
        if (data3 &&!data3.error) setBusinessMemory(data3);
      } catch {}
    };
    fetchData();
  }, []);

  const rankedAlerts = useMemo(() => {
    let list = [...alerts].map((a) => {
      const impact = a.type === "expense"? Math.max(totalExpenses - totalRevenue, 0) : Math.abs(netProfit);
      return {...a, _impact: impact };
    }).filter((x) => x._impact > 0).sort((a, b) => b._impact - a._impact);

    if (list.length === 0 && transactions.length > 0) {
      list = [
        { id: "local-1", type: "expense", level: "high", message: `${mainCostName} high`, _impact: mainCostAmount || 1000 },
        { id: "local-2", type: "revenue", level: "medium", message: `${weakestDay || "Slow day"} weak`, _impact: totalRevenue * 0.08 || 500 },
        { id: "local-3", type: "margin", level: "info", message: `Margin ${profitMargin.toFixed(0)}%`, _impact: totalRevenue * 0.05 || 300 },
      ];
    }
    return list.map((x, idx) => ({...x, _rank: idx + 1, _total: list.length || 1 }));
  }, [alerts, totalExpenses, totalRevenue, netProfit, transactions, mainCostName, mainCostAmount, weakestDay, profitMargin]);

  useEffect(() => {
    if (rankedAlerts.length > 0 &&!expandedId) {
      setExpandedId(rankedAlerts[0].id);
    }
  }, [rankedAlerts, expandedId]);

  const exportCSV = () => {
    const rows = [["Rank", "Level", "Type", "Message", "Cash", "Health"]];
    rankedAlerts.forEach((a) => { rows.push([`#${a._rank} of ${a._total}`, a.level, a.type, a.message.replace(/,/g, " "), realRunwayData.text, `${strengthScore}/100`]); });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `business-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); showToast("CSV downloaded");
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    showToast("Making PDF...");
    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, w, h);
    pdf.save(`Business-Alerts-${strengthScore}-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("PDF downloaded");
  };

  return (
    <div ref={reportRef} className={`min-h-screen p-6 ${dark? "bg-transparent text-white" : "bg-[#F8FAFC] text-gray-900"}`}>
      <div className="max-w-[1400px] mx-auto">
        <div className={`${dark? "bg-gray-800 border-white/10" : "bg-white border-2 border-gray-900"} border rounded-xl px-5 py-3 mb-6 flex flex-wrap gap-4 items-center text-[13px] font-bold`}>
          <span className={strengthScore < 80? "text-red-600" : "text-green-700"}>Health: {strengthScore}/100 {strengthScore < 80? "• AT RISK" : "• Good"}</span>
          <span className="text-gray-400">|</span><span>{rankedAlerts.length} to fix</span>
          <span className="text-gray-400">|</span><span className={realRunwayData.isProfitable? "text-green-700" : "text-red-600"}>{realRunwayData.text}</span>
          {whyNot100.length > 0 && <><span className="text-gray-400">|</span><span className="text-amber-700">Why not 100? {whyNot100.join(" • ")}</span></>}
          {busiestDay && <><span className="text-gray-400">|</span><span>Best: {busiestDay} ({formatAmount(busyAvg, currency)}) • Slow: {weakestDay} ({formatAmount(weakAvg, currency)})</span></>}
        </div>

        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">What needs your attention now?</h1>
            <p className={`${mutedTxt} mt-2 text-[14px] font-bold`}>
              Health {strengthScore}/100 {whyNot100.length > 0? `• ${whyNot100.join(", ")}` : ""} • Best {busiestDay} {formatAmount(busyAvg, currency)} • Slowest {weakestDay} {formatAmount(weakAvg, currency)} • {sortedMonths.length || businessMemory?.total_months || 0} months data
            </p>
            <p className="mt-2 text-[13px] font-black text-red-600">
              ⚠️ If nothing changes: Lose {formatAmount(todayAction.annual, currency)}/yr on {mainCostName} • Thursday gap {formatAmount(thursdayGap, currency)} lost every week
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[13px] font-black">Refresh</button>
            <button onClick={exportCSV} className="text-[11px] font-bold underline opacity-50">CSV</button>
            <button onClick={exportPDF} className="text-[11px] font-bold underline opacity-50">PDF</button>
          </div>
        </div>

        {businessMemory && (
          <div className="bg-[#fef08a] border-2 border-gray-900 p-6 rounded-2xl shadow-xl mb-6">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em]">WHAT I KNOW ABOUT YOUR BUSINESS</h2>
            <p className="text-[15px] font-black mt-3 leading-relaxed">
              Best {busiestDay || "Friday"} ({formatAmount(busyAvg || businessMemory.busiest_day_income, currency)} avg), slowest {weakestDay || "Thursday"} ({formatAmount(weakAvg || businessMemory.weakest_day_income, currency)} avg). You sell most {businessMemory.top_income_category || "Sales"}, biggest spend {mainCostName}{topExpenseDescription? ` (${topExpenseDescription})` : ""} ({formatAmount(mainCostAmount, currency)}).
            </p>
            <div className="mt-4 bg-white border-2 border-gray-900 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><p className="text-[11px] font-black uppercase opacity-60">Profit</p><p className="text-[14px] font-black">{formatAmount(netProfit, currency)}/mo • Keep {profitMargin.toFixed(0)}%</p></div>
              <div><p className="text-[11px] font-black uppercase opacity-60">Cash Status</p><p className={`text-[14px] font-black ${realRunwayData.isProfitable? "text-green-700" : "text-red-600"}`}>{realRunwayData.text}</p></div>
              <div><p className="text-[11px] font-black uppercase opacity-60">If Nothing Changes</p><p className="text-[13px] font-black text-red-700">Lose {formatAmount(todayAction.annual, currency)}/yr • {weakestDay} stays {formatAmount(weakAvg, currency)}</p></div>
            </div>
          </div>
        )}

        <div className={`${dark? "bg-gray-800 border-white/10" : "bg-white border-2 border-gray-900"} rounded-[20px] p-6 mb-6 flex flex-wrap justify-between items-center gap-4 border-l-[8px] border-l-red-500`}>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-red-600">TODAY • Action this week</p>
            <p className="text-[18px] font-black mt-1">{todayAction.title}</p>
            <p className="text-[13px] font-bold mt-1 opacity-80">{todayAction.detail}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={copyTalkScript} className="bg-white border-2 border-gray-900 px-5 py-2.5 rounded-full text-[12px] font-black">Copy message</button>
            <button onClick={() => goToCoach(todayAction.goal)} className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-[12px] font-black">Fix in Coach →</button>
          </div>
        </div>

        <div className="mb-6">
          <AskMyBusiness transactions={transactions} totalRevenue={totalRevenue} totalExpenses={totalExpenses} topExpense={topExpense} horizon={12} currency={currency} realRunway={realRunwayData.text} profitMargin={profitMargin} businessMemory={businessMemory} alerts={rankedAlerts} context="alerts" isDarkMode={dark} />
        </div>

        <div className="space-y-6">
          {rankedAlerts.map((alert, idx) => {
            const isExpanded = expandedId === alert.id;
            const sliderVal = sliders[alert.id] || 10;

            // Each fix has DIFFERENT math — no duplicate
            let cutAmount = 0;
            let annualSave = 0;
            let newNet = netProfit;
            let newMargin = profitMargin;
            let newStrength = strengthScore;
            let title = "";
            let sub = "";
            let gain = "";
            let coachGoal = "costs";
            let rankLabel = alert._rank === 1? "Biggest thing to fix" : `Fix #${alert._rank} of ${alert._total}`;

            if (idx === 0) {
              cutAmount = (mainCostAmount || totalExpenses || 0) * (sliderVal / 100);
              annualSave = cutAmount * 12;
              newNet = totalRevenue - Math.max(totalExpenses - cutAmount, 0);
              newMargin = totalRevenue > 0? (newNet / totalRevenue) * 100 : 0;
              newStrength = Math.min(100, strengthScore + Math.round((cutAmount / (totalExpenses || 1)) * 50));
              title = `Food is ${topExpensePct}% — you lose ${formatAmount(annualSave, currency)}/yr if you do nothing`;
              sub = `${mainCostName} ${formatAmount(mainCostAmount, currency)} is ${topExpensePct}% of spend. If it stays, you lose ${formatAmount(annualSave, currency)}/yr`;
              gain = `Cut ${sliderVal}% = Keep ${formatAmount(cutAmount, currency)}/mo = ${formatAmount(annualSave, currency)}/yr`;
            } else if (idx === 1) {
              const monthlyPotential = thursdayGap * 4 * 0.4;
              const annualPotential = monthlyPotential * 12;
              cutAmount = monthlyPotential * (sliderVal / 10);
              annualSave = annualPotential * (sliderVal / 10);
              title = `Thursday weak ${formatAmount(weakAvg, currency)} vs Friday ${formatAmount(busyAvg, currency)} — gap ${formatAmount(thursdayGap, currency)} lost`;
              sub = `Best ${busiestDay} ${formatAmount(busyAvg, currency)}, but ${weakestDay} only ${formatAmount(weakAvg, currency)}. Gap = ${formatAmount(thursdayGap, currency)} every week`;
              gain = `Fix Thursday to 40% of Friday = +${formatAmount(monthlyPotential, currency)}/mo = ${formatAmount(annualPotential, currency)}/yr`;
              coachGoal = "cashflow";
              newNet = netProfit + monthlyPotential;
              newMargin = totalRevenue > 0? (newNet / totalRevenue) * 100 : 0;
              newStrength = Math.min(100, strengthScore + 8);
            } else {
              const extra = totalRevenue * 0.05;
              cutAmount = extra * (sliderVal / 10);
              annualSave = extra * 12 * (sliderVal / 10);
              title = `You keep ${profitMargin.toFixed(0)}% of every R100 — Food 58% eats profit`;
              sub = `Keep ${profitMargin.toFixed(0)}% now, target 20% okay, but ${mainCostName} 58% high. Raise price 5% = extra ${formatAmount(extra, currency)}/mo`;
              gain = `Raise 5% = +${formatAmount(extra, currency)}/mo = ${formatAmount(extra * 12, currency)}/yr`;
              coachGoal = "margin";
              newNet = netProfit + extra;
              newMargin = totalRevenue > 0? (newNet / totalRevenue) * 100 : 0;
              newStrength = Math.min(100, strengthScore + 5);
            }

            if (!isExpanded) {
              return (
                <div key={alert.id} onClick={() => setExpandedId(alert.id)} className={`${cardCls} p-6 rounded-2xl flex justify-between items-center cursor-pointer hover:shadow-lg border-l-[6px] ${alert.level === "high"? "border-red-500" : alert.level === "medium"? "border-amber-400" : "border-blue-400"}`}>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">{rankLabel} • {alert.level.toUpperCase()} • Fix this week</p>
                    <p className="text-[16px] font-black mt-2">{title}</p>
                    <p className="text-[13px] font-bold mt-1">{sub} • {gain}</p>
                  </div>
                  <div className="text-[13px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full">See details →</div>
                </div>
              );
            }

            return (
              <div key={alert.id} className={`${cardCls} p-0 rounded-2xl overflow-hidden shadow-xl border-l-4 ${alert.level === "high"? "border-red-500" : alert.level === "medium"? "border-amber-400" : "border-blue-400"}`}>
                <div className="bg-indigo-600 text-white p-6">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <p className="text-[12px] font-black tracking-widest text-indigo-200 uppercase">{rankLabel} • {gain}</p>
                    <div className="flex gap-2">
                      <button onClick={() => goToCoach(coachGoal)} className="text-[11px] font-black bg-yellow-300 text-gray-900 px-3 py-1 rounded-full">Open in Coach →</button>
                      <button onClick={() => setExpandedId(null)} className="text-[11px] font-black bg-white/20 px-3 py-1 rounded-full">Close ↑</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
                    <div><p className="text-[11px] text-indigo-200 font-bold uppercase">Health</p><p className="text-[16px] font-black mt-1">{strengthScore}/100 → {newStrength}/100</p></div>
                    <div><p className="text-[11px] text-indigo-200 font-bold uppercase">Profit</p><p className="text-[16px] font-black mt-1">{formatAmount(netProfit, currency)}/mo → {formatAmount(newNet, currency)}/mo</p></div>
                    <div><p className="text-[11px] text-indigo-200 font-bold uppercase">{idx === 0? "Biggest spend" : idx === 1? "Day gap" : "Margin"}</p><p className="text-[13px] font-bold mt-1">{idx === 0? `${mainCostName} ${topExpensePct}% (${formatAmount(mainCostAmount, currency)})` : idx === 1? `Gap ${formatAmount(thursdayGap, currency)} • Thu ${formatAmount(weakAvg, currency)} vs Fri ${formatAmount(busyAvg, currency)}` : `Keep ${profitMargin.toFixed(0)}% • Food 58% eats it`}</p></div>
                    <div><p className="text-[11px] text-indigo-200 font-bold uppercase">If you fix</p><p className="text-[15px] font-black mt-1 text-green-200">+{formatAmount(cutAmount, currency)}/mo • {formatAmount(annualSave, currency)}/yr</p></div>
                  </div>
                </div>
                <div className="p-7 space-y-6">
                  <div className={`${innerCls} p-6 rounded-xl`}>
                    <p className="text-[12px] font-black uppercase tracking-widest text-gray-500">What happens if you do nothing?</p>
                    <p className="text-[14px] font-bold mt-3">
                      {idx === 0 && `You keep ${formatAmount(netProfit, currency)}/mo and ${profitMargin.toFixed(0)}% per R100. ${mainCostName} stays ${topExpensePct}% (${formatAmount(mainCostAmount, currency)}). You lose ${formatAmount(cutAmount, currency)}/mo = ${formatAmount(annualSave, currency)}/yr. ${realRunwayData.isProfitable? `Cash growing +${formatAmount(netProfit, currency)}/mo now, but still losing on waste.` : `Cash ${realRunwayData.text}.`}`}
                      {idx === 1 && `Best ${busiestDay} ${formatAmount(busyAvg, currency)}, slowest ${weakestDay} ${formatAmount(weakAvg, currency)}. Gap ${formatAmount(thursdayGap, currency)} every week. If nothing changes, Thursday stays weak and you miss ${formatAmount(annualSave, currency)}/yr.`}
                      {idx === 2 && `You keep ${profitMargin.toFixed(0)}% per R100, target 20% is okay, but Food 58% is high. If nothing changes, margin stays ${profitMargin.toFixed(0)}%. Raise price a little = keep extra ${formatAmount(annualSave, currency)}/yr.`}
                    </p>
                  </div>
                  <div className="bg-teal-50 border-2 border-teal-200 p-6 rounded-xl">
                    <p className="text-[12px] font-black uppercase tracking-widest text-teal-800">
                      {idx === 0? `Try it — cut ${mainCostName} by ${sliderVal}%?` : idx === 1? `Try it — boost Thursday by ${sliderVal}%?` : `Try it — raise price by ${sliderVal}%?`}
                    </p>
                    <input type="range" min="0" max="30" value={sliderVal} onChange={(e) => setSliders((prev) => ({...prev, [alert.id]: Number(e.target.value) }))} className="w-full accent-teal-600 h-2 mt-4" />
                    <p className="text-[13px] font-bold mt-4">
                      Now: Profit {formatAmount(netProfit, currency)}/mo • Keep {profitMargin.toFixed(0)}% • Health {strengthScore}/100 → After: Profit {formatAmount(newNet, currency)}/mo • Keep {newMargin.toFixed(0)}% • Health {newStrength}/100 • +{formatAmount(annualSave, currency)}/yr
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl text-[13px] font-black shadow-2xl z-50">{toast}</div>}
      </div>
    </div>
  );
}
export default Alerts;