import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  // ✅ Validation
  const validate = () => {
    const newErrors = {};
    if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("✅ Password reset link sent to your email!");
      } else {
        setErrors({ form: data.error || "Failed to send reset link" });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setErrors({ form: "Server error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-bold">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md rounded-lg mb-6 p-4 flex justify-between items-center font-bold">
        <h1 className="text-xl font-extrabold text-gray-800">Business Dashboard</h1>
        <div className="space-x-4">
          <a href="/dashboard" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Dashboard</a>
          <a href="/forecast" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Forecast</a>
          <a href="/alerts" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Alerts</a>
          <a href="/settings" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Settings</a>
          <a href="/profile" className="px-3 py-2 rounded bg-gray-200 hover:bg-teal-500 hover:text-white font-bold">Profile</a>
          <a href="/login" className="px-3 py-2 rounded bg-blue-600 text-white font-bold">Login</a>
          <a href="/register" className="px-3 py-2 rounded bg-green-600 text-white font-bold">Register</a>
        </div>
      </nav>

      {/* Forgot Password Form */}
      <div className="flex items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md w-96 font-bold"
        >
          <h2 className="text-2xl font-extrabold mb-4 text-gray-800">Forgot Password</h2>

          {successMessage && <p className="text-green-600 font-extrabold mb-2">{successMessage}</p>}
          {errors.form && <p className="text-red-600 font-extrabold mb-2">{errors.form}</p>}

          <input
            type="email"
            placeholder="Enter your email"
            className="w-full mb-2 p-2 border rounded font-bold"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {errors.email && <p className="text-red-500 text-sm mb-2 font-bold">{errors.email}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 font-extrabold"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <p className="mt-3 text-sm font-bold">
            Remembered your password?{" "}
            <span
              className="text-blue-600 cursor-pointer font-extrabold"
              onClick={() => navigate("/login")}
            >
              Back to Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
