import React, {
  useState,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import "../../../public/css/my-tickets.css";
import "../../../public/css/review-modal.css";
import { useNotifications } from "../context/NotificationContext.js";

interface Ticket {
  id: string;
  eventTitle: string;
  ticketCode: string;
  status: "active" | "cancelled" | "completed";
  price: number;
  startTime: string;
  endTime: string;
  location: string;
  imageUrl?: string;
  organiserId: number;
  eventId: number;
}

// Lazy-loaded modal
const CancelTicketModal = lazy(() =>
  import("./modals/cancel-ticket-modal.js").then((module) => ({
    default: module.CancelTicketModal as React.FC<{
      eventTitle: string;
      price: number;
      onConfirm: () => void;
      onClose: () => void;
      loading: boolean;
      error: string | null;
    }>,
  }))
);

const ReviewModal = lazy(() =>
  import("./modals/review-modal.js").then((module) => ({
    default: module.ReviewModal as React.FC<{
      eventTitle: string;
      rating: number;
      hoverRating: number;
      error: string | null;
      isSubmitting: boolean;
      onStarClick: (rating: number) => void;
      onStarHover: (rating: number) => void;
      onStarLeave: () => void;
      onSubmit: () => void;
      onClose: () => void;
    }>,
  }))
);

const CalendarModal = lazy(() =>
  import("./modals/calendar-modal.js").then((module) => ({
    default: module.CalendarModal as React.FC<{
      eventTitle: string;
      startTime: string;
      endTime: string;
      location: string;
      ticketCode: string;
      onClose: () => void;
      onGoogleClick: () => void;
      onOutlookClick: () => void;
      onAppleClick: () => void;
    }>,
  }))
);

const TicketItem = memo(
  ({
    ticket,
    onClick,
    onCalendar,
    onCancel,
    onReview,
    cancellingCode,
  }: {
    ticket: Ticket;
    onClick: (ticket: Ticket) => void;
    onCalendar: (ticket: Ticket, e: React.MouseEvent) => void;
    onCancel: (ticket: Ticket, e: React.MouseEvent) => void;
    onReview: (ticket: Ticket, e: React.MouseEvent) => void;
    cancellingCode: string | null;
  }) => (
    <div
      className={`my-tickets-details ${
        ticket.status !== "cancelled" ? "clickable-ticket" : "cancelled ticket"
      }`}
      onClick={() => onClick(ticket)}
    >
      <div className="my-tickets-card">
        <div className="my-tickets-info">
          <h3>{ticket.eventTitle}</h3>
          <p>
            🕒 {formatDateWithOrdinal(ticket.startTime)} -{" "}
            {formatDateWithOrdinal(ticket.endTime)}
          </p>
          <p>📍 {ticket.location}</p>
          <p>
            💷 {ticket.price === 0 ? "Free" : `£${ticket.price.toFixed(2)}`}
          </p>
        </div>
        <div className="ticket-actions">
          {ticket.status === "active" && (
            <>
              <button
                className="calendar-button"
                onClick={(e) => onCalendar(ticket, e)}
                title="Add to Calendar"
              >
                📅
              </button>
              <button
                className="cancel-ticket-button"
                onClick={(e) => onCancel(ticket, e)}
                disabled={cancellingCode === ticket.ticketCode}
                title="Cancel Ticket"
              >
                {cancellingCode === ticket.ticketCode ? "Cancelling..." : "✖"}
              </button>
            </>
          )}
          {ticket.status === "completed" && (
            <button
              className="review-button"
              onClick={(e) => onReview(ticket, e)}
              title="Review Event"
            >
              ★ Review
            </button>
          )}
        </div>
      </div>
    </div>
  )
);

const MyTickets: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "active" | "cancelled" | "completed"
  >("active");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCancelTicketModal, setShowCancelTicketModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const { refreshNotifications } = useNotifications();
  const navigate = useNavigate();
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/ticket/my-tickets?status=${statusFilter}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch tickets");
      }

      const data = await response.json();
      const formattedTickets = data.map((ticket: any) => ({
        id: ticket.id,
        eventTitle: ticket.eventTitle,
        ticketCode: ticket.ticketCode,
        status: ["active", "cancelled", "completed"].includes(ticket.status)
          ? ticket.status
          : "active",
        price: Number(ticket.price),
        startTime: ticket.startTime,
        endTime: ticket.endTime,
        location: ticket.location,
        imageUrl: ticket.imageUrl,
        organiserId: ticket.organiserId,
        eventId: ticket.eventId,
      }));
      setTickets(formattedTickets);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Error fetching tickets"
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, API_BASE_URL]);

  // Initial fetch and refresh when status filter changes
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleStatusChange = useCallback(
    (status: "active" | "cancelled" | "completed") => {
      setStatusFilter(status);
    },
    []
  );

  const handleTicketClick = useCallback(
    (ticket: Ticket) => {
      if (ticket.status !== "cancelled") {
        navigate(`/user-dashboard/ticket/${ticket.ticketCode}`);
      }
    },
    [navigate]
  );

  const handleAddToCalendar = useCallback(
    (ticket: Ticket, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedTicket(ticket);
      setShowCalendarModal(true);
    },
    []
  );

  const openCancelTicketModal = useCallback(
    (ticket: Ticket, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedTicket(ticket);
      setShowCancelTicketModal(true);
      setError(null);
    },
    []
  );

  const handleReviewEvent = useCallback(
    (ticket: Ticket, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedTicket(ticket);
      setShowReviewModal(true);
      setReviewRating(0);
      setHoverRating(0);
      setReviewError(null);
    },
    []
  );

  const handleCancelTicket = useCallback(async () => {
    if (!selectedTicket) return;

    setCancellingCode(selectedTicket.ticketCode);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ticket/${selectedTicket.ticketCode}/cancel`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel ticket");
      }

      // Refresh tickets after successful cancellation
      await fetchTickets();
      refreshNotifications();
      setShowCancelTicketModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel ticket");
    } finally {
      setCancellingCode(null);
    }
  }, [selectedTicket, fetchTickets, refreshNotifications, API_BASE_URL]);

  const submitReview = useCallback(async () => {
    if (!selectedTicket || reviewRating === 0) {
      setReviewError("Please select a rating");
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/user/${selectedTicket.organiserId}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({
            rating: reviewRating,
            organiserId: Number(selectedTicket.organiserId),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit review");
      }

      setShowReviewModal(false);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Failed to submit review"
      );
    } finally {
      setIsSubmittingReview(false);
    }
  }, [selectedTicket, reviewRating, API_BASE_URL]);

  return (
    <div className="my-tickets-container">
      <div className="my-tickets-header">
        <h2 className="my-tickets-title">My Tickets</h2>
        <div className="ticket-filter-dropdown">
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

      <div className="my-tickets-results">
        {loading ? (
          <p>Loading your tickets...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : (
          <div className="my-tickets-list">
            {tickets.length === 0 ? (
              <div>
                <p>No tickets found with "{statusFilter}" status.</p>
                {statusFilter === "cancelled" && (
                  <p className="cancelled-note">
                    Cancelled tickets are cleared after 7 days.
                  </p>
                )}
              </div>
            ) : (
              tickets.map((ticket) => (
                <TicketItem
                  key={ticket.ticketCode}
                  ticket={ticket}
                  onClick={handleTicketClick}
                  onCalendar={handleAddToCalendar}
                  onCancel={openCancelTicketModal}
                  onReview={handleReviewEvent}
                  cancellingCode={cancellingCode}
                />
              ))
            )}
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        {showCancelTicketModal && selectedTicket && (
          <CancelTicketModal
            eventTitle={selectedTicket.eventTitle}
            price={selectedTicket.price}
            onConfirm={handleCancelTicket}
            onClose={() => setShowCancelTicketModal(false)}
            loading={cancellingCode === selectedTicket.ticketCode}
            error={error}
          />
        )}

        {showReviewModal && selectedTicket && (
          <ReviewModal
            eventTitle={selectedTicket.eventTitle}
            rating={reviewRating}
            hoverRating={hoverRating}
            error={reviewError}
            isSubmitting={isSubmittingReview}
            onStarClick={setReviewRating}
            onStarHover={setHoverRating}
            onStarLeave={() => setHoverRating(0)}
            onSubmit={submitReview}
            onClose={() => setShowReviewModal(false)}
          />
        )}

        {showCalendarModal && selectedTicket && (
          <CalendarModal
            eventTitle={selectedTicket.eventTitle}
            startTime={selectedTicket.startTime}
            endTime={selectedTicket.endTime}
            location={selectedTicket.location}
            ticketCode={selectedTicket.ticketCode}
            onClose={() => setShowCalendarModal(false)}
            onGoogleClick={() => {
              window.open(
                `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                  selectedTicket.eventTitle
                )}&dates=${new Date(selectedTicket.startTime)
                  .toISOString()
                  .replace(/-|:|\.\d+/g, "")}/${new Date(selectedTicket.endTime)
                  .toISOString()
                  .replace(/-|:|\.\d+/g, "")}&details=${encodeURIComponent(
                  `Ticket Code: ${selectedTicket.ticketCode}`
                )}&location=${encodeURIComponent(selectedTicket.location)}`,
                "_blank"
              );
              setShowCalendarModal(false);
            }}
            onOutlookClick={() => {
              window.open(
                `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
                  selectedTicket.eventTitle
                )}&startdt=${new Date(
                  selectedTicket.startTime
                ).toISOString()}&enddt=${new Date(
                  selectedTicket.endTime
                ).toISOString()}&body=${encodeURIComponent(
                  `Ticket Code: ${selectedTicket.ticketCode}`
                )}&location=${encodeURIComponent(selectedTicket.location)}`,
                "_blank"
              );
              setShowCalendarModal(false);
            }}
            onAppleClick={() => {
              const icsContent = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "BEGIN:VEVENT",
                `SUMMARY:${selectedTicket.eventTitle}`,
                `DTSTART:${new Date(selectedTicket.startTime)
                  .toISOString()
                  .replace(/-|:|\.\d+/g, "")}`,
                `DTEND:${new Date(selectedTicket.endTime)
                  .toISOString()
                  .replace(/-|:|\.\d+/g, "")}`,
                `DESCRIPTION:Ticket Code: ${selectedTicket.ticketCode}`,
                `LOCATION:${selectedTicket.location}`,
                "END:VEVENT",
                "END:VCALENDAR",
              ].join("\n");

              const link = document.createElement("a");
              link.href = `data:text/calendar;charset=utf8,${encodeURIComponent(
                icsContent
              )}`;
              link.setAttribute("download", `${selectedTicket.eventTitle}.ics`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setShowCalendarModal(false);
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

export default MyTickets;
