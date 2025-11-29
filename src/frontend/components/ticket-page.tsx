import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import QRCode from "react-qr-code";
import "../../../public/css/booking-confirmation.css";

interface Ticket {
  id: string;
  eventTitle: string;
  ticketCode: string;
  status: "active" | "cancelled" | "complete";
  price: number;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  city: string;
  postCode: string;
  imageUrl?: string;
}

const TicketPage: React.FC = () => {
  const { ticketCode } = useParams<{ ticketCode: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        if (!ticketCode) {
          throw new Error("No ticket code provided");
        }

        setLoading(true);
        setError(null);
        const response = await fetch(
          `${API_BASE_URL}/api/ticket/${ticketCode}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Ticket not found"
              : "Failed to load ticket"
          );
        }

        const data = await response.json();
        setTicket(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ticket");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketCode]);

  if (loading) {
    return <div className="ticket-loading">Loading ticket details...</div>;
  }

  if (error) {
    return <div className="ticket-error">Error: {error}</div>;
  }

  if (!ticket) {
    return <div className="ticket-not-found">Ticket not found</div>;
  }

  return (
    <div className="ticket-confirmation-page">
      <h2>Your Ticket</h2>

      <div className="ticket-details">
        <div className="ticket-card">
          {ticket.imageUrl && (
            <div className="ticket-image-container">
              <img
                src={ticket.imageUrl}
                alt={ticket.eventTitle}
                onError={(e) => {
                  e.currentTarget.src = "./images/default_cover.png";
                }}
              />
            </div>
          )}
          <div className="ticket-info">
            <h3>{ticket.eventTitle}</h3>
            <p>
              🕒 {formatDateWithOrdinal(ticket.startTime)} -
              {formatDateWithOrdinal(ticket.endTime)}
            </p>
            <p>
              📍 {ticket.location}
              {ticket.address && `, ${ticket.address}`}
              {ticket.city && `, ${ticket.city}`}
              {ticket.postCode && `, ${ticket.postCode}`}
            </p>
            <p>
              💷{" "}
              {ticket.price === 0
                ? "Free"
                : `£${Number(ticket.price).toFixed(2)}`}
            </p>
          </div>
          <div className="qr-code-container">
            <QRCode
              value={ticket.ticketCode}
              size={128}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
            />
            <p className="qr-code-label">Scan this QR code for entry</p>
            <p className="ticket-code">🎟️ {ticket.ticketCode}</p>
          </div>
        </div>
      </div>

      <div className="ticket-actions">
        <button
          className="view-tickets-button"
          onClick={() => navigate("/user-dashboard")}
        >
          Back to My Tickets
        </button>
      </div>
    </div>
  );
};

export default TicketPage;
