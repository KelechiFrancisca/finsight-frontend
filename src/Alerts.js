import React, { useState, useEffect } from "react";
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
import API_BASE_URL from "./apiConfig";  // ✅ named import

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

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ high: 0, medium: 0, info: 0 });
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
  fetch(`${API_BASE_URL}/alerts`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      if (data && Array.isArray(data.alerts)) {
        const normalized = data.alerts.map((a) => {
          // Compute margin if not provided
          const margin =
            a.margin !== undefined
              ? a.margin
              : a.profit !== undefined && a.revenue !== undefined
              ? (a.profit / a.revenue) * 100
              : undefined;

          // Compute expense ratio if not provided
          const expenseRatio =
            a.expenseRatio !== undefined
              ? a.expenseRatio
              : a.expenses !== undefined && a.income !== undefined
              ? a.expenses / a.income
              : undefined;

          // Cashflow stays as provided
          const cashflow = a.cashflow !== undefined ? a.cashflow : undefined;

          return {
            ...a,
            level: (a.level || "").toLowerCase(),
            margin,
            expenseRatio,
            churnRate: a.churnRate,
            cashflow,
          };
        });

        setAlerts(normalized);
        setCounts(data.counts);
        console.log("Fetched alerts:", normalized);
        console.log("Fetched counts:", data.counts);
      } else {
        setAlerts([]);
        console.log("No alerts returned:", data);
      }
    })
    .catch((err) => console.error("Error fetching alerts:", err));
}, []);


const highPriority = counts.high;
const mediumPriority = counts.medium;
const informational = counts.info;

const exportCSV = () => {
  const rows = [["ID", "Level", "Message", "Why", "Actions"]];
  alerts.forEach((a) =>
    rows.push([
      a.id,
      a.level,
      a.message,
      a.why || "",
      (a.actions || []).join("; ")
    ])
  );
  const csvContent =
    "data:text/csv;charset=utf-8," +
    rows.map((r) => r.join(",")).join("\n");
  const link = document.createElement("a");
  link.href = encodeURI(csvContent);
  link.download = "alerts.csv";
  link.click();
  setToast("📂 Alerts exported successfully!");
  setTimeout(() => setToast(null), 3000);
};

return (
  <div className="bg-gray-100 min-h-screen p-6 text-base md:text-lg font-bold">
    <h1 className="text-2xl font-extrabold mb-6 text-gray-800">Alerts Dashboard</h1>
    <p className="text-gray-600 mb-6 font-bold">
      Stay informed with intelligent alerts about your business finances.
    </p>

    {/* KPI Cards */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  {/* High Priority */}
  <div className="bg-white p-6 rounded-lg shadow-md font-bold">
    <h2 className="text-lg font-bold text-red-600">High Priority</h2>
    <p className="text-3xl font-extrabold">{highPriority}</p>
    <p className="text-sm text-gray-500">
      {highPriority > 0
        ? `⚠️ ${highPriority} urgent issue${highPriority > 1 ? "s" : ""} demand immediate action — these are critical risks that could impact stability if not resolved quickly.`
        : "✅ No high priority alerts right now — operations remain stable."}
    </p>
  </div>

  {/* Medium Priority */}
  <div className="bg-white p-6 rounded-lg shadow-md font-bold">
    <h2 className="text-lg font-bold text-yellow-600">Medium Priority</h2>
    <p className="text-3xl font-extrabold">{mediumPriority}</p>
    <p className="text-sm text-gray-500">
      {mediumPriority > 0
        ? `${mediumPriority} alert${mediumPriority > 1 ? "s" : ""} highlight areas that require monitoring — spending and performance trends should be reviewed closely.`
        : "✅ No medium priority alerts currently — finances are steady."}
    </p>
  </div>

  {/* Informational */}
  <div className="bg-white p-6 rounded-lg shadow-md font-bold">
    <h2 className="text-lg font-bold text-blue-600">Informational</h2>
    <p className="text-3xl font-extrabold">{informational}</p>
    <p className="text-sm text-gray-500">
      {informational > 0
        ? `${informational} informational update${informational > 1 ? "s" : ""} provide context and system checks — useful for ongoing monitoring and awareness.`
        : "ℹ️ No informational alerts right now — all systems normal."}
    </p>
  </div>
</div>


      {/* Charts */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-bold">
  {/* Alert Distribution */}
  <div className="bg-white p-6 rounded-lg shadow-md font-bold">
    <h2 className="text-lg font-bold text-gray-800 mb-4">Alert Distribution</h2>
    <Pie
      data={{
        labels: ["High", "Medium", "Info"],
        datasets: [
          {
            data: [highPriority, mediumPriority, informational],
            backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6"],
          },
        ],
      }}
    />
    <p className="text-gray-600 mt-2 font-bold">
      {highPriority + mediumPriority + informational > 0
        ? `Most alerts are medium priority (${mediumPriority}), showing spending patterns need review. There’s ${highPriority} urgent issue demanding immediate action and ${informational} informational update to keep monitoring.`
        : "No alerts available to display"}
    </p>
  </div>

  {/* Alerts Trend */}
  <div className="bg-white p-6 rounded-lg shadow-md font-bold">
    <h2 className="text-lg font-bold text-gray-800 mb-4">Alerts Trend</h2>
    <Line
      data={{
        labels: alerts.map(
          (a) => a.date || new Date(a.created_at).toISOString().slice(0, 10)
        ),
        datasets: [
          {
            label: "Alerts Over Time",
            data: alerts.map((_, i) => i + 1),
            borderColor: "#10B981",
            backgroundColor: "#A7F3D0",
            fill: true,
            tension: 0.4,
          },
        ],
      }}
    />
    <p className="text-gray-600 mt-2 font-bold">
      {alerts.length > 0
        ? `Alerts have grown to ${alerts.length} active issues over time — a rising risk profile that signals closer monitoring is needed.`
        : "No alert trend data yet"}
    </p>
  </div>

  {/* Alerts by Category */}
  <div className="bg-white p-6 rounded-lg shadow-md font-bold">
    <h2 className="text-lg font-bold text-gray-800 mb-4">Alerts by Category</h2>
    <Bar
      data={{
        labels: ["Fraud", "Expenses", "Revenue", "Churn"],
        datasets: [
          {
            label: "Alerts by Category",
            data: [
              alerts.filter((a) => a.type === "fraud").length,
              alerts.filter((a) => a.type === "expense").length,
              alerts.filter((a) => a.type === "revenue").length,
              alerts.filter((a) => a.type === "churn").length,
            ],
            backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"],
          },
        ],
      }}
      options={{ scales: { y: { beginAtZero: true } } }}
    />
    <p className="text-gray-600 mt-2 font-bold">
      {alerts.length > 0
        ? `Expenses are driving most alerts (${alerts.filter((a) => a.type === "expense").length}), while revenue (${alerts.filter((a) => a.type === "revenue").length}) and fraud (${alerts.filter((a) => a.type === "fraud").length}) remain relatively stable.`
        : "No category data available"}
    </p>
  </div>
</div>


      {/* Alerts List */}
<div className="space-y-4 font-bold">
  {alerts.map((alert) => {
    const level = (alert.level || "").toLowerCase();
    let borderColor = "border-blue-600";
    let titleColor = "text-blue-600";
    let title = "Informational";

    if (level === "high") {
      borderColor = "border-red-600";
      titleColor = "text-red-600";
      title = "High Priority";
    } else if (level === "medium") {
      borderColor = "border-yellow-600";
      titleColor = "text-yellow-600";
      title = "Medium Priority";
    }

    return (
      <div
        key={alert.id}
        className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${borderColor} font-bold`}
      >
        {/* Priority Title */}
        <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>

        {/* Alert Message */}
        <p className="text-gray-700 font-bold">{alert.message}</p>

        {/* Why explanation */}
        <p className="text-gray-500 text-sm mt-1 font-bold">
          {alert.why || "ℹ️ No explanation available"}
        </p>

        {/* Suggested Actions */}
        {alert.actions && alert.actions.length > 0 && (
          <ul className="text-sm text-gray-600 mt-2">
            {alert.actions.map((step, i) => (
              <li key={i}>👉 {step}</li>
            ))}
          </ul>
        )}

        {/* Scenario Badge */}
        <span
          className={`px-2 py-1 rounded-lg font-extrabold inline-block mt-2 ${
            alert.type === "revenue"
              ? "bg-green-100 text-green-700"
              : alert.type === "expense"
              ? "bg-yellow-100 text-yellow-700"
              : alert.type === "churn"
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {alert.type}
        </span>

        {/* Actions */}
        <div className="mt-3 flex space-x-4 font-bold">
          <button
            onClick={() => {
              setSelectedAlert(alert);
              setShowModal(true);
            }}
            className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold"
            title="Resolve this issue now"
          >
            Resolve
          </button>
          <a
            href={`/forecast?tab=${
              alert.type === "expense"
                ? "proportion"
                : alert.type === "churn"
                ? "growth"
                : alert.type === "revenue"
                ? "trend"
                : "liquidity"
            }`}
            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 font-bold"
            title="See how this alert impacts forecasts"
          >
            View in Forecast →
          </a>
          {/* WhatsApp Button */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              alert.whatsapp_text
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-bold"
            title="Send this alert to WhatsApp"
          >
            Send to WhatsApp
          </a>
        </div>
      </div>
    );
  })}
</div>

      {/* Modal Popup */}
{showModal && selectedAlert && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md font-bold">
      <h3 className="text-lg font-bold mb-4 text-gray-800">Alert Details</h3>

      {/* Alert Message */}
      <p className="text-gray-700 mb-4 font-bold">{selectedAlert.message}</p>

      {/* Why explanation */}
      <p className="text-gray-600 mb-4 font-bold">Explanation:</p>
      <p className="text-gray-500 mb-4">{selectedAlert.why || "ℹ️ No explanation available"}</p>

      {/* Suggested Actions */}
      <p className="text-gray-600 mb-4 font-bold">Suggested Actions:</p>
      {selectedAlert.actions && selectedAlert.actions.length > 0 ? (
        <ul className="text-sm text-gray-700 mb-4">
          {selectedAlert.actions.map((step, i) => (
            <li key={i}>👉 {step}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">ℹ️ No suggested actions available</p>
      )}

      <div className="flex justify-between font-bold">
        <button
          onClick={() => setShowModal(false)}
          className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 font-bold"
        >
          Close
        </button>
        <button
          onClick={async () => {
            try {
              // ✅ Call backend resolve route
              await fetch(`${API_BASE_URL}/alerts/${selectedAlert.id}/resolve`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              });
              // Remove resolved alert from state
              setAlerts(alerts.filter((a) => a.id !== selectedAlert.id));
              // Update counts
              setCounts({
                high: alerts.filter((a) => a.level === "high" && a.id !== selectedAlert.id).length,
                medium: alerts.filter((a) => a.level === "medium" && a.id !== selectedAlert.id).length,
                info: alerts.filter((a) => a.level === "info" && a.id !== selectedAlert.id).length,
              });
              // Show success toast
              setToast("✅ Alert resolved successfully!");
              setTimeout(() => setToast(null), 3000);
            } catch (err) {
              console.error("Error resolving alert:", err);
              setToast("❌ Error resolving alert.");
              setTimeout(() => setToast(null), 3000);
            }
            setShowModal(false);
          }}
          className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold"
        >
          Mark Resolved
        </button>
      </div>
    </div>
  </div>
)}

      {/* Export Button */}
<div className="mt-6 font-bold">
  <button
    onClick={() => {
      exportCSV();
      setToast(
        alerts.length > 0
          ? `📂 Exported ${alerts.length} alerts to CSV successfully!`
          : "⚠️ No alerts available to export."
      );
      setTimeout(() => setToast(null), 3000);
    }}
    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 font-bold"
  >
    Export Alerts CSV
  </button>
</div>

{/* Refresh Button */}
<div className="mt-6 font-bold">
  <button
    onClick={async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/alerts`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await res.json();
        if (data && Array.isArray(data.alerts)) {
          const normalized = data.alerts.map((a) => ({
            ...a,
            level: (a.level || "").toLowerCase(),
          }));
          setAlerts(normalized);
          setCounts(data.counts);
          setToast(
            `🔄 Refreshed alerts — ${normalized.length} alerts currently active`
          );
          setTimeout(() => setToast(null), 3000);
        } else {
          setToast("ℹ️ No alerts found during refresh.");
          setTimeout(() => setToast(null), 3000);
        }
      } catch (err) {
        console.error("Error refreshing alerts:", err);
        setToast("❌ Error refreshing alerts.");
        setTimeout(() => setToast(null), 3000);
      }
    }}
    className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 font-bold"
  >
    Refresh Alerts
  </button>
</div>

{/* Toast Notification */}
{toast && (
  <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg font-bold">
    {toast}
  </div>
)}
</div>
);
}

export default Alerts;

