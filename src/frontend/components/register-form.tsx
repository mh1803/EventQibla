import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../../public/css/login-form.css";
import { emitAuthChange } from "../../backend/utils/authEvent.js";

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
    retypePassword: "",
  });

  const [errors, setErrors] = useState({
    username: "",
    password: "",
    retypePassword: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [id]: value }));

    if (id === "username") {
      setErrors((prev) => ({
        ...prev,
        username:
          value.length > 20 ? "Username must be 20 characters or less." : "",
      }));
    }

    if (id === "password") {
      setErrors((prev) => ({
        ...prev,
        password:
          value.length < 6
            ? "Password must be at least 6 characters long."
            : "",
      }));
    }

    if (id === "retypePassword") {
      setErrors((prev) => ({
        ...prev,
        retypePassword:
          value !== formData.password ? "Passwords do not match." : "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (formData.username.length > 20) {
      setError("Username must be 20 characters or less.");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.retypePassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed. Please try again."
        );
      }

      if (data.token) {
        // Store the token in localStorage
        localStorage.setItem("authToken", data.token);

        // Emit auth change event
        emitAuthChange(true);

        navigate("/");
      } else {
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
      console.error("Registration error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Register</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="full_name">
              Full Name: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              id="full_name"
              placeholder="Enter your full name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email: <span className="red-asterisk">*</span>
            </label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">
              Username: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              id="username"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleInputChange}
              required
              maxLength={20}
            />
            <p>{formData.username.length}/20 characters</p>
            {errors.username && (
              <p className="error-message">{errors.username}</p>
            )}
          </div>

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
            />
            {errors.password && (
              <p className="error-message">{errors.password}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="retypePassword">
              Retype Password: <span className="red-asterisk">*</span>
            </label>
            <input
              type="password"
              id="retypePassword"
              placeholder="Retype your password"
              value={formData.retypePassword}
              onChange={handleInputChange}
              required
            />
            {errors.retypePassword && (
              <p className="error-message">{errors.retypePassword}</p>
            )}
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="link">
          <p>
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
