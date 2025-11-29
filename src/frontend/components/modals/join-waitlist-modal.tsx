import React from "react";

interface JoinWaitlistModalProps {
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

export const JoinWaitlistModal: React.FC<JoinWaitlistModalProps> = ({
  eventTitle,
  onConfirm,
  onCancel,
  isLoading,
  error,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Join Waitlist</h2>
        <p>
          "{eventTitle}" is currently full. Would you like to be notified if a
          spot becomes available?
        </p>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-buttons">
          <button
            onClick={onConfirm}
            className="confirm-button"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Yes, Notify Me"}
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
