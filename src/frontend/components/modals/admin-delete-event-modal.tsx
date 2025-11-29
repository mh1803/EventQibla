import { useState } from "react";

interface AdminDeleteEventModalProps {
  eventId: string;
  eventTitle: string;
  onDelete: (eventId: string, reason: string) => Promise<void>;
}

export const AdminDeleteEventModal: React.FC<AdminDeleteEventModalProps> = ({
  eventId,
  eventTitle,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for deletion");
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(eventId, reason);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="admin-remove-event-button"
      >
        Remove Event
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Delete "{eventTitle}"</h2>
            <p>Are you sure you want to permanently delete this event?</p>

            <div className="warning-message">
              <strong>Warning:</strong> This action cannot be undone. All event
              data will be permanently removed.
            </div>

            <div className="form-group">
              <label htmlFor="deleteReason">
                Reason for deletion: <span className="red-asterisk">*</span>
              </label>
              <textarea
                id="deleteReason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError("");
                }}
                placeholder="Please explain why you're deleting this event..."
                rows={4}
                className="modal-textarea"
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <div className="modal-buttons">
              <button
                onClick={handleSubmit}
                disabled={isDeleting}
                className="confirm-button"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
