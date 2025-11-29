import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import axios from "axios";

type NotificationContextType = {
  refreshNotifications: () => Promise<void>;
  notificationsCount: number;
  isLoading: boolean;
  error: string | null;
};

const NotificationContext = createContext<NotificationContextType>({
  refreshNotifications: async () => {},
  notificationsCount: 0,
  isLoading: false,
  error: null,
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshNotifications = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setNotificationsCount(0);
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/notification/unread/count`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      // Only update if request wasn't aborted
      if (!controller.signal.aborted) {
        setNotificationsCount(response.data.count || 0);
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log("Request canceled:", err.message);
      } else {
        console.error("Failed to fetch notifications count:", err);
        setError("Failed to load notifications");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [API_BASE_URL]);

  // Auto-refresh notifications when the provider mounts
  useEffect(() => {
    refreshNotifications();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refreshNotifications]);

  // Set up periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        // Only refresh if not already loading
        refreshNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshNotifications, isLoading]);

  const value = {
    refreshNotifications,
    notificationsCount,
    isLoading,
    error,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};
