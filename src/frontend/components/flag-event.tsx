import React, { useState, useEffect } from "react";

interface FlagEventProps {
  eventId: string;
  isFlagged: boolean;
  setIsFlagged: (flagged: boolean) => void;
  setEvent: (event: any) => void;
}

const FlagEvent: React.FC<FlagEventProps> = ({
  eventId,
  isFlagged,
  setIsFlagged,
  setEvent,
}) => {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [modalContent, setModalContent] = useState<
    "confirm" | "success" | "login"
  >("confirm");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleFlagEvent = async () => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      setModalContent("login");
      return;
    }

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
        flagged_count: prevEvent.flagged_count + 1,
      }));

      setIsFlagged(true);
      setModalContent("success");
      setError(null);
    } catch (error) {
      console.error("Error flagging event:", error);
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    }
  };

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
          onClick={() => {
            if (!isFlagged) {
              setShowFlagModal(true);
              setModalContent("confirm");
            }
          }}
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
                  <button onClick={handleFlagEvent} className="confirm-button">
                    Yes, Report
                  </button>
                  <button
                    onClick={() => setShowFlagModal(false)}
                    className="cancel-button"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
            {modalContent === "success" && (
              <>
                <h2>Thank You!</h2>
                <p>Thank you for helping keep EventQibla safe!</p>
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
};

export default FlagEvent;
