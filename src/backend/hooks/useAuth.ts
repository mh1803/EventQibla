import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  isTokenExpired,
  startTokenWatchdog,
  login as authLogin,
  logout as authLogout,
  getTokenData,
  PUBLIC_ROUTES,
  isUserBanned,
} from "../utils/authHelpers";
import {
  subscribeToAuthChanges,
  unsubscribeFromAuthChanges,
} from "../utils/authEvent";

interface UserData {
  role: "user" | "admin" | "banned";
  userId?: number;
  email?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isBanned: boolean;
  checkAuth: () => boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: (redirectPath?: string) => void;
  userData: UserData | null;
}

export const useAuth = (): AuthContextType => {
  // Initial auth state setup

  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    isLoading: boolean;
    isBanned: boolean;
    userData: UserData | null;
  }>({
    isAuthenticated: false,
    isLoading: true,
    isBanned: false,
    userData: null,
  });

  const navigate = useNavigate();
  const location = useLocation();

  const updateAuthState = useCallback((isAuthenticated: boolean) => {
    const tokenData = isAuthenticated ? getTokenData() : null;
    const banned = isAuthenticated ? isUserBanned() : false;

    setAuthState({
      isAuthenticated,
      isLoading: false,
      isBanned: banned,
      userData: isAuthenticated
        ? {
            role: tokenData?.role || "user",
            userId: tokenData?.userId,
            email: tokenData?.email,
          }
        : null,
    });
  }, []);

  const checkAuth = useCallback((): boolean => {
    const token = localStorage.getItem("authToken");
    const isAuthenticated = !!token && !isTokenExpired(token);
    updateAuthState(isAuthenticated);
    return isAuthenticated;
  }, [updateAuthState]);

  // Login and update auth state

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      try {
        await authLogin(credentials);
        checkAuth();
      } catch (error: unknown) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          isBanned:
            error instanceof Error &&
            error.message === "This account has been banned",
          userData: null,
        });
        throw error instanceof Error
          ? error
          : new Error("Login failed. Please try again.");
      }
    },
    [checkAuth]
  );

  // Logout and reset Auth state

  const logout = useCallback((redirectPath: string = "/login") => {
    authLogout(redirectPath);
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      isBanned: false,
      userData: null,
    });
  }, []);

  // On component mount: check auth, set up event listeners, and start token watchdog

  useEffect(() => {
    const isUserAuthenticated = checkAuth();

    const handleAuthChange = (isAuthenticated: boolean) => {
      updateAuthState(isAuthenticated);
    };

    subscribeToAuthChanges(handleAuthChange);

    // Start the token watchdog to handle token expiration

    const cleanupWatchdog = isUserAuthenticated
      ? startTokenWatchdog(() => {
          // When token expires, reset state and redirect if needed

          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            isBanned: false,
            userData: null,
          });

          if (
            !PUBLIC_ROUTES.some(
              (route) =>
                location.pathname === route ||
                (route !== "/" && location.pathname.startsWith(`${route}/`))
            )
          ) {
            navigate("/login?expired=true", {
              state: { redirect: location.pathname },
            });
          }
        })
      : () => {};

    // Cleanup on unmount
    return () => {
      unsubscribeFromAuthChanges(handleAuthChange);
      cleanupWatchdog();
    };
  }, [checkAuth, updateAuthState, navigate, location.pathname]);

  return {
    ...authState,
    checkAuth,
    login,
    logout,
  };
};

export default useAuth;
