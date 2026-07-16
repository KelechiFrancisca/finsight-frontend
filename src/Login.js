import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  // ✅ Use environment variable for backend URL
  const baseUrl = process.env.REACT_APP_API_URL;

  // ✅ Validation
  const validate = () => {
    const newErrors = {};
    if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address.";
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    if (!validate()) return;

    try {
      setLoading(true);
      // ✅ Explicitly include /api since Flask blueprints use url_prefix="/api"
      const response = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();
      console.log("Login response:", data);

      if (data.token) {
        localStorage.setItem("token", data.token);
        setSuccessMessage("✅ Login successful! Redirecting...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        setErrors({ form: data.error || "Login failed" });
      }
    } catch (error) {
      console.error("Login error:", error);
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
        </div>
      </nav>

      {/* Login Form */}
      <div className="flex items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md w-96 font-bold"
        >
          <h2 className="text-2xl font-extrabold mb-4 text-gray-800">Login</h2>

          {successMessage && (
            <p className="text-green-600 font-extrabold mb-2">{successMessage}</p>
          )}
          {errors.form && (
            <p className="text-red-600 font-extrabold mb-2">{errors.form}</p>
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full mb-2 p-2 border rounded font-bold"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {errors.email && (
            <p className="text-red-500 text-sm mb-2 font-bold">{errors.email}</p>
          )}

          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-2 border rounded font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span
              className="absolute right-3 top-2 cursor-pointer text-sm text-blue-600 font-bold"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈 Hide" : "👁 Show"}
            </span>
          </div>
          {errors.password && (
            <p className="text-red-500 text-sm mb-2 font-bold">{errors.password}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 font-extrabold"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          {/* Forgot Password */}
          <p className="mt-3 text-sm font-bold">
            <span
              className="text-blue-600 cursor-pointer font-extrabold"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot Password?
            </span>
          </p>

          <p className="mt-3 text-sm font-bold">
            Don’t have an account?{" "}
            <span
              className="text-blue-600 cursor-pointer font-extrabold"
              onClick={() => navigate("/register")}
            >
              Register
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
