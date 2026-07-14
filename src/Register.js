import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  // ✅ Password strength scoring
  const getStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthLabel = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["red", "orange", "blue", "green"];

  // ✅ Validation
  const validate = () => {
    const newErrors = {};
    if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address.";
    if (password.length < 8) newErrors.password = "Password must be at least 8 characters.";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";
    if (!role) newErrors.role = "Role is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role
        }),
      });

      const data = await response.json();

      if (data.token) {
        localStorage.setItem("token", data.token);
        setSuccessMessage("✅ Registration successful! Redirecting...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        setErrors({ form: data.error || "Registration failed" });
      }
    } catch (error) {
      console.error("Register error:", error);
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
          <a href="/register" className="px-3 py-2 rounded bg-green-600 text-white font-bold">Register</a>
        </div>
      </nav>

      {/* Register Form */}
      <div className="flex items-center justify-center">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md w-96 font-bold">
          <h2 className="text-2xl font-extrabold mb-4 text-gray-800">Register</h2>

          {successMessage && <p className="text-green-600 font-extrabold mb-2">{successMessage}</p>}
          {errors.form && <p className="text-red-600 font-extrabold mb-2">{errors.form}</p>}

          <input
            type="email"
            placeholder="Email"
            className="w-full mb-2 p-2 border rounded font-bold"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {errors.email && <p className="text-red-500 text-sm mb-2 font-bold">{errors.email}</p>}

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full mb-2 p-2 border rounded font-bold"
            required
          >
            <option value="">Select Role</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          {errors.role && <p className="text-red-500 text-sm mb-2 font-bold">{errors.role}</p>}

          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-2 border rounded font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {errors.password && <p className="text-red-500 text-sm mb-2 font-bold">{errors.password}</p>}

          {/* Password strength meter */}
          {password && (
            <div className="mb-2">
              <p className={`text-${strengthColors[getStrength(password)-1]}-600 text-sm font-bold`}>
                Strength: {strengthLabel[getStrength(password)-1]}
              </p>
              <div className="h-2 w-full bg-gray-200 rounded">
                <div
                  className={`h-2 rounded bg-${strengthColors[getStrength(password)-1]}-500`}
                  style={{ width: `${(getStrength(password) / 4) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm Password"
              className="w-full p-2 border rounded font-bold"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <span
              className="absolute right-3 top-2 cursor-pointer text-sm text-blue-600 font-bold"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈 Hide" : "👁 Show"}
            </span>
          </div>
          {errors.confirmPassword && <p className="text-red-500 text-sm mb-2 font-bold">{errors.confirmPassword}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50 font-extrabold"
          >
            {loading ? "Registering..." : "Register"}
          </button>

          <p className="mt-3 text-sm font-bold">
            Already have an account?{" "}
            <span className="text-blue-600 cursor-pointer font-extrabold" onClick={() => navigate("/login")}>
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Register;
