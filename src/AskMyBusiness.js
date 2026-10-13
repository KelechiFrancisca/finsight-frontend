import { useState, useMemo, useCallback } from "react";
import API_BASE_URL from "./apiConfig";

export default function AskMyBusiness({
  transactions = [],
  totalRevenue = 0,
  totalExpenses = 0,
  topExpense = null,
  horizon = 12,
  currency = "NGN",
  realRunway = "N/A",
  profitMargin = 0,
  businessMemory = null,
  context = "dashboard",
  isDarkMode = false
}) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const sym = ({ USD: "$", EUR: "€", GBP: "£", NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵" }[currency] || "$");

  const page = useMemo(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("alert")) return "alerts";
    if (path.includes("forecast")) return "forecast";
    return context;
  }, [context]);

  const detectLanguage = (text) => {
    const t = text.toLowerCase();
    if (/abeg|dey|no dey|wetin|shebi|una|my shop|customers no dey|how e be/.test(t)) return "pidgin";
    if (/pourquoi|comment|perds|argent|boutique|loyer|gagner|perte/.test(t)) return "fr";
    if (/por qué|por que|ganar|perdiendo|dinero|alquiler|pérdida/.test(t)) return "es";
    if (/kilode|owo|bawo|se lo/.test(t)) return "yo";
    return "en";
  };

  const monthsWithData = useMemo(() => {
    const s = new Set();
    transactions.forEach(t => { if(t.date){ const d = new Date(t.date); if(!isNaN(d.getTime())) s.add(d.toISOString().slice(0,7)); } });
    return s.size || 2;
  }, [transactions]);

  const getBreakdown = useCallback((catName) => {
    if(!catName) return [];
    const cat = catName.toLowerCase().trim();
    const same = transactions.filter(t => t.type?.toLowerCase() === "expense" && (t.category||"").toLowerCase().trim() === cat);
    const map = {};
    same.forEach(t=>{
      const desc = (t.description||"No detail").trim() || "No detail";
      if(!map[desc]) map[desc] = { amount:0, count:0, dates:[] };
      map[desc].amount += Number(t.amount||0);
      map[desc].count += 1;
      if(t.date) map[desc].dates.push(t.date);
    });
    return Object.entries(map).map(([desc,v])=>({desc,...v})).sort((a,b)=>b.amount-a.amount);
  }, [transactions]);

  const topExpenseDesc = useMemo(() => {
    if (!topExpense) return null;
    const breakdown = getBreakdown(topExpense[0]);
    return breakdown[0]?.desc || null;
  }, [topExpense, getBreakdown]);

  const getSmart = useCallback((question) => {
    const lo = question.toLowerCase();
    const lang = detectLanguage(question);
    const cash = totalRevenue - totalExpenses;
    const rent = topExpense?.[1] || 0;
    const rentName = topExpense?.[0] || businessMemory?.top_expense_category || "Utilities";
    const breakdown = getBreakdown(rentName);
    const totalBreakdownAmt = breakdown.reduce((s,b)=>s+b.amount,0) || rent;
    const busy = businessMemory?.busiest_day || "Friday";
    const weak = businessMemory?.weakest_day || "Thursday";
    const busyAmt = businessMemory?.busiest_day_income || businessMemory?.busiest_day_avg || 0;
    const weakAmt = businessMemory?.weakest_day_income || businessMemory?.weakest_day_avg || 0;

    const t = (en, fr, pi) => { if (lang === "fr") return fr; if (lang === "pidgin") return pi || en; return en; };

    const allExpenseCats = [...new Set(transactions.filter(t=>t.type?.toLowerCase()==="expense").map(t=>(t.category||"").trim()).filter(Boolean))];
    let askedCat = rentName;
    for(const c of allExpenseCats){ if(lo.includes(c.toLowerCase())){ askedCat=c; break; } }
    if(lo.includes("utilities")||lo.includes("nepa")||lo.includes("light")) askedCat="Utilities";

    const askedBreakdown = getBreakdown(askedCat);
    const askedTotal = askedBreakdown.reduce((s,b)=>s+b.amount,0) || rent;
    const askedListText = askedBreakdown.length? askedBreakdown.map(b=>`${b.desc} ${sym}${Math.round(b.amount).toLocaleString()}${b.count>1?` (${b.count} times)`:``}`).join(" + ") : `${askedCat} ${sym}${Math.round(askedTotal).toLocaleString()}`;
    const biggest = askedBreakdown[0];
    const pct = totalExpenses>0? (askedTotal/totalExpenses*100).toFixed(0) : "30";

    if (lo.includes("why") || lo.includes("high") || lo.includes("cher") || lo.includes("perd")) {
      return {
        title: t(`Why is ${askedCat} so high?`, `Pourquoi ${askedCat} est si cher?`, `Why ${askedCat} high?`),
        plain: t(
          `${askedCat} is ${sym}${Math.round(askedTotal).toLocaleString()} (${pct}% of your spending) because: ${askedListText}. ${askedBreakdown.length>=2? `You have ${askedBreakdown.length} different ${askedCat.toLowerCase()} payments.` : ``} Biggest is ${biggest?`${biggest.desc} ${sym}${Math.round(biggest.amount).toLocaleString()}${biggest.count>1?` - you paid it ${biggest.count} times`:``}`:`${askedCat}`}. If you cut ${biggest?.desc||askedCat} by 10%, you keep ${sym}${Math.round((biggest?.amount||askedTotal)*0.1).toLocaleString()} more per month.`,
          `${askedCat} coûte ${sym}${Math.round(askedTotal).toLocaleString()} car ${askedListText}.`,
          `${askedCat} na ${sym}${Math.round(askedTotal).toLocaleString()} because ${askedListText}. Na ${biggest?.desc||askedCat} chop most.`
        ),
        action: t(`Cut ${biggest?.desc||askedCat} first. Save ${sym}${Math.round((biggest?.amount||askedTotal)*0.1).toLocaleString()}/mo. Your best day is ${busy} ${busyAmt?`(${sym}${Math.round(busyAmt).toLocaleString()})`:``} - sell more there.`, `Coupe ${biggest?.desc||askedCat}.`, `Cut ${biggest?.desc||askedCat} first.`)
      };
    }
    if (lo.includes("hire") || lo.includes("staff") || lo.includes("worker") || lo.includes("employ")) {
      const cost = currency === "NGN"? 40000 : 500;
      const left = cash - cost;
      const can = cash > cost && cash > 0;
      return {
        title: t(`Can you hire now?`, `Peux-tu embaucher?`, `You fit hire?`),
        plain: t(
          can? `You make ${sym}${Math.round(cash).toLocaleString()} per month. If you hire at ${sym}${cost.toLocaleString()}, you keep ${sym}${Math.round(left).toLocaleString()} left. Cash goes from ${realRunway} to 1-2 months. You can hire part-time on ${busy} only.` : `You ${cash>=0?'make':'lose'} ${sym}${Math.abs(Math.round(cash)).toLocaleString()} per month. If you hire at ${sym}${cost.toLocaleString()}, you keep ${sym}${Math.round(left).toLocaleString()} only - not safe. Fix ${rentName} first: ${breakdown.slice(0,2).map(b=>`${b.desc} ${sym}${Math.round(b.amount).toLocaleString()}`).join(" + ")}. Make ${sym}${Math.round(cost+10000).toLocaleString()} extra, then hire.`,
          can? `Tu gagnes ${sym}${Math.round(cash).toLocaleString()}. Salaire ${sym}${cost.toLocaleString()}.` : `Tu perds de l'argent. Pas maintenant.`,
          can? `You make ${sym}${Math.round(cash).toLocaleString()}. Salary ${sym}${cost.toLocaleString()}.` : `You dey lose. No hire now.`
        ),
        action: t(can? `Hire part-time on ${busy} for 2 weeks test.` : `Don't hire now. Cut ${biggest?.desc||rentName} by 10%.`, `Ne recrute pas.`, `No hire now.`)
      };
    }
    if (lo.includes("discount")) {
      const per100 = 10;
      const loss = Math.round(totalRevenue*0.1);
      return {
        title: t(`What if you give 10% discount?`, `Et si tu donnes 10% de remise?`, `Wetin if you give 10% discount?`),
        plain: t(
          `If you sell ${sym}100 for ${sym}90, you lose ${sym}${per100} per sale. For your current sales ${sym}${Math.round(totalRevenue).toLocaleString()}, you lose extra ${sym}${loss.toLocaleString()} per month. You must sell about 11 more items for every 100 to make same money. Cash lasts ${realRunway} - discount makes it finish faster.`,
          `Si tu vends ${sym}100 pour ${sym}90, tu perds ${sym}10 par vente.`,
          `If you sell ${sym}100 for ${sym}90, you lose ${sym}10 per sale. You go lose ${sym}${loss.toLocaleString()} extra.`
        ),
        action: t(`Don't give 10% now. Give small free gift on ${weak} instead. Focus sales on ${busy}.`, `Ne donne pas 10%.`, `No give 10% now.`)
      };
    }
    return {
      title: t(`Your business today`, `Ton business aujourd'hui`, `How your business be`),
      plain: t(
        `You ${cash>=0?'make':'lose'} ${sym}${Math.abs(Math.round(cash)).toLocaleString()} per month. Biggest cost is ${rentName} ${sym}${Math.round(totalBreakdownAmt).toLocaleString()} because ${breakdown.slice(0,2).map(b=>`${b.desc} ${sym}${Math.round(b.amount).toLocaleString()}`).join(" + ")}. Best day ${busy}${busyAmt?` ${sym}${Math.round(busyAmt).toLocaleString()}`:``}, slow day ${weak}${weakAmt?` ${sym}${Math.round(weakAmt).toLocaleString()}`:``}. You keep ${profitMargin.toFixed(0)}% for every ${sym}100 you sell. ${monthsWithData} months history.`,
        `Tu ${cash>=0?'gagnes':'perds'} ${sym}${Math.abs(Math.round(cash)).toLocaleString()} car ${rentName} ${sym}${Math.round(totalBreakdownAmt).toLocaleString()}.`,
        `You dey ${cash>=0?'make':'lose'} ${sym}${Math.abs(Math.round(cash)).toLocaleString()} because ${rentName} ${sym}${Math.round(totalBreakdownAmt).toLocaleString()}.`
      ),
      action: t(`1) Cut ${breakdown[0]?.desc||rentName} 10% save ${sym}${Math.round((breakdown[0]?.amount||rent)*0.1).toLocaleString()}, 2) Sell more on ${busy}, 3) Promo on ${weak}.`, `Coupe ${rentName} 10%.`, `Cut ${rentName} 10%.`)
    };
  }, [totalRevenue, totalExpenses, topExpense, businessMemory, getBreakdown, sym, realRunway, profitMargin, monthsWithData, transactions, currency]);

  const askAI = async (customQ) => {
    const question = customQ || q;
    if (!question.trim()) return;
    setLoading(true);
    const localAnswer = getSmart(question);
    setAnswer(localAnswer);
    setLoading(false);
    try {
      const token = localStorage.getItem("token");
      const ctx = {
        totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, profitMargin, realRunway, topExpense, topExpenseDesc, breakdown: getBreakdown(topExpense?.[0]), allBreakdowns: [...new Set(transactions.map(t=>t.category))].map(c=>({category:c,breakdown:getBreakdown(c)})), horizon, currency,
        last3Months: transactions.slice(-30),
        businessMemory, page, question, language: detectLanguage(question)
      };
      const res = await fetch(`${API_BASE_URL}/ask-ai`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(ctx) });
      const data = await res.json();
      if (data && data.plain && (data.plain.includes("nepa") || data.plain.includes("Monthly"))) {
        if(data.plain.length>localAnswer.plain.length) setAnswer(data);
      }
    } catch {}
  };

  const cardCls = isDarkMode? "bg-gray-800/70 backdrop-blur-xl border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";
  const inputCls = isDarkMode? "border border-white/20 bg-gray-700/80 text-white placeholder-gray-400" : "border-2 border-gray-900 bg-white text-gray-900 placeholder-gray-500";
  const resultCls = isDarkMode? "bg-gray-900 border border-white/10 text-white" : "bg-gray-900 text-white";

  return (
    <div className={`${cardCls} p-8 rounded-2xl shadow-2xl mb-8`}>
      <h2 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode? "text-indigo-300" : "text-indigo-600"}`}>
        Ask about your business • {monthsWithData} months history {businessMemory?.busiest_day? `• Best day ${businessMemory.busiest_day}` : ""}
      </h2>
      <div className="flex gap-3 mt-5">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Ask anything: Why is my cost high?" className={`flex-1 rounded-xl px-6 py-5 text-[14px] font-bold outline-none ${inputCls}`} />
        <button onClick={() => askAI()} className={`${isDarkMode? "bg-white text-gray-900" : "bg-gray-900 text-white"} px-8 py-5 rounded-xl font-black text-[14px]`}>{loading? "..." : "Ask →"}</button>
      </div>
      <div className="flex gap-2 mt-4 flex-wrap">
        {["Can I hire someone?", `Why is ${topExpense?.[0] || "my cost"} so high?`, `Should I focus on ${businessMemory?.busiest_day || "Friday"}?`, "What if I give 10% discount?", "How to make more profit?"].map(t => (
          <button key={t} onClick={() => { setQ(t); askAI(t); }} className={`${isDarkMode? "bg-white/10 border border-white/20 text-white" : "bg-[#fef08a] border-2 border-gray-900 text-gray-900"} px-3 py-1.5 rounded-full text-[11px] font-black`}>{t}</button>
        ))}
      </div>
      <p className={`mt-4 text-[12px] font-bold ${isDarkMode? "text-gray-400" : "text-gray-500"}`}>Answers show your real Descriptions like nepa, Monthly utilities, house, fuel, bills.</p>
      {answer && (
        <div className={`mt-8 p-7 rounded-2xl ${resultCls}`}>
          <h3 className="text-[16px] font-black">{answer.title}</h3>
          <p className="mt-3 text-[14px] font-bold leading-relaxed whitespace-pre-wrap">{answer.plain}</p>
          <p className="mt-4 text-[14px] font-black text-emerald-300">✅ {answer.action}</p>
        </div>
      )}
    </div>
  );
}