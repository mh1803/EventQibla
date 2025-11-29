import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../../public/css/login-form.css";
import axios from "axios";
import { emitAuthChange } from "../../backend/utils/authEvent.js";
import { useNotifications } from "../context/NotificationContext";

const LoginForm = () => {
  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshNotifications } = useNotifications();

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [id]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        formData
      );

      if (response.data.token) {
        localStorage.setItem("authToken", response.data.token);

        // Set default Authorization header for axios
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        // Emit auth change event
        emitAuthChange(true);

        // Refresh notifications
        await refreshNotifications();

        // Handle redirect
        const redirectTo = "/";
        navigate(redirectTo);
      } else {
        setError(
          response.data.message || "Login successful but no token received"
        );
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message || "Login failed. Please try again."
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>

        <form onSubmit={handleSubmit}>
          {/* Login Field */}
          <div className="form-group">
            <label htmlFor="login">
              Email or Username: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              id="login"
              placeholder="Enter your email or username"
              value={formData.login}
              onChange={handleInputChange}
              required
              autoComplete="username"
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">
              Password: <span className="red-asterisk">*</span>
            </label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleInputChange}
              required
              autoComplete="current-password"
            />
          </div>

          {/* Error Message */}
          {error && <p className="error-message">{error}</p>}

          {/* Login Button */}
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Register Link */}
        <div className="link">
          <p>
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
