import React, { memo } from "react";

interface ProfilePictureModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = memo(
  ({ onConfirm, onCancel, isLoading, error }) => (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Remove Profile Picture</h3>
        <br />
        <p>Are you sure you want to remove your profile picture?</p>
        {error && <p className="error-message">{error}</p>}
        <div className="modal-buttons">
          <button
            onClick={onConfirm}
            className="confirm-button"
            disabled={isLoading}
          >
            {isLoading ? "Removing..." : "Yes, Remove"}
          </button>
          <button
            onClick={onCancel}
            className="cancel-button"
            disabled={isLoading}
          >
            Keep Picture
          </button>
        </div>
      </div>
    </div>
  )
);
