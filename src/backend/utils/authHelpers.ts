import axios, { AxiosError, AxiosResponse } from "axios";
import { emitAuthChange } from "./authEvent";

interface DecodedToken {
  exp?: number;
  iat?: number;
  role?: "user" | "admin" | "banned";
  userId?: number;
  email?: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: "user" | "admin" | "banned";
    profilePicture?: string;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

// Token Utilities
export const decodeToken = (token: string | null): DecodedToken | null => {
  if (!token) return null;

  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Token decoding failed:", error);
    return null;
  }
};

// Check if Token is expired
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  const decoded = decodeToken(token);
  return !decoded?.exp || decoded.exp * 1000 < Date.now();
};

// Retrieve token data from decoded JWT
export const getTokenData = (): {
  role: "user" | "admin" | "banned";
  userId?: number;
  email?: string;
  isExpired: boolean;
} | null => {
  const token = localStorage.getItem("authToken");
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded) return null;

  return {
    role: decoded.role || "user",
    userId: decoded.userId ? Number(decoded.userId) : undefined,
    email: decoded.email,
    isExpired: isTokenExpired(token),
  };
};

// Auth State Management
export const clearAuthData = (): void => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("profilePicture");
  delete axios.defaults.headers.common["Authorization"];
  emitAuthChange(false);
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem("authToken", token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  emitAuthChange(true);
};

// Login/Logout Functions
export const login = async (
  credentials: LoginCredentials
): Promise<LoginResponse> => {
  try {
    const response = await axios.post<LoginResponse>(
      "/api/auth/login",
      credentials
    );
    const { token, user } = response.data;

    if (user.role === "banned") {
      throw new Error("This account has been banned");
    }

    setAuthToken(token);

    if (user.profilePicture) {
      localStorage.setItem("profilePicture", user.profilePicture);
    }

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error("Invalid email or password");
      }
      if (error.response?.status === 403) {
        const message = error.response.data?.message;
        if (message === "User is banned") {
          throw new Error("This account has been banned");
        }
      }
    }
    throw new Error(
      error instanceof Error ? error.message : "Login failed. Please try again."
    );
  }
};

export const logout = (redirectTo: string = "/login"): void => {
  clearAuthData();
  if (redirectTo) {
    window.location.href = redirectTo;
  }
};

// Public routes accessible without authentication
export const PUBLIC_ROUTES = ["/", "/events", "/login", "/register"];

// Session Management
export const startTokenWatchdog = (onExpiration?: () => void): (() => void) => {
  const checkTokenValidity = () => {
    const token = localStorage.getItem("authToken");
    if (token && isTokenExpired(token)) {
      handleUnauthorized(true, false, onExpiration);
    }
  };

  checkTokenValidity(); // Immediate check
  const intervalId = setInterval(checkTokenValidity, 60000); // Check every minute

  return () => clearInterval(intervalId);
};

export const handleUnauthorized = (
  redirect: boolean = false,
  isLoginAttempt: boolean = false,
  callback?: () => void
): void => {
  // Check if the current route is public
  const currentPath = window.location.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) =>
      currentPath === route ||
      (route !== "/" && currentPath.startsWith(route + "/"))
  );

  // Check if the current page is login or registration page
  const isAuthPage = ["/login", "/register"].some((path) =>
    currentPath.startsWith(path)
  );

  // Clear stored authentication data
  clearAuthData();
  callback?.();

  // If conditions are met, redirect to the login page with an expired flag
  if (!isLoginAttempt && redirect && !isAuthPage && !isPublicRoute) {
    window.location.href = `/login?expired=true&redirect=${encodeURIComponent(
      currentPath
    )}`;
  }
};

// Axios Configuration
const setupAxiosInterceptors = () => {
  // Attach Authorization header if token is valid
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem("authToken");
    if (token && !isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  });

  // handle 401 Unauthorized errors for axios requests
  axios.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        const isLoginAttempt = error.config?.url?.includes("/login");
        const requestUrl = error.config?.url || "";
        const isPublicApi = PUBLIC_ROUTES.some(
          (route) => requestUrl.includes(route) || requestUrl.includes("public")
        );

        if (!isPublicApi) {
          handleUnauthorized(true, isLoginAttempt);
        }
      }
      return Promise.reject(error);
    }
  );
};

// Initialize on import
setupAxiosInterceptors();

// Role-based helpers
export const hasAdminRole = (): boolean => {
  const tokenData = getTokenData();
  return tokenData?.role === "admin" && !tokenData.isExpired;
};

export const isUserBanned = (): boolean => {
  const tokenData = getTokenData();
  return tokenData?.role === "banned" && !tokenData.isExpired;
};

export const getCurrentUserId = (): number | undefined => {
  return getTokenData()?.userId;
};

export const getCurrentUserEmail = (): string | undefined => {
  return getTokenData()?.email;
};
