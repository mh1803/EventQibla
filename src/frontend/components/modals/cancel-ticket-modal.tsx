import React from "react";

interface CancelTicketModalProps {
  eventTitle: string;
  price: number;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}

export const CancelTicketModal: React.FC<CancelTicketModalProps> = ({
  eventTitle,
  price,
  onConfirm,
  onClose,
  loading,
  error,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Cancel Ticket</h2>
        <p>Are you sure you want to cancel your ticket for "{eventTitle}"?</p>
        {price > 0 && <p>You will receive a refund for £{price.toFixed(2)}.</p>}
        {error && <p className="error-message">{error}</p>}
        <div className="modal-buttons">
          <button
            onClick={onConfirm}
            className="confirm-button"
            disabled={loading}
          >
            {loading ? "Processing..." : "Yes, Cancel"}
          </button>
          <button
            onClick={onClose}
            className="cancel-button"
            disabled={loading}
          >
            Keep Ticket
          </button>
        </div>
      </div>
    </div>
  );
};
