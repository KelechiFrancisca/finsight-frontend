import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from "chart.js";
import API_BASE_URL from "./apiConfig";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AskMyBusiness from "./AskMyBusiness";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const currencySymbols = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥", NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA" };
function formatAmount(amount, currency = "USD") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const GOAL_OPTIONS = [
  { id: "profit", label: "Make More Money", question: "How do I make more money?" },
  { id: "cashflow", label: "Make Cash Last Longer", question: "How do I make my cash last longer?" },
  { id: "costs", label: "Spend Less", question: "How do I spend less?" },
  { id: "hire", label: "Hire Someone", question: "Can I hire someone now?" },
  { id: "branch", label: "Open Another Shop", question: "Can I open another shop?" },
  { id: "equipment", label: "Buy Equipment", question: "Can I buy equipment now?" },
  { id: "margin", label: "Keep 20 From 100", question: "How do I keep 20 from every 100 I sell?" },
  { id: "custom", label: "My Own Goal", question: "" },
];

function Forecast({ isDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [activeScenario, setScenario] = useState("Realistic");
  const [showModal, setShowModal] = useState(false);
  const [horizon, setHorizon] = useState(12);
  const [currency, setCurrency] = useState("USD");
  const [businessName, setBusinessName] = useState("");
  const [toast, setToast] = useState(null);
  const [costCutSlider, setCostCutSlider] = useState(10);
  const [goalInput, setGoalInput] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("margin");
  const [goalResult, setGoalResult] = useState(null);
  const [businessMemory, setBusinessMemory] = useState(null);
  const [showWhy, setShowWhy] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const reportRef = useRef();
  const yearRef = useRef();

  const glassCard = isDarkMode? "bg-gray-800 border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";
  const glassCardSoft = isDarkMode? "bg-gray-800/80 border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    fetch(`${API_BASE_URL}/entries`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => { if (Array.isArray(d)) setTransactions(d); }).catch(() => {});
    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => { setCurrency(d.currency || "USD"); setBusinessName(d.business_name || ""); }).catch(() => {});
    fetch(`${API_BASE_URL}/business-memory`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => { if (d &&!d.error) setBusinessMemory(d); }).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const g = params.get("goal") || localStorage.getItem("coach_goal");
    if (g) {
      const found = GOAL_OPTIONS.find(x => x.id === g);
      if (found) { setSelectedGoal(found.id); setGoalInput(found.question); }
      localStorage.removeItem("coach_goal");
    }
  }, []);

  const totalRevenue = useMemo(() => transactions.filter(t => t.type?.toLowerCase() === "income").reduce((s, t) => s + Number(t.amount || 0), 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter(t => t.type?.toLowerCase() === "expense").reduce((s, t) => s + Number(t.amount || 0), 0), [transactions]);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;
  const currentCash = netProfit;

  const { monthlyData, sortedMonths } = useMemo(() => {
    const data = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const key = t.date.slice(0, 7);
      if (!data[key]) data[key] = { income: 0, expense: 0 };
      if (t.type?.toLowerCase() === "income") data[key].income += Number(t.amount || 0);
      else data[key].expense += Number(t.amount || 0);
    });
    return { monthlyData: data, sortedMonths: Object.keys(data).sort() };
  }, [transactions]);

  const realMonthsCount = sortedMonths.length || businessMemory?.total_months || 0;
  const avgMonthlyRevenue = businessMemory?.total_income? businessMemory.total_income / Math.max(businessMemory.total_months, 1) : totalRevenue / Math.max(realMonthsCount, 1);
  const avgMonthlyExpense = businessMemory?.total_expense? businessMemory.total_expense / Math.max(businessMemory.total_months, 1) : totalExpenses / Math.max(realMonthsCount, 1);

  const expenseByCategory = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => { map[t.category || "Other"] = (map[t.category || "Other"] || 0) + Number(t.amount || 0); });
    if (Object.keys(map).length === 0 && businessMemory?.spending_pattern) return businessMemory.spending_pattern;
    return map;
  }, [transactions, businessMemory]);

  const sortedExpenses = useMemo(() => Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]), [expenseByCategory]);
  const topExpense = useMemo(() => sortedExpenses[0] || [businessMemory?.top_expense_category || "costs", businessMemory?.top_expense_amount || 0], [sortedExpenses, businessMemory]);
  const secondExpense = useMemo(() => sortedExpenses[1] || ["other costs", 1], [sortedExpenses]);

  const busiestDay = businessMemory?.busiest_day || "your best day";
  const weakestDay = businessMemory?.weakest_day || "your slowest day";
  const busiestDayAvg = businessMemory?.busiest_day_avg?? businessMemory?.busiest_day_income?? 0;
  const weakestDayAvg = businessMemory?.weakest_day_avg?? businessMemory?.weakest_day_income?? 0;
  const namePart = businessName || businessMemory?.business_name || "";
  const avgDailyIncome = businessMemory?.avg_daily_income || avgMonthlyRevenue / 30;

  const scenarios = {
    Optimistic: { revenueChange: 10, expenseChange: 3, label: "market good" },
    Realistic: { revenueChange: 5, expenseChange: 2, label: "as business is now" },
    Pessimistic: { revenueChange: 2, expenseChange: 5, label: "market bad" }
  };
  const scenario = scenarios[activeScenario];

  const scenarioAvgRevenue = avgMonthlyRevenue * (1 + scenario.revenueChange / 100);
  const scenarioAvgExpense = avgMonthlyExpense * (1 + scenario.expenseChange / 100);
  const scenarioMonthlyCash = scenarioAvgRevenue - scenarioAvgExpense;
  const scenarioCashLastsMonths = scenarioAvgExpense > 0? currentCash / scenarioAvgExpense : 99;
  const scenarioCashText = currentCash <= 0? "No cash left" : scenarioCashLastsMonths > 99? "Many months" : `${scenarioCashLastsMonths.toFixed(1)} Months`;
  const scenarioKeepPercent = scenarioAvgRevenue > 0? (scenarioMonthlyCash / scenarioAvgRevenue) * 100 : 0;

  const realCashData = useMemo(() => {
    const last3 = sortedMonths.slice(-3);
    if (last3.length === 0 &&!businessMemory) return { avg: 0, text: "No data yet", months: 0 };
    const avg = last3.length? last3.reduce((s, k) => s + (monthlyData[k]?.expense || 0), 0) / last3.length : avgMonthlyExpense;
    if (currentCash <= 0) return { avg, text: "No cash left", months: 0 };
    if (avg === 0) return { avg, text: "Many months", months: 99 };
    return { avg, text: `${(currentCash / avg).toFixed(1)} Months`, months: currentCash / avg };
  }, [sortedMonths, monthlyData, currentCash, businessMemory, avgMonthlyExpense]);

  const monthsAhead = useMemo(() => Array.from({ length: horizon }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() + i + 1); return d.toLocaleString("default", { month: "short", year: "numeric" }); }), [horizon]);

  const projectedRevenue = useMemo(() => monthsAhead.map((_, i) => avgMonthlyRevenue * Math.pow(1 + scenario.revenueChange / 100, i + 1)), [monthsAhead, avgMonthlyRevenue, scenario.revenueChange]);
  const projectedExpenses = useMemo(() => monthsAhead.map((_, i) => avgMonthlyExpense * Math.pow(1 + scenario.expenseChange / 100, i + 1)), [monthsAhead, avgMonthlyExpense, scenario.expenseChange]);
  const projectedProfit = useMemo(() => projectedRevenue.map((rev, i) => rev - projectedExpenses[i]), [projectedRevenue, projectedExpenses]);
  const cumulativeCash = useMemo(() => projectedProfit.reduce((acc, profit, i) => { const prev = i === 0? currentCash : acc[i - 1]; acc.push(prev + profit); return acc; }, []), [projectedProfit, currentCash]);

  const cutAmount = (topExpense?.[1] || 0) * (costCutSlider / 100);
  const scenarioNewCashLasts = useMemo(() => { const sim = Math.max(scenarioAvgExpense - cutAmount, 0); if (currentCash <= 0) return 0; if (sim === 0) return 999; return currentCash / sim; }, [scenarioAvgExpense, cutAmount, currentCash]);

  const runOutMonthIndex = cumulativeCash.findIndex(c => c <= 0);
  const runOutMonth = useMemo(() => {
    if (currentCash <= 0) return "Now - cash finished";
    if (scenarioCashLastsMonths <= horizon) {
      const idx = Math.max(0, Math.ceil(scenarioCashLastsMonths) - 1);
      return monthsAhead[idx] || `${scenarioCashText}`;
    }
    return runOutMonthIndex!== -1? monthsAhead[runOutMonthIndex] : `Not in next ${horizon} months`;
  }, [currentCash, scenarioCashLastsMonths, horizon, monthsAhead, scenarioCashText, runOutMonthIndex]);

  const howStrong = Math.max(0, Math.min(100, Math.round((profitMargin / 60) * 100)));

  const realTopCat = topExpense?.[0] || businessMemory?.top_expense_category || "costs";
  const realTopAmt = topExpense?.[1] || businessMemory?.top_expense_amount || 0;
  const strategyA_Monthly = realTopAmt * 0.1;
  const strategyA_Yearly = strategyA_Monthly * 12;
  const strategyB_Monthly = scenarioAvgRevenue * 0.15;
  const strategyB_Yearly = strategyB_Monthly * 12;
  const strategyC_Monthly = strategyA_Monthly + strategyB_Monthly;
  const strategyC_Yearly = strategyC_Monthly * 12;
  const confidenceBase = Math.min(94, Math.max(35, 55 + realMonthsCount * 6 + (profitMargin > 0? 8 : 0)));
  const strategyA_Confidence = Math.min(94, confidenceBase + 5);
  const strategyB_Confidence = Math.min(94, confidenceBase - 8);
  const strategyC_Confidence = Math.min(94, confidenceBase + 12);
  const impactRatio = (secondExpense?.[1] || 0) > 0? (realTopAmt / secondExpense[1]).toFixed(1) : "0";

  const yearReview = useMemo(() => {
    const monthsToUse = sortedMonths.length? sortedMonths : businessMemory?.sorted_months || [];
    if (monthsToUse.length === 0) return null;
    const yearMap = {};
    monthsToUse.forEach(k => {
      const year = k.split("-")[0];
      if (!yearMap[year]) yearMap[year] = [];
      const data = monthlyData[k] || { income: 0, expense: 0 };
      yearMap[year].push({ month: k,...data, profit: (data.income || 0) - (data.expense || 0) });
    });
    const years = Object.keys(yearMap).sort();
    const currentYear = years[years.length - 1];
    const monthsInYear = yearMap[currentYear] || [];
    const totalYearIncome = monthsInYear.reduce((s, m) => s + (m.income || 0), 0);
    const totalYearExpense = monthsInYear.reduce((s, m) => s + (m.expense || 0), 0);
    const totalYearProfit = totalYearIncome - totalYearExpense;
    const bestMonth = [...monthsInYear].sort((a, b) => b.profit - a.profit)[0];
    const worstMonth = [...monthsInYear].sort((a, b) => a.profit - b.profit)[0];
    const all12 = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const key = `${currentYear}-${mm}`;
      const found = monthlyData[key];
      all12.push({ label: new Date(`${currentYear}-${mm}-01`).toLocaleString("default", { month: "short" }), key, income: found?.income || 0, expense: found?.expense || 0, profit: found? (found.income || 0) - (found.expense || 0) : 0, hasData:!!found });
    }
    return { year: currentYear, totalYearIncome, totalYearExpense, totalYearProfit, bestMonth, worstMonth, all12 };
  }, [sortedMonths, monthlyData, businessMemory]);

  const handleGoalCalc = useCallback(async (forcedGoal) => {
    const goalType = forcedGoal || selectedGoal;
    setIsBuilding(true);
    setToast("Building your plan...");
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/goal-plan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ goal: goalInput, goal_type: goalType, horizon }) });
    } catch {}
    const realTotalExp = businessMemory?.total_expense || totalExpenses;
    const realAvgBurn = realCashData.avg || avgMonthlyExpense;
    let whatsNeededText = ""; let moneyNeeded = 0; let moneySave = 0; let difficulty = "Medium"; let probability = confidenceBase;
    if (goalType === "profit") {
      whatsNeededText = `Reduce ${realTopCat} by 10% and focus more sales on ${busiestDay}. You earn ${formatAmount(busiestDayAvg, currency)} on ${busiestDay} on average. If you do nothing, ${realTopCat} keeps eating ${formatAmount(realTopAmt * 12, currency)} per year.`;
      moneyNeeded = 0; moneySave = realTopAmt * 0.1;
    } else if (goalType === "costs") {
      const pct = businessMemory?.top_expense_percent || (realTopAmt / Math.max(realTotalExp, 1) * 100);
      whatsNeededText = `Reduce ${realTopCat} by 20%. It is ${pct.toFixed(0)}% of your spending (${formatAmount(realTopAmt, currency)}). If you do nothing, you lose ${formatAmount(realTopAmt * 0.2 * 12, currency)} every year.`;
      moneyNeeded = 0; moneySave = realTopAmt * 0.2; difficulty = "Easy"; probability += 10;
    } else if (goalType === "hire") {
      const staffCost = Math.round(realAvgBurn * 0.6) || Math.round(avgDailyIncome * 20);
      const newHire = realAvgBurn > 0? currentCash / (realAvgBurn + staffCost) : 0;
      const canHire = netProfit > staffCost;
      whatsNeededText = canHire? `Hiring now cuts your cash from ${realCashData.text} to ${newHire.toFixed(1)} months. Salary ${formatAmount(staffCost, currency)} leaves ${formatAmount(netProfit - staffCost, currency)}. Safe to hire but watch cash.` : `If you hire now, cash runs out faster: from ${realCashData.text} to ${newHire.toFixed(1)} months. You need ${formatAmount(staffCost, currency)} for salary. Not recommended until you make ${formatAmount(staffCost + 10000, currency)} extra per month.`;
      moneyNeeded = staffCost; moneySave = canHire? netProfit - staffCost : 0; probability = canHire? 75 : 35; difficulty = canHire? "Easy" : "High";
    } else if (goalType === "branch") {
      const branchCost = realTotalExp * 3; const canBranch = currentCash > branchCost; const newBranch = realAvgBurn > 0? currentCash / (realAvgBurn + branchCost / 6) : 0;
      whatsNeededText = canBranch? `You have ${formatAmount(currentCash, currency)} and need ${formatAmount(branchCost, currency)} for another shop. If you open now, cash lasts ${newBranch.toFixed(1)} months instead of ${realCashData.text}.` : `You cannot afford another shop yet. You need ${formatAmount(branchCost, currency)}. If you open now, you run out in ${newBranch.toFixed(1)} months. Save for ${Math.ceil(branchCost / Math.max(netProfit, 1))} months.`;
      moneyNeeded = branchCost; moneySave = canBranch? realTotalExp * 0.1 : 0; probability = canBranch? 68 : 30; difficulty = canBranch? "Medium" : "High";
    } else if (goalType === "equipment") {
      const equipCost = Math.round(realTopAmt * 1.2) || Math.round(avgMonthlyExpense * 2); const newEquip = realAvgBurn > 0? currentCash / (realAvgBurn + equipCost / 6) : 0;
      whatsNeededText = `Equipment costs ${formatAmount(equipCost, currency)}. If you buy now, cash goes from ${realCashData.text} to ${newEquip.toFixed(1)} months. It will cut your ${realTopCat} spending later.`;
      moneyNeeded = equipCost; moneySave = equipCost * 0.3; probability = 70;
    } else if (goalType === "cashflow") {
      whatsNeededText = `Focus sales on ${busiestDay}. You make ${formatAmount(busiestDayAvg, currency)} on ${busiestDay} vs ${formatAmount(weakestDayAvg, currency)} on ${weakestDay}. If you do nothing, ${weakestDay} stays slow and you lose ${formatAmount((busiestDayAvg - weakestDayAvg) * 4, currency)} per month.`;
      moneyNeeded = 0; moneySave = (busiestDayAvg - weakestDayAvg);
    } else if (goalType === "margin") {
      if (profitMargin >= 20) whatsNeededText = `Good job. You keep ${profitMargin.toFixed(0)}% of every ${formatAmount(100, currency)} you sell. Your target was 20%. If you do nothing, you stay safe at ${profitMargin.toFixed(0)}%.`;
      else whatsNeededText = `You keep ${profitMargin.toFixed(0)}% of every ${formatAmount(100, currency)} you sell. To reach 20%, cut ${realTopCat} by 10% to save ${formatAmount(realTopAmt * 0.1, currency)} per month. If you do nothing, you keep losing that ${formatAmount(realTopAmt * 0.1 * 12, currency)} per year.`;
      moneyNeeded = 0; moneySave = realTopAmt * 0.1;
    } else if (goalType === "custom") {
      const nums = goalInput.match(/\d+/g); let customCost = nums? parseInt(nums[0]) * (avgDailyIncome || 1000) : realTotalExp * 1.5;
      const newCustom = realAvgBurn > 0? currentCash / (realAvgBurn + customCost / 6) : 0;
      whatsNeededText = `"${goalInput}" costs about ${formatAmount(customCost, currency)}. You have ${formatAmount(currentCash, currency)} now. If you start now, cash lasts ${newCustom.toFixed(1)} months vs ${realCashData.text}. ${currentCash >= customCost? "You can start now." : `Save for ${Math.ceil(customCost / Math.max(avgMonthlyRevenue, 1))} months.`}`;
      moneyNeeded = customCost; moneySave = currentCash >= customCost? currentCash - customCost : 0; difficulty = currentCash >= customCost? "Easy" : "Medium"; probability = currentCash >= customCost? 80 : 50;
    }
    probability = Math.min(94, Math.max(35, probability));
    setGoalResult({ whatsNeededText, targetRevenue: moneyNeeded, moneySave, probability, difficulty, horizon, gap: moneyNeeded, memoryNote: `Best day: ${busiestDay} ${formatAmount(busiestDayAvg, currency)} average. Slowest: ${weakestDay} ${formatAmount(weakestDayAvg, currency)} average. Based on ${realMonthsCount} months of sales.` });
    setIsBuilding(false); setToast("Plan built!"); setTimeout(() => setToast(null), 2000);
  }, [netProfit, totalExpenses, currency, horizon, goalInput, selectedGoal, realMonthsCount, currentCash, busiestDay, weakestDay, profitMargin, avgMonthlyRevenue, businessMemory, avgMonthlyExpense, avgDailyIncome, realCashData, busiestDayAvg, weakestDayAvg, realTopCat, realTopAmt, confidenceBase]);

  useEffect(() => { if (totalRevenue > 0 || totalExpenses > 0) { handleGoalCalc(); } }, [totalRevenue, totalExpenses, handleGoalCalc]);

  const chartTextColor = isDarkMode? "#F9FAFB" : "#111827";
  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 800 }, plugins: { legend: { labels: { font: { size: 14, weight: "bold" }, color: chartTextColor, padding: 16 } }, tooltip: { backgroundColor: isDarkMode? "#1F2937" : "#fff", titleColor: chartTextColor, bodyColor: chartTextColor } }, scales: { x: { ticks: { color: chartTextColor, font: { size: 12, weight: "bold" } }, grid: { color: isDarkMode? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" } }, y: { ticks: { color: chartTextColor, font: { size: 12, weight: "bold" } }, grid: { color: isDarkMode? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" } } } };

  const exportCSV = () => {
    const rows = [["Month", "Money You Make", "Money You Spend", "Money You Keep"]];
    monthsAhead.forEach((m, i) => { rows.push([m, projectedRevenue[i], projectedExpenses[i], projectedProfit[i]]); });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = "business-coach.csv"; link.click();
    setToast("CSV exported"); setTimeout(() => setToast(null), 3000);
  };

  const exportPDF = async () => {
    const element = reportRef.current; if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: isDarkMode? "#111827" : "#ffffff" });
    const imgData = canvas.toDataURL("image/png"); const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight); pdf.save(`Business-Coach-${horizon}M.pdf`);
    setToast("PDF exported"); setTimeout(() => setToast(null), 3000);
  };

  return (
    <div ref={reportRef} className={isDarkMode? "bg-gray-900 text-white min-h-screen p-4 md:p-6" : "bg-[#fbfaf8] min-h-screen p-4 md:p-6 text-gray-900"}>
      <h1 className="text-4xl font-black">Business Coach {namePart? `— ${namePart}` : ""}</h1>
      <div className={glassCard + " rounded-[16px] p-4 mt-3 flex flex-wrap gap-4 text-xs font-black"}>
        <span>When cash finishes: {runOutMonth}</span>
        <span>• Business strength: {howStrong}/100</span>
        <span>• Cash lasts: {scenarioCashText}</span>
        <span>• You keep: {profitMargin.toFixed(0)}% of every {formatAmount(100, currency)}</span>
        <span>• Plan: {horizon} months — {scenario.label}</span>
      </div>
      <p className="text-xs opacity-60 mt-2 font-bold">{realMonthsCount} months • You made {formatAmount(totalRevenue, currency)} • Spent {formatAmount(totalExpenses, currency)} • You keep {formatAmount(netProfit, currency)}</p>

      <div className="bg-red-600 text-white rounded-[20px] p-5 mt-4 mb-6 border-2 border-gray-900 shadow-xl">
        <h2 className="text-xs font-black uppercase tracking-widest">⚠️ If you do nothing</h2>
        <p className="text-sm font-bold mt-2">{scenarioCashLastsMonths <= 0? `Cash is finished now.` : `Cash runs out in ${scenarioCashText}.`} {realTopCat} stays at {totalExpenses > 0? ((realTopAmt) / totalExpenses * 100).toFixed(0) : 0}% of spending. {weakestDay} sales stay low. You lose about {formatAmount(realTopAmt * 0.2 * 12, currency)} per year if {realTopCat} stays high.</p>
        <p className="text-xs font-bold mt-2 opacity-90">You make {formatAmount(scenarioAvgRevenue, currency)} per month, you spend {formatAmount(scenarioAvgExpense, currency)} per month. Action needed this week: Cut {realTopCat} by 10% = save {formatAmount(strategyA_Monthly, currency)} per month.</p>
      </div>

      <div className={glassCard + " rounded-[20px] p-6 shadow-xl mb-6"}>
        <h2 className="text-sm font-black uppercase tracking-widest">AI Boardroom — Ask anything</h2>
        <p className="text-xs opacity-60 mt-1">Your best day is {busiestDay} {busiestDayAvg>0? `(${formatAmount(busiestDayAvg, currency)} average)` : "(no data yet)"} • Slowest is {weakestDay} {weakestDayAvg>0? `(${formatAmount(weakestDayAvg, currency)} average)` : "(no data yet)"}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {["Can I hire someone?", `Why is ${realTopCat} so high?`, `Should I focus on ${busiestDay}?`, "What if I give 10% discount?", "How to make more?"].map(q => (
            <button key={q} onClick={() => setGoalInput(q)} className={isDarkMode? "px-4 py-2 bg-gray-700 border border-white/10 rounded-full text-xs font-black" : "px-4 py-2 bg-yellow-100 border-2 border-gray-900 rounded-full text-xs font-black"}>{q}</button>
          ))}
        </div>
        <div className="mt-4"><AskMyBusiness context="forecast" transactions={transactions} totalRevenue={totalRevenue} totalExpenses={totalExpenses} topExpense={topExpense} horizon={horizon} currency={currency} realRunway={scenarioCashText} profitMargin={profitMargin} businessMemory={businessMemory} isDarkMode={isDarkMode} /></div>
      </div>

      {businessMemory && (
        <div className={glassCard + " rounded-[20px] p-5 shadow-xl mb-6"}>
          <h2 className="text-xs font-black uppercase tracking-widest">What I know about your business</h2>
          <p className="text-sm font-bold mt-3">Busiest day: {busiestDay} {busiestDayAvg>0? `(${formatAmount(busiestDayAvg, currency)} average)` : ""} • Slowest day: {weakestDay} {weakestDayAvg>0? `(${formatAmount(weakestDayAvg, currency)} average)` : ""} • Top product: {businessMemory.top_income_category || "Sales"} • Daily average: {formatAmount(avgDailyIncome, currency)}</p>
        </div>
      )}

      <div className={glassCard + " rounded-[20px] p-6 shadow-xl mb-6"}>
        <h2 className="text-sm font-black uppercase tracking-widest">What do you want to achieve?</h2>
        <div className="flex flex-wrap gap-2 mt-4">
          {GOAL_OPTIONS.map(g => (
            <button key={g.id} onClick={() => { setSelectedGoal(g.id); setGoalInput(g.question); setTimeout(() => handleGoalCalc(g.id), 100); }} className={`px-4 py-2 rounded-full text-xs font-black border-2 ${selectedGoal === g.id? "bg-gray-900 text-white border-gray-900" : isDarkMode? "bg-gray-800 border-white/20 text-white" : "bg-white border-gray-200"}`}>{g.label}</button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <input value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder={`Ask about ${realTopCat || "your business"}...`} className={isDarkMode? "flex-1 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold bg-gray-700 text-white" : "flex-1 border-2 border-gray-900 rounded-xl px-4 py-3 text-sm font-bold"} />
          <button onClick={() => handleGoalCalc()} disabled={isBuilding} className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-black">{isBuilding? "Building..." : "Build My Plan"}</button>
        </div>
        {goalResult && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
            <div className={isDarkMode? "bg-gray-700 border border-white/10 p-4 rounded-xl" : "bg-[#fef08a] border-2 border-gray-900 p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">What needs to change</p><p className="text-sm font-bold mt-2">{goalResult.whatsNeededText}</p></div>
            <div className={glassCardSoft + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Money needed</p><p className="text-sm font-black mt-2">{goalResult.targetRevenue === 0? `No extra money needed. You save ${formatAmount(goalResult.moneySave, currency)} per month` : formatAmount(goalResult.targetRevenue, currency)}</p></div>
            <div className={glassCardSoft + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Effort needed</p><p className="text-sm font-black mt-2">{goalResult.difficulty}</p><p className="text-xs mt-1">{goalResult.horizon} months plan</p></div>
            <div className="bg-green-600 text-white p-4 rounded-xl border-2 border-gray-900"><p className="text-xs uppercase">Confidence</p><p className="text-lg font-black mt-1">{goalResult.probability}%</p><p className="text-xs mt-1">{goalResult.memoryNote}</p></div>
          </div>
        )}
      </div>

      <div className="bg-gray-900 text-white rounded-[24px] p-6 md:p-8 shadow-2xl mb-6 border-4 border-yellow-300">
        <div className="flex justify-between items-center"><h2 className="text-xs font-black uppercase tracking-widest text-yellow-300">AI Strategy Lab — Choose your plan</h2><button onClick={() => setShowWhy(!showWhy)} className="text-xs bg-white text-gray-900 px-3 py-1 rounded-full font-black">{showWhy? "Hide details" : "Show why"}</button></div>
        <p className="text-xl font-black mt-2">{namePart? `${namePart}, ` : ""}How do you reach profit fastest?</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white text-gray-900 p-5 rounded-2xl border-2 border-gray-900">
            <p className="text-xs font-black uppercase opacity-60">Plan A — Reduce {realTopCat}</p>
            <p className="text-sm font-black mt-2">Cut {realTopCat} by 10%</p>
            <p className="text-xs mt-2">Result: +{formatAmount(strategyA_Yearly, currency)} per year</p>
            <p className="text-xs mt-1">You keep: {scenarioKeepPercent.toFixed(0)}% → {(scenarioKeepPercent + 3).toFixed(0)}%</p>
            <p className="text-xs mt-1">Confidence: {strategyA_Confidence}%</p>
          </div>
          <div className="bg-white text-gray-900 p-5 rounded-2xl border-2 border-gray-900">
            <p className="text-xs font-black uppercase opacity-60">Plan B — Increase sales</p>
            <p className="text-sm font-black mt-2">Focus more on {busiestDay} — 15% more</p>
            <p className="text-xs mt-2">Result: +{formatAmount(strategyB_Yearly, currency)} per year</p>
            <p className="text-xs mt-1">You keep: {scenarioKeepPercent.toFixed(0)}% → {(scenarioKeepPercent + 5).toFixed(0)}%</p>
            <p className="text-xs mt-1">Confidence: {strategyB_Confidence}%</p>
            <p className="text-xs mt-1 font-bold">{busiestDayAvg>0? `${busiestDay} ${formatAmount(busiestDayAvg, currency)} vs ${weakestDay} ${formatAmount(weakestDayAvg, currency)}` : "Based on your sales days"}</p>
          </div>
          <div className="bg-[#fef08a] text-gray-900 p-6 rounded-2xl border-4 border-gray-900 shadow-xl scale-[1.02]">
            <p className="text-xs font-black uppercase">⭐ Recommended by AI — Plan C Combined</p>
            <p className="text-lg font-black mt-2">Reduce {realTopCat} 10% + Increase sales 15%</p>
            <p className="text-sm font-black mt-2">Result: +{formatAmount(strategyC_Yearly, currency)} per year</p>
            <p className="text-xs mt-2">Break-even: {scenarioCashLastsMonths > 3? "3 months" : "2 months"}</p>
            <p className="text-xs mt-1">Confidence: {strategyC_Confidence}% — Best balance</p>
            <p className="text-xs mt-2 font-bold">After plan: cash lasts {(scenarioNewCashLasts > 100? "Many months" : scenarioNewCashLasts.toFixed(1) + " months")} — that is {(scenarioNewCashLasts - scenarioCashLastsMonths).toFixed(1)} months longer</p>
          </div>
        </div>

        {showWhy && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 border border-white/20 p-5 rounded-xl">
                <h3 className="text-xs font-black uppercase text-green-300">Strategy Ranking — Top wins</h3>
                <ul className="text-sm font-bold mt-3 space-y-2">
                  <li>#1 Combined — Success {strategyC_Confidence}% — Impact {formatAmount(strategyC_Yearly, currency)}/year</li>
                  <li>#2 Sales Growth — Success {strategyB_Confidence}% — Impact {formatAmount(strategyB_Yearly, currency)}/year</li>
                  <li>#3 Cost Cut — Success {strategyA_Confidence}% — Impact {formatAmount(strategyA_Yearly, currency)}/year</li>
                </ul>
              </div>
              <div className="bg-white/10 border border-white/20 p-5 rounded-xl">
                <h3 className="text-xs font-black uppercase text-yellow-300">Negotiation Playbook</h3>
                <ul className="text-sm font-bold mt-3 space-y-1">
                  <li>{realTopCat} currently costs: {formatAmount(realTopAmt, currency)}</li>
                  <li>Target cost: {formatAmount(realTopAmt * 0.85, currency)}</li>
                  <li>Suggested range: 10-15%</li>
                  <li>Expected yearly saving: {formatAmount(strategyA_Yearly, currency)} - {formatAmount(realTopAmt * 0.15 * 12, currency)}</li>
                  <li className="text-yellow-200">Do NOT cut sales first. Cut {realTopCat} first — it creates {impactRatio}x more impact than {secondExpense[0]}.</li>
                </ul>
              </div>
              <div className="bg-white/10 border border-white/20 p-5 rounded-xl">
                <h3 className="text-xs font-black uppercase text-white">Executive Outcome — If you execute Plan C</h3>
                <ul className="text-sm font-bold mt-3 space-y-1">
                  <li>You keep: {profitMargin.toFixed(0)}% → {(profitMargin + 8).toFixed(0)}% of every {formatAmount(100, currency)}</li>
                  <li>Profit: {formatAmount(scenarioMonthlyCash + strategyC_Monthly, currency)} per month</li>
                  <li>Strength: {howStrong} → {Math.min(100, howStrong + 15)}/100</li>
                  <li>Confidence: {strategyC_Confidence}%</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 bg-white text-gray-900 p-5 rounded-xl">
              <h3 className="text-xs font-black uppercase">Profitability Roadmap — Milestones</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-xs font-black">
                <div><p className="opacity-60">Month 1</p><p>Reduce {realTopCat} 10%</p></div>
                <div><p className="opacity-60">Month 2</p><p>Sales +10% on {busiestDay}</p></div>
                <div><p className="opacity-60">Month 3</p><p>Break-even reached — Cash lasts longer</p></div>
                <div><p className="opacity-60">Month 6</p><p>Strength {">"}60/100</p></div>
                <div><p className="opacity-60">Month 12</p><p>Target 20% from 100 achieved</p></div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {["Optimistic", "Realistic", "Pessimistic"].map(s => (<button key={s} onClick={() => setScenario(s)} className={`px-4 py-2 rounded-full font-black text-xs ${activeScenario === s? "bg-gray-900 text-white" : glassCard}`}>{s}</button>))}
        <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} className={isDarkMode? "border border-white/20 p-2 rounded-full font-black bg-gray-800 text-white text-xs" : "border-2 border-gray-900 p-2 rounded-full font-black bg-white text-xs"}><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select>
        <button onClick={exportCSV} className={glassCard + " px-4 py-2 rounded-full font-black text-xs"}>Export CSV</button>
        <button onClick={exportPDF} className="bg-gray-900 text-white px-4 py-2 rounded-full font-black text-xs">Export PDF</button>
        <button onClick={() => setShowModal(true)} className="bg-yellow-300 border-2 border-gray-900 px-4 py-2 rounded-full font-black text-xs text-gray-900">Action Plan</button>
      </div>

      <div className={glassCard + " p-5 rounded-2xl shadow-xl mb-6"}>
        <h3 className="font-black text-sm">What if you cut {realTopCat} ({formatAmount(realTopAmt, currency)}) by {costCutSlider}%?</h3>
        <input type="range" min="0" max="30" value={costCutSlider} onChange={e => setCostCutSlider(Number(e.target.value))} className="w-full mt-3" />
        <p className="text-sm font-bold mt-2">Save {formatAmount(cutAmount, currency)} per month → Cash lasts {scenarioCashText} → {(scenarioNewCashLasts > 100? "Many months" : scenarioNewCashLasts.toFixed(1) + " months")} after cut</p>
      </div>

      <div className={glassCard + " p-5 rounded-2xl shadow-xl"}>
        <div className="flex gap-2 mb-5 flex-wrap">
          {["trend", "cashflow", "where-money-goes", "compare", "year"].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-full font-black text-xs ${activeTab === tab? "bg-gray-900 text-white" : isDarkMode? "bg-gray-700 border border-white/10 text-white" : "bg-gray-100 border-2 border-gray-900"}`}>{tab === "trend"? "Money you make" : tab === "cashflow"? "Your cash" : tab === "where-money-goes"? "Where money goes" : tab === "compare"? "Compare" : "Year Review"}</button>))}
        </div>
        {activeTab === "trend" && (<div style={{ height: "360px" }}><Line options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "You Make", data: projectedRevenue, borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.2)", fill: true }, { label: "You Spend", data: projectedExpenses, borderColor: "#F43F5E", backgroundColor: "rgba(244,63,94,0.2)", fill: true }, { label: "You Keep", data: projectedProfit, borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.2)", fill: true }] }} /></div>)}
        {activeTab === "cashflow" && (<div style={{ height: "360px" }}><Line options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "Your Cash", data: cumulativeCash, borderColor: "#14B8A6", backgroundColor: "rgba(20,184,166,0.2)", fill: true }] }} /></div>)}
        {activeTab === "where-money-goes" && (<div style={{ height: "360px" }}><Bar options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "You Spend", data: projectedExpenses, backgroundColor: "#F43F5E" }, { label: "You Keep", data: projectedProfit, backgroundColor: "#10B981" }] }} /></div>)}
        {activeTab === "compare" && (<div style={{ height: "360px" }}><Line options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "Best", data: monthsAhead.map((_, i) => currentCash + (avgMonthlyRevenue * 1.10 - avgMonthlyExpense * 1.03) * (i + 1)), borderColor: "#10B981" }, { label: "Average", data: cumulativeCash, borderColor: "#14B8A6" }, { label: "Worst", data: monthsAhead.map((_, i) => currentCash + (avgMonthlyRevenue * 1.02 - avgMonthlyExpense * 1.05) * (i + 1)), borderColor: "#F43F5E" }] }} /></div>)}
        {activeTab === "year" && yearReview && (
          <div ref={yearRef} className={isDarkMode? "bg-gray-900 border border-white/10 rounded-xl p-5" : "bg-white border-2 border-gray-900 rounded-xl p-5"}>
            <h3 className="text-xl font-black">Year {yearReview.year} {namePart? `— ${namePart}` : ""}</h3>
            <p className="text-xs opacity-60 mt-1">Best month: {yearReview.bestMonth?.month} ({formatAmount(yearReview.bestMonth?.profit, currency)}) • Slowest month: {yearReview.worstMonth?.month} ({formatAmount(yearReview.worstMonth?.profit, currency)})</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Made this year</p><p className="text-sm font-black mt-1">{formatAmount(yearReview.totalYearIncome, currency)}</p></div>
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Spent this year</p><p className="text-sm font-black mt-1">{formatAmount(yearReview.totalYearExpense, currency)}</p></div>
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">You kept</p><p className="text-sm font-black mt-1">{formatAmount(yearReview.totalYearProfit, currency)}</p></div>
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Growth</p><p className="text-sm font-black mt-1">{businessMemory?.growth_text || "No growth data yet"}</p></div>
            </div>
            <div className="mt-6" style={{ height: "300px" }}><Bar options={chartOptions} data={{ labels: yearReview.all12.map(m => m.label), datasets: [{ label: "You Make", data: yearReview.all12.map(m => m.income), backgroundColor: "#10B981" }, { label: "You Spend", data: yearReview.all12.map(m => m.expense), backgroundColor: "#F43F5E" }] }} /></div>
          </div>
        )}
        {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl text-xs font-black shadow-2xl z-50">{toast}</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className={glassCard + " p-6 rounded-2xl max-w-md w-full"}><h3 className="font-black">Action Plan — {horizon} months</h3><p className="text-sm mt-2">Cut {realTopCat} by 10% to save {formatAmount(cutAmount, currency)} per month • Cash lasts {scenarioCashText}</p><div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowModal(false)} className="bg-gray-200 px-4 py-2 rounded-full font-bold text-xs border-2 border-gray-900">Close</button><a href="/alerts" className="bg-gray-900 text-white px-4 py-2 rounded-full font-bold text-xs">Go to Alerts</a></div></div>
        </div>
      )}
    </div>
  );
}
export default Forecast;