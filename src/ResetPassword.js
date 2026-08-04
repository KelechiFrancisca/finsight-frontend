import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API_BASE_URL from "./apiConfig";   // ✅ centralized import

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const { token } = useParams(); // token from reset link

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
      const response = await fetch(`${API_BASE_URL}/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("✅ Password reset successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setErrors({ form: data.error || "Failed to reset password" });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrors({ form: "Server error, please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-bold">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md w-96 font-bold">
        <h2 className="text-2xl font-extrabold mb-4 text-gray-800">Reset Password</h2>

        {successMessage && <p className="text-green-600 font-extrabold mb-2">{successMessage}</p>}
        {errors.form && <p className="text-red-600 font-extrabold mb-2">{errors.form}</p>}

        <input
          type="password"
          placeholder="New Password"
          className="w-full mb-2 p-2 border rounded font-bold"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {errors.newPassword && <p className="text-red-500 text-sm mb-2 font-bold">{errors.newPassword}</p>}

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full mb-2 p-2 border rounded font-bold"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mb-2 font-bold">{errors.confirmPassword}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded font-extrabold text-white 
            ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;
