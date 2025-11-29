import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import "../../../public/css/event-results.css";
import "../../../public/css/my-events.css";
import { useNotifications } from "../context/NotificationContext.js";

const DeleteEventModal = lazy(() =>
  import("./modals/delete-event-modal.js").then((module) => ({
    default: module.DeleteEventModal,
  }))
);

interface Event {
  id: string;
  title: string;
  imageUrl: string;
  categories: string[];
  status: "active" | "cancelled" | "completed";
  startTime: string;
  endTime: string;
  address: string;
  genderSpecific: "all" | "men" | "women";
  city: string;
  postCode: string;
  price: number;
  attendeeCount: number;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const EventItem: React.FC<{
  event: Event;
  onViewAttendees: (eventId: string, e: React.MouseEvent) => void;
  onEdit: (eventId: string, e: React.MouseEvent) => void;
  onDelete: (event: Event, e: React.MouseEvent) => void;
  deletingEventId: string | null;
}> = memo(({ event, onViewAttendees, onEdit, onDelete, deletingEventId }) => {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    if (event.status !== "cancelled") {
      navigate(`/events/${event.id}`);
    }
  }, [event.id, event.status]);

  return (
    <div
      className={`event-item ${
        event.status === "cancelled" ? "cancelled-event" : ""
      }`}
    >
      <div
        className={`event-card ${event.status}`}
        onClick={handleClick}
        style={{ cursor: event.status === "cancelled" ? "auto" : "pointer" }}
      >
        <div className="event-image-container">
          <img src={event.imageUrl} alt={event.title} loading="lazy" />
          {event.status === "cancelled" && (
            <div className="event-status-banner cancelled">CANCELLED</div>
          )}
          {event.status === "completed" && (
            <div className="event-status-banner completed">COMPLETED</div>
          )}
        </div>

        <div className="event-card-content">
          <div className="event-header">
            <h3>{event.title}</h3>
          </div>
          <p>
            🕒 {formatDateWithOrdinal(event.startTime)} -{" "}
            {formatDateWithOrdinal(event.endTime)}
          </p>
          <p>
            📍 {event.address}, {event.city}, {event.postCode}
          </p>
          <p>
            👤{" "}
            {event.genderSpecific === "all"
              ? "Everyone"
              : event.genderSpecific === "men"
              ? "Men"
              : "Women"}
          </p>
          <p className="categories">{event.categories.join(", ")}</p>
          <div className="event-price">
            {event.price == 0 ? "Free" : `£${Number(event.price).toFixed(2)}`}
          </div>
        </div>
      </div>

      <div className="event-actions-container">
        {event.status !== "cancelled" && (
          <button
            className="view-attendees-button"
            onClick={(e) => onViewAttendees(event.id, e)}
          >
            View Attendees 👤
          </button>
        )}

        {event.status === "active" && (
          <button className="edit-button" onClick={(e) => onEdit(event.id, e)}>
            Edit ✏️
          </button>
        )}

        {event.status === "active" && (
          <button
            className="cancel-event-button"
            onClick={(e) => onDelete(event, e)}
            disabled={deletingEventId === event.id}
          >
            {deletingEventId === event.id ? "Cancelling..." : "✖"}
          </button>
        )}
      </div>
    </div>
  );
});

const MyEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    itemsPerPage: 12,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [statusFilter, setStatusFilter] = useState<
    "active" | "cancelled" | "completed"
  >("active");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  const { refreshNotifications } = useNotifications();

  const navigate = useNavigate();
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/event/my-events?page=${pagination.currentPage}&limit=${pagination.itemsPerPage}&status=${statusFilter}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch events");
      }

      const { data, pagination: paginationData } = await response.json();

      const formattedEvents: Event[] = data.map((event: any) => ({
        id: event.id,
        title: event.title,
        imageUrl: event.imageUrl || "/default-event.jpg",
        categories: event.categories || [],
        status: event.status,
        startTime: event.startTime,
        endTime: event.endTime,
        address: event.address,
        city: event.city,
        postCode: event.postCode,
        attendeeCount: event.attendeeCount,
        price: event.price,
        genderSpecific: event.genderSpecific,
      }));

      setEvents(formattedEvents);
      setPagination(paginationData);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Error fetching events"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.itemsPerPage, statusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleStatusChange = useCallback(
    (status: "active" | "cancelled" | "completed") => {
      setStatusFilter(status);
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    },
    []
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, currentPage: newPage }));
  }, []);

  const handleItemsPerPageChange = useCallback((newItemsPerPage: number) => {
    setPagination((prev) => ({
      ...prev,
      itemsPerPage: newItemsPerPage,
      currentPage: 1,
    }));
  }, []);

  const handleViewAttendees = useCallback(
    (eventId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/user-dashboard/my-events/${eventId}/attendees`);
    },
    [navigate]
  );

  const openDeleteModal = useCallback((event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowDeleteModal(true);
    setError(null);
    setCancellationError("");
    setCancellationReason("");
  }, []);

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent) return;

    if (!cancellationReason.trim()) {
      setCancellationError("Please provide a cancellation reason");
      return;
    }

    setCancellationError("");
    setDeletingEventId(selectedEvent.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/my-events/${selectedEvent.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({ cancellationReason }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel event");
      }

      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
      refreshNotifications();
      setShowDeleteModal(false);
      setCancellationReason("");
      fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel event");
    } finally {
      setDeletingEventId(null);
    }
  }, [selectedEvent, cancellationReason, fetchEvents, refreshNotifications]);

  const handleEditEvent = useCallback(
    (eventId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/user-dashboard/my-events/${eventId}/edit`);
    },
    [navigate]
  );

  const PaginationControls = useMemo(() => {
    return () => (
      <div className="pagination-controls">
        <button
          onClick={() => handlePageChange(1)}
          disabled={pagination.currentPage === 1}
        >
          First
        </button>
        <button
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={!pagination.hasPreviousPage}
        >
          Previous
        </button>
        <span>
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <button
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={!pagination.hasNextPage}
        >
          Next
        </button>
        <button
          onClick={() => handlePageChange(pagination.totalPages)}
          disabled={pagination.currentPage === pagination.totalPages}
        >
          Last
        </button>
        <select
          value={pagination.itemsPerPage}
          onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
        >
          <option value="6">6 per page</option>
          <option value="12">12 per page</option>
          <option value="24">24 per page</option>
        </select>
      </div>
    );
  }, [
    pagination.currentPage,
    pagination.totalPages,
    pagination.itemsPerPage,
    pagination.hasPreviousPage,
    pagination.hasNextPage,
    handlePageChange,
    handleItemsPerPageChange,
  ]);

  return (
    <div className="my-events-container">
      <div className="my-events-header">
        <h2 className="my-events-title">My Events</h2>
        <div className="event-filter-dropdown">
          <select
            value={statusFilter}
            onChange={(e) =>
              handleStatusChange(
                e.target.value as "active" | "cancelled" | "completed"
              )
            }
            className="status-select"
          >
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <PaginationControls />
      <div className="event-results">
        {loading ? (
          <p>Loading your events...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : events.length === 0 ? (
          <div>
            <p>No events found with "{statusFilter}" status.</p>
            {statusFilter === "cancelled" && (
              <p className="cancelled-note">
                Cancelled events are cleared after 7 days.
              </p>
            )}
          </div>
        ) : (
          events.map((event) => (
            <EventItem
              key={event.id}
              event={event}
              onViewAttendees={handleViewAttendees}
              onEdit={handleEditEvent}
              onDelete={openDeleteModal}
              deletingEventId={deletingEventId}
            />
          ))
        )}
      </div>
      <PaginationControls />

      <Suspense fallback={<div>Loading modal...</div>}>
        {showDeleteModal && selectedEvent && (
          <DeleteEventModal
            eventTitle={selectedEvent.title}
            attendeeCount={selectedEvent.attendeeCount}
            price={selectedEvent.price}
            cancellationReason={cancellationReason}
            setCancellationReason={setCancellationReason}
            cancellationError={cancellationError}
            error={error}
            isDeleting={deletingEventId === selectedEvent.id}
            onConfirm={handleDeleteEvent}
            onCancel={() => setShowDeleteModal(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default memo(MyEvents);
