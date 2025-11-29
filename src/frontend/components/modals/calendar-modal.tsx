import React from "react";

interface CalendarModalProps {
  startTime: string;
  endTime: string;
  location: string;
  ticketCode: string;
  onClose: () => void;
  onGoogleClick: () => void;
  onOutlookClick: () => void;
  onAppleClick: () => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  onClose,
  onGoogleClick,
  onOutlookClick,
  onAppleClick,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add to Calendar</h2>
        <p>Choose your calendar service:</p>
        <div className="calendar-options">
          <button
            className="calendar-service-button google"
            onClick={onGoogleClick}
          >
            <span className="icon-wrapper">
              <img
                src="/images/google-calendar.png"
                alt="Google Calendar"
                className="calendar-icon"
              />
            </span>
            Google Calendar
          </button>
          <button
            className="calendar-service-button outlook"
            onClick={onOutlookClick}
          >
            <span className="icon-wrapper">
              <img
                src="/images/outlook-calendar.png"
                alt="Outlook Calendar"
                className="calendar-icon"
              />
            </span>
            Outlook Calendar
          </button>
          <button
            className="calendar-service-button apple"
            onClick={onAppleClick}
          >
            <span className="icon-wrapper">
              <img
                src="/images/apple-calendar.png"
                alt="Apple Calendar"
                className="calendar-icon"
              />
            </span>
            Apple Calendar
          </button>
        </div>
        <div className="modal-buttons">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
