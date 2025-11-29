import React, { useState, useEffect } from "react";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import "../../../public/css/my-notifications.css";
import { useNotifications } from "../context/NotificationContext.js";

interface Notification {
  id: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: Date;
  entityType?: string;
  entityId?: number;
}

const MyNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshNotifications } = useNotifications();

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch unread count
        const countResponse = await fetch(
          `${API_BASE_URL}/api/notification/unread/count`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (!countResponse.ok) {
          throw new Error("Failed to fetch unread count");
        }
        const countData = await countResponse.json();
        setUnreadCount(countData.count);

        // Fetch notifications
        const notificationsResponse = await fetch(
          `${API_BASE_URL}/api/notification`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (!notificationsResponse.ok) {
          const errorData = await notificationsResponse.json();
          throw new Error(errorData.message || "Failed to fetch notifications");
        }

        const notificationsData = await notificationsResponse.json();
        setNotifications(notificationsData);

        // Mark all as read if there are unread notifications
        if (countData.count > 0) {
          await fetch(`${API_BASE_URL}/api/notification/read-all`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
              "Content-Type": "application/json",
            },
          });
        }

        await refreshNotifications();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Error fetching notifications"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [refreshNotifications, API_BASE_URL]);

  return (
    <div className="my-notifications-container">
      <div className="my-notifications-header">
        <h2 className="my-notifications-title">My Notifications</h2>
        {unreadCount > 0 && (
          <span className="unread-count-badge">{unreadCount} unread</span>
        )}
      </div>

      <div className="my-notifications-results">
        {loading ? (
          <p>Loading your notifications...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : (
          <div className="my-notifications-list">
            {notifications.length === 0 ? (
              <p>You don't have any notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`my-notifications-item ${
                    !notification.is_read ? "unread" : ""
                  }`}
                >
                  <div className="notification-content">
                    <h3>{notification.title}</h3>
                    <p>{notification.content}</p>
                    <div className="notification-meta">
                      <span>
                        {formatDateWithOrdinal(String(notification.created_at))}
                      </span>
                      {!notification.is_read && (
                        <span className="unread-badge">New</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyNotifications;
