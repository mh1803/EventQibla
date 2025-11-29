import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import QRCode from "react-qr-code";
import "../../../public/css/booking-confirmation.css";

interface BookingDetails {
  event: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    imageUrl: string;
    address: string;
    city: string;
    postCode: string;
    price: number;
  };
  quantity: number;
  tickets: {
    ticket_code: string;
    price: number;
  }[];
  totalPrice?: number;
}

const BookingConfirmation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingDetails = location.state?.bookingDetails as BookingDetails;

  // Handle missing booking details
  if (!bookingDetails) {
    return <div>No booking details found. Please try again.</div>;
  }

  const { event, tickets = [], quantity, totalPrice } = bookingDetails;

  // Handle missing or invalid tickets
  if (!tickets.length) {
    return <div>No tickets found. Please try again.</div>;
  }

  return (
    <div className="ticket-confirmation-page">
      <div className="thank-you-booking">
        <h1>Booking Confirmed! ✅</h1>
        <p className="event-reminder">
          You're going to <strong>{event.title}</strong> at{" "}
          <strong>{formatDateWithOrdinal(event.startTime)}</strong>.
        </p>
        {totalPrice !== undefined && totalPrice > 0 && (
          <p className="total-price">Total Paid: £{totalPrice.toFixed(2)}</p>
        )}
      </div>

      {tickets.map((ticket, index) => (
        <div key={ticket.ticket_code} className="ticket-details">
          <h2>Your Ticket #{index + 1}</h2>
          <div className="ticket-card">
            {event.imageUrl && (
              <div className="ticket-image-container">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  onError={(e) => {
                    e.currentTarget.src = "./images/default_cover.png";
                  }}
                />
              </div>
            )}
            <div className="ticket-info">
              <h3>{event.title}</h3>
              <p>
                🕒 {formatDateWithOrdinal(event.startTime)} -{" "}
                {formatDateWithOrdinal(event.endTime)}
              </p>
              <p>
                📍 {event.address}, {event.city}, {event.postCode}
              </p>
              <p>
                💷{" "}
                {ticket.price == 0
                  ? "Free"
                  : `£${Number(ticket.price).toFixed(2)}`}
              </p>
            </div>
            <div className="qr-code-container">
              <QRCode
                value={ticket.ticket_code}
                size={128}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
              <p className="qr-code-label">Scan this QR code for entry</p>
              <br />
              <p>🎟️ {ticket.ticket_code}</p>
            </div>
          </div>
        </div>
      ))}

      <button
        className="view-tickets-button"
        onClick={() => navigate("/user-dashboard")}
      >
        View My Tickets
      </button>
    </div>
  );
};

export default BookingConfirmation;
