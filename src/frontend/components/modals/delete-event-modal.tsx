import React, { memo } from "react";

interface DeleteEventModalProps {
  eventTitle: string;
  attendeeCount: number;
  price: number;
  cancellationReason: string;
  setCancellationReason: (reason: string) => void;
  cancellationError: string;
  error: string | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteEventModal: React.FC<DeleteEventModalProps> = memo(
  ({
    eventTitle,
    attendeeCount,
    price,
    cancellationReason,
    setCancellationReason,
    cancellationError,
    error,
    isDeleting,
    onConfirm,
    onCancel,
  }) => (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Cancel Event</h2>
        <p>Are you sure you want to cancel your event "{eventTitle}"?</p>
        {attendeeCount > 0 && (
          <p className="warning-message">
            <strong>Warning</strong>: This event has {attendeeCount}{" "}
            {attendeeCount === 1 ? "attendee" : "attendees"} who will be
            notified.
            {price > 0 && " All payments will be refunded."}
          </p>
        )}

        <div className="cancellation-reason">
          <label htmlFor="cancellationReason">
            Cancellation Reason: <span className="red-asterisk">*</span>
          </label>
          <textarea
            id="cancellationReason"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Please explain why you're cancelling this event..."
            rows={4}
          />
          {cancellationError && (
            <p className="error-message">{cancellationError}</p>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}
        <div className="modal-buttons">
          <button
            onClick={onConfirm}
            className="confirm-button"
            disabled={isDeleting}
          >
            {isDeleting ? "Cancelling..." : "Confirm Cancellation"}
          </button>
          <button
            onClick={onCancel}
            className="cancel-button"
            disabled={isDeleting}
          >
            Keep Event
          </button>
        </div>
      </div>
    </div>
  )
);
