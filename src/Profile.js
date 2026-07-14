import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Profile() {
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const navigate = useNavigate();

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  // ✅ Load profile
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          navigate("/login");
        } else {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            role: data.role || ""
          });
        }
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
      })
      .finally(() => setLoading(false));
  }, [navigate, baseUrl]);

  // ✅ Handle input change
  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setSuccessMessage("");
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setSuccessMessage("");
  };

  // ✅ Validation
  const validateProfile = () => {
    const newErrors = {};
    if (!profile.name.trim()) newErrors.name = "Name is required.";
    if (!/\S+@\S+\.\S+/.test(profile.email)) newErrors.email = "Invalid email address.";
    if (profile.phone && !/^\+?[0-9\s-]{7,15}$/.test(profile.phone)) newErrors.phone = "Invalid phone number.";
    if (!profile.role) newErrors.role = "Role is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors = {};
    if (!passwords.currentPassword) newErrors.currentPassword = "Current password is required.";
    if (passwords.newPassword.length < 8) newErrors.newPassword = "New password must be at least 8 characters.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Save profile
  const handleSaveProfile = async () => {
    if (!validateProfile()) return;
    const token = localStorage.getItem("token");
    setSaving(true);
    try {
      const response = await fetch(`${baseUrl}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage("Profile updated successfully!");
      } else {
        setErrors({ form: data.error || "Failed to update profile" });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrors({ form: "Server error" });
    } finally {
      setSaving(false);
    }
  };

  // ✅ Save password
  const handleSavePassword = async () => {
    if (!validatePassword()) return;
    const token = localStorage.getItem("token");
    setSavingPassword(true);
    try {
      const response = await fetch(`${baseUrl}/users/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwords),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage("Password updated successfully!");
        setPasswords({ currentPassword: "", newPassword: "" });
      } else {
        setErrors({ form: data.error || "Failed to update password" });
      }
    } catch (error) {
      console.error("Error updating password:", error);
      setErrors({ form: "Server error" });
    } finally {
      setSavingPassword(false);
    }
  };

  // ✅ Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (loading) return <p className="font-bold">Loading profile...</p>;

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow-md space-y-8 font-bold">
      {successMessage && <p className="text-green-600 font-extrabold">{successMessage}</p>}
      {errors.form && <p className="text-red-600 font-extrabold">{errors.form}</p>}

      {/* Personal Information */}
      <div>
        <h2 className="text-2xl font-extrabold mb-4">Personal Information</h2>
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          className="w-full mb-1 p-2 border rounded font-bold"
          value={profile.name}
          onChange={handleChange}
        />
        {errors.name && <p className="text-red-500 text-sm mb-2 font-bold">{errors.name}</p>}

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          className="w-full mb-1 p-2 border rounded font-bold"
          value={profile.email}
          onChange={handleChange}
        />
        {errors.email && <p className="text-red-500 text-sm mb-2 font-bold">{errors.email}</p>}

        <input
          type="text"
          name="phone"
          placeholder="Phone Number"
          className="w-full mb-1 p-2 border rounded font-bold"
          value={profile.phone}
          onChange={handleChange}
        />
        {errors.phone && <p className="text-red-500 text-sm mb-2 font-bold">{errors.phone}</p>}

        <select
          name="role"
          className="w-full mb-1 p-2 border rounded font-bold"
          value={profile.role}
          onChange={handleChange}
        >
          <option value="">Select Role</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        {errors.role && <p className="text-red-500 text-sm mb-2 font-bold">{errors.role}</p>}

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 mb-3 disabled:opacity-50 font-extrabold"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Change Password */}
      <div>
        <h2 className="text-2xl font-extrabold mb-4">Change Password</h2>
        <input
          type="password"
          name="currentPassword"
          placeholder="Current Password"
          className="w-full mb-1 p-2 border rounded font-bold"
          value={passwords.currentPassword}
          onChange={handlePasswordChange}
        />
        {errors.currentPassword && <p className="text-red-500 text-sm mb-2 font-bold">{errors.currentPassword}</p>}

        <input
          type="password"
          name="newPassword"
          placeholder="New Password"
          className="w-full mb-1 p-2 border rounded font-bold"
          value={passwords.newPassword}
          onChange={handlePasswordChange}
        />
        {errors.newPassword && <p className="text-red-500 text-sm mb-2 font-bold">{errors.newPassword}</p>}

        <button
          onClick={handleSavePassword}
          disabled={savingPassword}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 mb-3 disabled:opacity-50 font-extrabold"
        >
          {savingPassword ? "Saving..." : "Update Password"}
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 font-extrabold"
      >
        Logout
      </button>
    </div>
  );
}

export default Profile;
