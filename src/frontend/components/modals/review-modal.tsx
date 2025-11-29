import React from "react";

interface ReviewModalProps {
  eventTitle: string;
  rating: number;
  hoverRating: number;
  error: string | null;
  isSubmitting: boolean;
  onStarClick: (rating: number) => void;
  onStarHover: (rating: number) => void;
  onStarLeave: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  eventTitle,
  rating,
  hoverRating,
  error,
  isSubmitting,
  onStarClick,
  onStarHover,
  onStarLeave,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="review-modal-overlay">
      <div className="review-modal">
        <h2>Review Event</h2>
        <p>How would you rate "{eventTitle}"?</p>

        <div className="star-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`star ${
                star <= (hoverRating || rating) ? "filled" : ""
              }`}
              onClick={() => onStarClick(star)}
              onMouseEnter={() => onStarHover(star)}
              onMouseLeave={onStarLeave}
            >
              ★
            </span>
          ))}
        </div>
        {error && <p className="error-message">{error}</p>}

        <div className="modal-buttons">
          <button
            className="submit-button"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </button>
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
