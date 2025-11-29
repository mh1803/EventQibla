import React, {
  useState,
  useEffect,
  Suspense,
  lazy,
  LazyExoticComponent,
  FunctionComponent,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../../../public/css/event-booking.css";
import "../../../public/css/event-results.css";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import { useNotifications } from "../context/NotificationContext.js";

interface PaymentDetails {
  bankCard: string;
  expirationDate: string;
  cvc: string;
  zipCode: string;
}

interface PaymentErrors {
  bankCard: string;
  expirationDate: string;
  cvc: string;
  zipCode: string;
}

interface PaymentFormProps {
  disabled: boolean;
  onDetailsChange: (details: PaymentDetails) => void;
  onErrorsChange: (errors: PaymentErrors) => void;
}

const PaymentForm = lazy(() =>
  import("./payment-form").then((module) => ({
    default: module.PaymentForm,
  }))
) as LazyExoticComponent<FunctionComponent<PaymentFormProps>>;

interface Event {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  startTime: string;
  endTime: string;
  address: string;
  city: string;
  postCode: string;
  genderSpecific: "all" | "men" | "women";
  categories: string[];
  price: number;
  capacity: number;
  flaggedCount?: number;
}

interface BookingRequest {
  pricePaid: number;
  quantity: number;
  bank_card?: string;
  expiration_date?: string;
  cvc?: string;
  zip_code?: string;
}

interface BookingConfirmationState {
  bookingDetails: {
    id: string;
    eventId: string;
    userId: string;
    quantity: number;
    pricePaid: number;
    createdAt: string;
    event: Event;
  };
}

const EventBooking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refreshNotifications } = useNotifications();

  // State for event details
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // State for number of tickets
  const [ticketCount, setTicketCount] = useState<number>(1);

  // Memoized total price calculation
  const totalPrice = useMemo(() => {
    return event ? event.price * ticketCount : 0;
  }, [event, ticketCount]);

  // State for payment details
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    bankCard: "",
    expirationDate: "",
    cvc: "",
    zipCode: "",
  });

  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({
    bankCard: "",
    expirationDate: "",
    cvc: "",
    zipCode: "",
  });

  // State for booking process
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState<boolean>(false);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  // Memoized callbacks
  const handlePaymentDetailsChange = useCallback(
    (newDetails: PaymentDetails): void => {
      setPaymentDetails(newDetails);
    },
    []
  );

  const handlePaymentErrorsChange = useCallback(
    (errors: PaymentErrors): void => {
      setPaymentErrors(errors);
    },
    []
  );

  // Fetch event details from the backend
  useEffect(() => {
    let isMounted = true;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/event/${id}`);
        if (!isMounted) return;

        if (!response.ok) {
          throw new Error("Failed to fetch event details");
        }

        const data: Event = await response.json();
        if (isMounted) {
          setEvent(data);
        }
      } catch (err) {
        if (isMounted) {
          setEventError("Failed to retrieve event. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEvent();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Handle incrementing ticket count
  const incrementTicketCount = (): void => {
    if (event && ticketCount < event.capacity) {
      setTicketCount(ticketCount + 1);
    }
  };

  // Handle decrementing ticket count
  const decrementTicketCount = (): void => {
    if (event && ticketCount > 1) {
      setTicketCount(ticketCount - 1);
    }
  };

  // Validate payment form
  const validatePaymentForm = (): boolean => {
    if (event?.price === 0) return true;

    const hasErrors = Object.values(paymentErrors).some(
      (error) => error !== ""
    );
    const allFieldsFilled = Object.values(paymentDetails).every(
      (field) => field.trim() !== ""
    );

    return !hasErrors && allFieldsFilled;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!event) return;

    // Validate payment form for paid events
    if (event.price > 0 && !validatePaymentForm()) {
      setBookingError("Please fill in all payment details correctly");
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setBookingError("You must be logged in to book tickets.");
        navigate("/login");
        return;
      }

      const requestBody: BookingRequest = {
        pricePaid: totalPrice,
        quantity: ticketCount,
      };

      if (event.price > 0) {
        requestBody.bank_card = paymentDetails.bankCard.replace(/\s/g, "");
        requestBody.expiration_date = paymentDetails.expirationDate;
        requestBody.cvc = paymentDetails.cvc;
        requestBody.zip_code = paymentDetails.zipCode;
      }

      const response = await fetch(`${API_BASE_URL}/api/event/booking/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      refreshNotifications();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to book tickets");
      }

      const data = await response.json();
      navigate(`/events/${id}/booking/confirmation`, {
        state: {
          bookingDetails: { ...data, event },
        } as BookingConfirmationState,
      });
    } catch (err) {
      console.error("Error booking tickets:", err);
      setBookingError(
        err instanceof Error
          ? err.message
          : "Failed to book tickets. Please try again."
      );
    } finally {
      setIsBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading">Loading event details...</p>
      </div>
    );
  }

  if (eventError) {
    return <div className="error-message">{eventError}</div>;
  }

  if (!event) {
    return <div className="error-message">Event not found</div>;
  }

  return (
    <div className="booking-page">
      <h1>Checkout</h1>

      <div className="event-card">
        {event.imageUrl ? (
          <div className="event-image-container">
            <img src={event.imageUrl} alt={event.title} />
          </div>
        ) : (
          <div className="event-image-container">No Image Available</div>
        )}

        <div className="event-card-content">
          <h3>{event.title}</h3>
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
            {event.price === 0 ? "Free" : `£${Number(event.price).toFixed(2)}`}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="booking-form">
        <div className="form-group">
          <label htmlFor="ticketCount">Number of Tickets:</label>
          <div className="ticket-count-controls">
            <button
              type="button"
              className="ticket-count-button"
              onClick={decrementTicketCount}
              disabled={ticketCount <= 1 || isBooking}
            >
              -
            </button>
            <span className="ticket-count">{ticketCount}</span>
            <button
              type="button"
              className="ticket-count-button"
              onClick={incrementTicketCount}
              disabled={!event || ticketCount >= event.capacity || isBooking}
            >
              +
            </button>
          </div>
          {ticketCount > event.capacity && (
            <p className="error-message">
              Number of tickets cannot exceed {event.capacity}
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Total Price:</label>
          <p>{totalPrice === 0 ? "Free" : `£${totalPrice.toFixed(2)}`}</p>
        </div>

        {event.price > 0 && (
          <Suspense
            fallback={
              <div className="loading-placeholder">Loading payment form...</div>
            }
          >
            <PaymentForm
              disabled={isBooking}
              onDetailsChange={handlePaymentDetailsChange}
              onErrorsChange={handlePaymentErrorsChange}
            />
          </Suspense>
        )}

        {bookingError && <p className="error-message">{bookingError}</p>}

        <button type="submit" className="submit-button" disabled={isBooking}>
          {isBooking ? (
            <>
              <span className="button-spinner"></span>
              Processing...
            </>
          ) : (
            "Confirm Booking"
          )}
        </button>
      </form>
    </div>
  );
};

export default EventBooking;
