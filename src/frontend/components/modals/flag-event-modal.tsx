import React, { useState, useEffect, useCallback, memo } from "react";

interface FlagEventModalProps {
  eventId: string;
  isFlagged: boolean;
  setIsFlagged: (flagged: boolean) => void;
  setEvent: (event: any) => void;
}

export const FlagEventModal: React.FC<FlagEventModalProps> = memo(
  ({ eventId, isFlagged, setIsFlagged, setEvent }) => {
    const [showFlagModal, setShowFlagModal] = useState(false);
    const [modalContent, setModalContent] = useState<
      "confirm" | "success" | "login"
    >("confirm");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const API_BASE_URL =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

    // Check if the user has already flagged the event
    useEffect(() => {
      const token = localStorage.getItem("authToken");

      if (!token) {
        setLoading(false);
        return;
      }

      const checkIfFlagged = async () => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/event/flag/${eventId}/check-flag`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error("Failed to check flag status");
          }

          const data = await response.json();
          setIsFlagged(data.isFlagged);
        } catch (error) {
          console.error("Error checking flag status:", error);
          setError(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred"
          );
        } finally {
          setLoading(false);
        }
      };

      checkIfFlagged();
    }, [eventId, setIsFlagged]);

    const handleFlagClick = useCallback(() => {
      setShowFlagModal(true);
      setModalContent("confirm");
      setError(null);
    }, []);

    const handleFlagEvent = useCallback(async () => {
      const token = localStorage.getItem("authToken");

      if (!token) {
        setModalContent("login");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/event/flag/${eventId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to flag event");
        }

        const result = await response.json();
        console.log("Flagged event:", result);

        setEvent((prevEvent: any) => ({
          ...prevEvent,
          flagged_count: (prevEvent.flagged_count || 0) + 1,
        }));

        setIsFlagged(true);
        setModalContent("success");
      } catch (error) {
        console.error("Error flagging event:", error);
        setError(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred"
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [eventId, API_BASE_URL, setEvent, setIsFlagged]);

    const handleUnflag = useCallback(async () => {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/event/flag/${eventId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to remove flag");
        }

        setEvent((prevEvent: any) => ({
          ...prevEvent,
          flagged_count: Math.max(0, (prevEvent.flagged_count || 0) - 1),
        }));
        setIsFlagged(false);
      } catch (error) {
        console.error("Error unflagging event:", error);
        setError(
          error instanceof Error ? error.message : "Failed to remove flag"
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [eventId, API_BASE_URL, setEvent, setIsFlagged]);

    if (loading) {
      return <div className="loading">Loading...</div>;
    }

    return (
      <>
        <div className="flag-button-container">
          <img
            src={
              isFlagged
                ? "/images/disabled-report-flag.png"
                : "/images/report-flag.png"
            }
            alt="Flag Event"
            className={`flag-button ${isFlagged ? "flagged" : ""}`}
            onClick={isFlagged ? handleUnflag : handleFlagClick}
            style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
          />
        </div>

        {/* Flag Confirmation Modal */}
        {showFlagModal && (
          <div className="modal-overlay">
            <div className="modal">
              {modalContent === "confirm" && (
                <>
                  <h2>Report Event</h2>
                  <p>Are you sure you want to report this event?</p>
                  {error && <p className="error-message">{error}</p>}
                  <div className="modal-buttons">
                    <button
                      onClick={handleFlagEvent}
                      className="confirm-button"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Reporting..." : "Yes, Report"}
                    </button>
                    <button
                      onClick={() => setShowFlagModal(false)}
                      className="cancel-button"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {modalContent === "success" && (
                <>
                  <h2>Thank You!</h2>
                  <p>Thank you for helping keep our platform safe!</p>
                  <button
                    onClick={() => setShowFlagModal(false)}
                    className="confirm-button"
                  >
                    Close
                  </button>
                </>
              )}
              {modalContent === "login" && (
                <>
                  <h2>Login Required</h2>
                  <p>You must be logged in to report an event.</p>
                  <button
                    onClick={() => setShowFlagModal(false)}
                    className="confirm-button"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }
);
