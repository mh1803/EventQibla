import React from "react";

interface LeaveWaitlistModalProps {
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

export const LeaveWaitlistModal: React.FC<LeaveWaitlistModalProps> = ({
  eventTitle,
  onConfirm,
  onCancel,
  isLoading,
  error,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Leave Waitlist</h2>
        <p>Are you sure you want to leave the waitlist for "{eventTitle}"?</p>
        <p>You won't be notified if spots become available.</p>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-buttons">
          <button
            onClick={onConfirm}
            className="confirm-button"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Yes, Leave Waitlist"}
          </button>
          <button
            onClick={onCancel}
            className="cancel-button"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
