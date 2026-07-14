import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const { token } = useParams(); // token from reset link

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  // ✅ Validation
  const validate = () => {
    const newErrors = {};
    if (newPassword.length < 8) newErrors.newPassword = "Password must be at least 8 characters.";
    if (newPassword !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Password reset successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setErrors({ form: data.error || "Failed to reset password" });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrors({ form: "Server error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4">Reset Password</h2>

        {successMessage && <p className="text-green-600 font-semibold mb-2">{successMessage}</p>}
        {errors.form && <p className="text-red-600 font-semibold mb-2">{errors.form}</p>}

        <input
          type="password"
          placeholder="New Password"
          className="w-full mb-1 p-2 border rounded"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {errors.newPassword && <p className="text-red-500 text-sm mb-2">{errors.newPassword}</p>}

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full mb-1 p-2 border rounded"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mb-2">{errors.confirmPassword}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;
