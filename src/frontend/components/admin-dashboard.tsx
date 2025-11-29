import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../../public/css/dashboard.css";

interface User {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin" | "banned";
  created_at: string;
  avg_rating: number;
  review_count: number;
  event_ids: number[];
}

interface BanResult {
  success: boolean;
  banned_user_id: number;
  cancelled_events: number;
}

interface UnbanResult {
  success: boolean;
  unbanned_user: {
    id: number;
    username: string;
  };
}

interface Pagination {
  currentPage: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState({
    users: true,
    initialLoad: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "rating_asc" | "rating_desc"
  >("newest");
  const [showBanConfirmation, setShowBanConfirmation] = useState(false);
  const [showUnbanConfirmation, setShowUnbanConfirmation] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    perPage: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const validateUserData = useCallback((data: any): User[] => {
    if (!Array.isArray(data)) {
      throw new Error("Expected array of users");
    }

    return data.map((user) => ({
      id: Number(user.id),
      username: String(user.username || ""),
      email: String(user.email || ""),
      role: ["user", "admin", "banned"].includes(user.role)
        ? user.role
        : "user",
      created_at: String(user.created_at || new Date().toISOString()),
      avg_rating: Number(user.avg_rating) || 0,
      review_count: Number(user.review_count) || 0,
      event_ids: Array.isArray(user.event_ids)
        ? user.event_ids.map((id: any) => Number(id))
        : [],
    }));
  }, []);

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading((prev) => ({ ...prev, users: true }));
        setError(null);

        const queryParams = new URLSearchParams({
          sort: sortOption,
          search: searchTerm,
          page: page.toString(),
          limit: pagination.perPage.toString(),
        }).toString();

        const response = await fetch(
          `${API_BASE_URL}/api/admin/users?${queryParams}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch users: HTTP ${response.status}`);
        }

        const data = await response.json();
        const validatedUsers = validateUserData(data.data);

        setUsers(validatedUsers);
        setPagination({
          currentPage: data.pagination.currentPage,
          perPage: data.pagination.perPage,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
          hasNextPage: data.pagination.hasNextPage,
          hasPrevPage: data.pagination.hasPrevPage,
        });
      } catch (err) {
        console.error("Detailed error:", err);
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading((prev) => ({ ...prev, users: false, initialLoad: false }));
      }
    },
    [sortOption, searchTerm, pagination.perPage, validateUserData, API_BASE_URL]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchUsers(newPage);
    }
  };

  const handleBanUser = useCallback(async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${selectedUser.id}/ban`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Ban failed: ${response.status}`);
      }

      const result: BanResult = await response.json();

      if (result?.success) {
        toast.success(
          `User banned successfully. ${result.cancelled_events} events cancelled.`
        );
        await fetchUsers(pagination.currentPage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ban user");
      console.error("Ban error:", err);
    } finally {
      setIsProcessing(false);
      setShowBanConfirmation(false);
      setSelectedUser(null);
    }
  }, [selectedUser, API_BASE_URL, fetchUsers, pagination.currentPage]);

  const handleUnbanUser = useCallback(async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${selectedUser.id}/unban`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Unban failed: ${response.status}`
        );
      }

      const result: UnbanResult = await response.json();

      if (result?.success) {
        toast.success(
          `User ${result.unbanned_user?.username} unbanned successfully.`
        );
        await fetchUsers(pagination.currentPage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unban user");
      console.error("Unban error:", err);
    } finally {
      setIsProcessing(false);
      setShowUnbanConfirmation(false);
      setSelectedUser(null);
    }
  }, [selectedUser, API_BASE_URL, fetchUsers, pagination.currentPage]);

  const openBanConfirmation = useCallback((user: User) => {
    if (user.role === "admin") {
      toast.info("Admins cannot be banned");
      return;
    }
    if (user.role === "banned") {
      toast.info("This user is already banned");
      return;
    }
    setSelectedUser(user);
    setShowBanConfirmation(true);
  }, []);

  const openUnbanConfirmation = useCallback((user: User) => {
    if (user.role !== "banned") {
      toast.info("This user is not banned");
      return;
    }
    setSelectedUser(user);
    setShowUnbanConfirmation(true);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  if (loading.initialLoad) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1>User Management Dashboard</h1>
        <div className="controls">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={sortOption}
            onChange={(e) =>
              setSortOption(
                e.target.value as
                  | "newest"
                  | "oldest"
                  | "rating_asc"
                  | "rating_desc"
              )
            }
            className="sort-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="rating_asc">Rating (Low to High)</option>
            <option value="rating_desc">Rating (High to Low)</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        {filteredUsers.length === 0 ? (
          <div className="no-results">
            {searchTerm ? "No matching users found" : "No users found"}
          </div>
        ) : (
          <>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Rating</th>
                  <th>Events</th>
                  <th>Joined</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <div className="rating-section">
                        <div className="rating-stars">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`star ${
                                i < Math.round(user.avg_rating) ? "filled" : ""
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <p>
                          {user.avg_rating.toFixed(1)} ({user.review_count}
                          {user.review_count === 1 ? " review" : " reviews"})
                        </p>
                      </div>
                    </td>
                    <td>{user.event_ids.length}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>
                      <span className={`role ${user.role}`}>
                        {user.role === "admin"}
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {user.role === "banned" ? (
                          <button
                            onClick={() => openUnbanConfirmation(user)}
                            className="unban-button"
                            title="Unban user"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              user.role !== "admin" && openBanConfirmation(user)
                            }
                            className={`ban-button ${
                              user.role === "admin" ? "disabled" : ""
                            }`}
                            disabled={user.role === "admin"}
                            title={
                              user.role === "admin"
                                ? "Admin users cannot be banned"
                                : "Ban user"
                            }
                          >
                            Ban
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="pagination-controls">
        <button
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={!pagination.hasPrevPage || loading.users}
        >
          Previous
        </button>
        <span>
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <button
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={!pagination.hasNextPage || loading.users}
        >
          Next
        </button>
      </div>

      {showBanConfirmation && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Ban</h2>
            <p>
              Are you sure you want to ban{" "}
              <strong>{selectedUser.username}</strong>? This will also cancel
              all their active events.
            </p>
            <div className="modal-buttons">
              <button
                onClick={handleBanUser}
                className="confirm-button"
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Confirm Ban"}
              </button>
              <button
                onClick={() => setShowBanConfirmation(false)}
                className="cancel-button"
                disabled={isProcessing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnbanConfirmation && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Unban</h2>
            <p>
              Are you sure you want to unban{" "}
              <strong>{selectedUser.username}</strong>?
            </p>
            <div className="modal-buttons">
              <button
                onClick={handleUnbanUser}
                className="confirm-button"
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Confirm Unban"}
              </button>
              <button
                onClick={() => setShowUnbanConfirmation(false)}
                className="cancel-button"
                disabled={isProcessing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
