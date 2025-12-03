import React, {
  useState,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  memo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import { useAuth } from "../../frontend/hooks/useAuth.js";
import "../../../public/css/event-profile.css";

// Lazy loaded Modals
const FlagEventModal = lazy(() =>
  import("./modals/flag-event-modal.js").then((module) => ({
    default: module.FlagEventModal,
  }))
);

const AdminDeleteEventModal = lazy(() =>
  import("./modals/admin-delete-event-modal.js").then((module) => ({
    default: module.AdminDeleteEventModal,
  }))
);

const JoinWaitlistModal = lazy(() =>
  import("./modals/join-waitlist-modal.js").then((module) => ({
    default: module.JoinWaitlistModal,
  }))
);

const LeaveWaitlistModal = lazy(() =>
  import("./modals/leave-waitlist-modal.js").then((module) => ({
    default: module.LeaveWaitlistModal,
  }))
);

const SocialShareButton = memo(
  ({
    platform,
    icon,
    onClick,
  }: {
    platform: string;
    icon: string;
    onClick: (platform: string) => void;
  }) => (
    <button
      onClick={() => onClick(platform)}
      className={`social-button ${platform}`}
    >
      <img src={icon} alt={platform} />
    </button>
  )
);

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
  genderSpecific: string;
  categories: string[];
  price: number;
  capacity: number;
  attendeeCount: number;
  organiser: {
    profilePictureUrl: string;
    name: string;
    averageRating: number;
    reviewCount: number;
  };
  flaggedCount?: number;
}

const EventProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFlagged, setIsFlagged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isEventFull, setIsEventFull] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const [activeModal, setActiveModal] = useState<"join" | "leave" | null>(null);

  // Get user data from auth context
  const { userData } = useAuth();
  const userId = userData?.userId || null;
  const userRole = userData?.role || null;

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const socialIcons = {
    facebook: "/images/facebook.png",
    twitter: "/images/twitter.png",
    linkedin: "/images/linkedin.png",
    whatsapp: "/images/whatsapp.png",
    instagram: "/images/instagram.png",
  };

  const handleShare = useCallback(
    (platform: string) => {
      if (!event) return;

      const url = window.location.href;
      const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          url
        )}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(
          url
        )}&text=${encodeURIComponent(event.title)}`,
        linkedin: `https://www.linkedin.com/shareArticle?url=${encodeURIComponent(
          url
        )}&title=${encodeURIComponent(event.title)}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(
          `${event.title} - ${url}`
        )}`,
        instagram: "https://www.instagram.com/",
      };

      if (shareUrls[platform as keyof typeof shareUrls]) {
        window.open(shareUrls[platform as keyof typeof shareUrls], "_blank");
      }
    },
    [event]
  );

  const handleBookNow = useCallback(() => {
    navigate(`/events/${id}/booking`);
  }, [id, navigate]);

  const handleJoinWaitlist = useCallback(async () => {
    if (!id || !userId) return;

    setWaitlistLoading(true);
    setWaitlistError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/booking/${id}/waitlist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to join waitlist");

      setIsOnWaitlist(true);
      setActiveModal(null);
    } catch (error) {
      setWaitlistError(
        error instanceof Error ? error.message : "Failed to join waitlist"
      );
    } finally {
      setWaitlistLoading(false);
    }
  }, [id, userId, API_BASE_URL]);

  const handleLeaveWaitlist = useCallback(async () => {
    if (!id || !userId) return;

    setWaitlistLoading(true);
    setWaitlistError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/booking/${id}/waitlist`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to leave waitlist");

      setIsOnWaitlist(false);
      setActiveModal(null);
    } catch (error) {
      setWaitlistError(
        error instanceof Error ? error.message : "Failed to leave waitlist"
      );
    } finally {
      setWaitlistLoading(false);
    }
  }, [id, userId, API_BASE_URL]);

  const handleRemoveEvent = useCallback(
    async (eventId: string, reason: string) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/event/my-events/${eventId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
            body: JSON.stringify({ cancellationReason: reason }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to remove event");
        }

        navigate("/events", {
          state: { message: "Event removed successfully" },
        });
      } catch (error) {
        throw error;
      }
    },
    [API_BASE_URL, navigate]
  );

  const checkWaitlistStatus = useCallback(async () => {
    if (!id || !userId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/booking/${id}/waitlist`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIsOnWaitlist(data.isOnWaitlist || false);
      }
    } catch (error) {
      console.error("Error checking waitlist status:", error);
    }
  }, [id, userId, API_BASE_URL]);

  const checkEventAvailability = useCallback(async () => {
    if (!id) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/booking/${id}/availability`
      );
      if (response.ok) {
        const data = await response.json();
        setIsEventFull(data.isFullyBooked || false);
      }
    } catch (error) {
      console.error("Error checking event availability:", error);
    }
  }, [id, API_BASE_URL]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/event/${id}`);
        if (!response.ok) throw new Error("Failed to fetch event");

        const eventData = await response.json();
        setEvent(eventData);

        await Promise.all([
          checkEventAvailability(),
          userId && checkWaitlistStatus(),
        ]);
      } catch (error) {
        console.error("Error fetching event:", error);
        setError("Failed to load event details");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEvent();
  }, [id, userId, checkEventAvailability, checkWaitlistStatus, API_BASE_URL]);

  if (loading) return <p className="loading">Loading...</p>;
  if (!event || !id) return <p className="error-message">Event not found</p>;

  return (
    <div className="event-profile-container">
      <div className="event-profile">
        {/* Header section */}
        <div className="event-header">
          <h1 className="event-title">{event.title}</h1>
          <div className="header-separator"></div>
        </div>

        <div className="event-content">
          {/* Event details section*/}
          <div className="event-details-section">
            <div className="event-details">
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
              <p>
                💷{" "}
                {event.price === 0
                  ? "Free"
                  : `£${Number(event.price).toFixed(2)}`}
              </p>
              <p>👥 Capacity: {event.capacity}</p>
            </div>

            <h3>Organized by:</h3>
            <div className="organiser-section">
              <div className="organiser-info">
                <img
                  src={
                    event.organiser?.profilePictureUrl ||
                    "/images/default_profile.png"
                  }
                  alt="organiser"
                  className="organiser-avatar"
                  loading="lazy"
                />
                <div className="organiser-details">
                  <h3>{event.organiser?.name || "Unknown"}</h3>
                  <div className="organiser-rating">
                    <span className="stars">
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <span
                            key={i}
                            className={
                              i <
                              Math.floor(event.organiser?.averageRating || 0)
                                ? "filled"
                                : ""
                            }
                          >
                            ★
                          </span>
                        ))}
                    </span>
                    <span className="rating-text">
                      {event.organiser?.averageRating || "0.0"} (
                      {event.organiser?.reviewCount || 0} reviews)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event image section */}
          <div className="event-image-section">
            <div className="event-image">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="event-image"
                loading="lazy"
              />
            </div>

            <div className="image-actions">
              <div className="social-sharing">
                {Object.entries(socialIcons).map(([platform, icon]) => (
                  <SocialShareButton
                    key={platform}
                    platform={platform}
                    icon={icon}
                    onClick={handleShare}
                  />
                ))}
              </div>

              <div className="booking-actions">
                {isEventFull ? (
                  isOnWaitlist ? (
                    <button
                      onClick={() => setActiveModal("leave")}
                      className="leave-waitlist-button"
                    >
                      On Waitlist - Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveModal("join")}
                      className="notify-me-button"
                    >
                      Notify Me
                    </button>
                  )
                ) : (
                  <button onClick={handleBookNow} className="book-now-button">
                    Book Now
                  </button>
                )}
                <div className="flag-button-container">
                  <Suspense>
                    <FlagEventModal
                      eventId={id}
                      isFlagged={isFlagged}
                      setIsFlagged={setIsFlagged}
                      setEvent={setEvent}
                    />
                  </Suspense>
                </div>
              </div>

              {userRole === "admin" && (
                <div className="admin-button-container">
                  <Suspense>
                    <AdminDeleteEventModal
                      eventId={id}
                      eventTitle={event.title}
                      onDelete={handleRemoveEvent}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description section */}
        <div className="description-section">
          <div className="description-separator"></div>
          <h3 className="description-title">About the Event</h3>
          <p className="description">{event.description}</p>
        </div>
      </div>

      {/* Lazy-loaded Modals */}
      {activeModal === "join" && (
        <Suspense>
          <JoinWaitlistModal
            eventTitle={event.title}
            onConfirm={handleJoinWaitlist}
            onCancel={() => setActiveModal(null)}
            isLoading={waitlistLoading}
            error={waitlistError}
          />
        </Suspense>
      )}

      {activeModal === "leave" && (
        <Suspense>
          <LeaveWaitlistModal
            eventTitle={event.title}
            onConfirm={handleLeaveWaitlist}
            onCancel={() => setActiveModal(null)}
            isLoading={waitlistLoading}
            error={waitlistError}
          />
        </Suspense>
      )}

      {error && (
        <div className="error-modal">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default EventProfile;
