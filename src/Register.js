import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_BASE_URL from "./apiConfig";   // ✅ centralized import

function Register() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

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
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem("token", data.token);
        toast.success("✅ Registration successful! Redirecting...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch (error) {
      console.error("Register error:", error);
      toast.error("Network error, please try again");
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

          {/* ✅ Loading spinner integrated */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded font-extrabold text-white 
              ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
                  ></path>
                </svg>
                Registering...
              </div>
            ) : (
              "Register"
            )}
          </button>

                    {/* Toast container */}
          <ToastContainer position="top-right" autoClose={3000} />

          <p className="mt-3 text-sm font-bold">
            Already have an account?{" "}
            <span
              className="text-blue-600 cursor-pointer font-extrabold"
              onClick={() => navigate("/login")}
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Register;
