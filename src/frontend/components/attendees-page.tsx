import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QrScanner from "qr-scanner";
import { toast } from "react-toastify";
import "../../../public/css/attendees-page.css";

interface Attendee {
  id: string;
  fullName: string;
  username: string;
  purchaseTime: string;
  status: "active" | "completed" | "cancelled";
  pricePaid: number;
  ticketCode: string;
}

interface EventDetails {
  id: number;
  title: string;
  capacity: number;
  start_time: string;
}

interface ScanError {
  code: string;
  message: string;
  details?: {
    attendee?: string;
    event?: string;
  };
  eventTitle?: string;
}

interface Pagination {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const AttendeesPage: React.FC = () => {
  const { id: eventIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  // Convert eventId to number
  const eventId = parseInt(eventIdParam || "", 10);
  if (isNaN(eventId)) {
    navigate("/events", { replace: true });
    return null;
  }

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState({
    event: true,
    attendees: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanner, setScanner] = useState<QrScanner | null>(null);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "scanning" | "success" | "error"
  >("idle");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTicketCode, setManualTicketCode] = useState("");
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(
    null
  );
  const [removalReason, setRemovalReason] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [activeTicketCount, setActiveTicketCount] = useState<number>(0);
  const [eventHasStarted, setEventHasStarted] = useState(false);

  // Fetch event details, attendees, and ticket count
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading({ event: true, attendees: true });
        setError(null);

        // Fetch event details
        const eventResponse = await fetch(
          `${API_BASE_URL}/api/event/${eventId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (!eventResponse.ok) {
          throw new Error(`Event fetch failed: HTTP ${eventResponse.status}`);
        }

        const eventData = await eventResponse.json();
        setEvent(eventData);
        setEventHasStarted(new Date(eventData.start_time) <= new Date());

        // Fetch active ticket count
        const countResponse = await fetch(
          `${API_BASE_URL}/api/event/my-events/${eventId}/attendees/count`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (countResponse.ok) {
          const countData = await countResponse.json();
          setActiveTicketCount(countData.count);
        }

        // Fetch attendees
        await fetchAttendees();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Fetch error:", err);
      } finally {
        setLoading({ event: false, attendees: false });
      }
    };

    fetchData();
  }, [eventId]);

  const fetchAttendees = async (page = 1, limit = 20) => {
    try {
      setLoading((prev) => ({ ...prev, attendees: true }));

      const response = await fetch(
        `${API_BASE_URL}/api/event/my-events/${eventId}/attendees?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Attendees fetch failed: HTTP ${response.status}`);
      }

      const data = await response.json();

      setAttendees(
        data.data.map((a: any) => ({
          ...a,
          pricePaid: parseFloat(a.pricePaid),
          status: a.status,
        }))
      );

      setPagination({
        currentPage: data.pagination.currentPage,
        itemsPerPage: data.pagination.perPage,
        totalItems: data.pagination.total,
        totalPages: data.pagination.totalPages,
        hasNextPage: data.pagination.hasNextPage,
        hasPrevPage: data.pagination.hasPrevPage,
      });
    } catch (err) {
      toast.error("Failed to load attendees");
      console.error("Fetch attendees error:", err);
    } finally {
      setLoading((prev) => ({ ...prev, attendees: false }));
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchAttendees(newPage, pagination.itemsPerPage);
    }
  };

  const handleRemoveAttendee = async () => {
    if (!selectedAttendee || !removalReason.trim()) {
      toast.error("Please provide a reason for removal");
      return;
    }

    setIsRemoving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ticket/${selectedAttendee.ticketCode}/remove-attendee`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({ removalReason }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Failed to remove attendee: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Attendee removed successfully");
        // Refresh current page after removal
        await fetchAttendees(pagination.currentPage, pagination.itemsPerPage);
        // Refresh active ticket count
        await fetchActiveTicketCount();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove attendee"
      );
      console.error("Remove attendee error:", error);
    } finally {
      setIsRemoving(false);
      setShowRemoveModal(false);
      setSelectedAttendee(null);
      setRemovalReason("");
    }
  };

  const fetchActiveTicketCount = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/${eventId}/attendees/count`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (response.ok) {
        const countData = await response.json();
        setActiveTicketCount(countData.count);
      }
    } catch (err) {
      console.error("Failed to fetch active ticket count:", err);
    }
  };

  const openRemoveModal = (attendee: Attendee) => {
    if (attendee.status === "cancelled") {
      toast.info("This attendee has already been cancelled");
      return;
    }
    if (eventHasStarted) {
      toast.error("Cannot remove attendees after event has started");
      return;
    }
    setSelectedAttendee(attendee);
    setShowRemoveModal(true);
  };

  const getErrorMessage = (error: ScanError) => {
    switch (error.code) {
      case "already_checked_in":
        return `Ticket already checked in`;
      case "ticket_cancelled":
        return `Ticket cancelled for ${error.details?.attendee || "attendee"}`;
      case "ticket_not_found":
        return "Ticket not found for this event";
      case "event_not_active":
        return `Event is not active (${error.eventTitle || "current status"})`;
      case "invalid_ticket_status":
        return "Invalid ticket status";
      default:
        return error.message || "Check-in failed";
    }
  };

  const handleCheckIn = async (ticketCode: string) => {
    try {
      setScanStatus("scanning");
      setScanError(null);

      const requestBody = {
        eventId: eventId,
      };

      const response = await fetch(
        `${API_BASE_URL}/api/ticket/${ticketCode}/scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData: ScanError = await response.json().catch(() => ({
          code: "request_failed",
          message: `Server error: ${response.status}`,
        }));

        setScanError(errorData);
        throw new Error(getErrorMessage(errorData));
      }

      const data = await response.json();
      setScanStatus("success");
      toast.success(`${data.attendee?.fullName} checked in!`);

      // Stop the scanner on success
      if (scanner) {
        scanner.stop();
      }

      // Refresh attendees and ticket count after successful check-in
      await fetchAttendees(pagination.currentPage, pagination.itemsPerPage);
      await fetchActiveTicketCount();

      // Close the scanner after delay
      setTimeout(() => {
        setShowScanner(false);
        setShowManualEntry(false);
        setManualTicketCode("");
        setScanStatus("idle");
      }, 2000);
    } catch (err) {
      setScanStatus("error");
      const message = err instanceof Error ? err.message : "Check-in failed";
      toast.error(message);
      console.error("Check-in error:", {
        error: err,
        ticketCode,
        eventId,
        time: new Date().toISOString(),
      });
    }
  };

  const handleScan = (result: string) => handleCheckIn(result);

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicketCode.trim()) {
      toast.error("Please enter a valid ticket code");
      return;
    }
    handleCheckIn(manualTicketCode.trim());
  };

  // Scanner initialisation
  useEffect(() => {
    if (showScanner && videoRef.current) {
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (scanStatus !== "success") {
            handleScan(result.data);
          }
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          maxScansPerSecond: 2,
        }
      );

      qrScanner
        .start()
        .then(() => setScanner(qrScanner))
        .catch((err) => {
          toast.error(`Camera error: ${err.message}`);
          setShowScanner(false);
        });

      return () => {
        qrScanner.stop();
        qrScanner.destroy();
      };
    }
  }, [showScanner, scanStatus]);

  const toggleScanner = () => {
    setShowScanner(!showScanner);
    setShowManualEntry(false);
    setScanStatus("idle");
    setScanError(null);
    if (scanner && !showScanner) {
      scanner.stop();
      setScanner(null);
    }
  };

  const toggleManualEntry = () => {
    setShowManualEntry(!showManualEntry);
    setShowScanner(false);
    setScanStatus("idle");
    setScanError(null);
    if (scanner) {
      scanner.stop();
      setScanner(null);
    }
  };

  const filteredAttendees = attendees.filter(
    (a) =>
      a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.ticketCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading.event || loading.attendees) {
    return <div className="loading">Loading event data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!event) {
    return <div className="error-message">Event not found</div>;
  }

  return (
    <div className="attendees-container">
      <div className="header">
        <h1>
          {event.title}
          <span className="attendee-count">
            ( {activeTicketCount} / {event.capacity} )
          </span>
        </h1>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search attendees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="checkin-buttons">
          <button
            onClick={toggleScanner}
            className={`scan-button ${showScanner ? "active-button" : ""}`}
          >
            Scan Ticket
          </button>
          <button
            onClick={toggleManualEntry}
            className={`manual-button ${
              showManualEntry ? "active-button" : ""
            }`}
          >
            Manual Check-in
          </button>
        </div>
      </div>

      {showScanner && (
        <div className="scanner-overlay">
          <div className="scanner-content">
            <video ref={videoRef} className="scanner-video" />
            <div className="scanner-frame" />
            <div className={`scan-status ${scanStatus}`}>
              {scanStatus === "scanning" && "Scanning ticket..."}
              {scanStatus === "success" && "Check-in successful!"}
              {scanStatus === "error" && (
                <div className="error-message">
                  {scanError ? getErrorMessage(scanError) : "Scan failed"}
                </div>
              )}
            </div>
          </div>
          <button onClick={toggleScanner} className="cancel-scan-button">
            Cancel
          </button>
        </div>
      )}

      {showManualEntry && (
        <div className="attendees-modal-overlay">
          <div className="attendees-modal-content">
            <h2>Manual Ticket Check-in</h2>
            <form onSubmit={handleManualCheckIn}>
              <input
                type="text"
                placeholder="Enter ticket code"
                value={manualTicketCode}
                onChange={(e) => setManualTicketCode(e.target.value)}
                autoFocus
              />
              <div className="attendees-modal-buttons">
                <button type="submit" className="attendees-submit-button">
                  Check In
                </button>
                <button
                  type="button"
                  onClick={toggleManualEntry}
                  className="attendees-cancel-button"
                >
                  Cancel
                </button>
              </div>
              <div className={`scan-status ${scanStatus}`}>
                {scanStatus === "scanning" && "Processing ticket..."}
                {scanStatus === "success" && "Check-in successful!"}
                {scanStatus === "error" && (
                  <div className="error-message">
                    {scanError ? getErrorMessage(scanError) : "Check-in failed"}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showRemoveModal && selectedAttendee && (
        <div className="attendees-modal-overlay">
          <div className="attendees-modal-content">
            <h2>Remove Attendee</h2>
            <p>
              Are you sure you want to remove{" "}
              <strong>{selectedAttendee.fullName}</strong> from this event?
            </p>
            <div className="form-group">
              <br />
              <label htmlFor="removalReason">
                Reason for removal: <span className="red-asterisk">*</span>{" "}
              </label>
              <textarea
                id="removalReason"
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                placeholder="Please provide a reason for removing this attendee..."
                required
              />
            </div>
            <div className="attendees-modal-buttons">
              <button
                onClick={handleRemoveAttendee}
                className="attendees-submit-button"
                disabled={isRemoving || !removalReason.trim()}
              >
                {isRemoving ? "Removing..." : "Confirm Removal"}
              </button>
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setRemovalReason("");
                }}
                className="attendees-cancel-button"
                disabled={isRemoving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        {filteredAttendees.length === 0 ? (
          <div className="no-results">
            {searchTerm
              ? "No matching attendees found"
              : "No attendees registered"}
          </div>
        ) : (
          <>
            <table className="attendees-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Purchase Date</th>
                  <th>Ticket Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendees.map((attendee) => (
                  <tr key={`${attendee.id}-${attendee.ticketCode}`}>
                    <td>{attendee.fullName}</td>
                    <td className="username">{attendee.username}</td>
                    <td>{formatDate(attendee.purchaseTime)}</td>
                    <td className="ticket-code">{attendee.ticketCode}</td>
                    <td>
                      <div className={`status ${attendee.status}`}>
                        {attendee.status === "completed" ? (
                          <>
                            <span className="status-icon success">✓</span>
                            <span>Checked In</span>
                          </>
                        ) : attendee.status === "cancelled" ? (
                          <>
                            <span className="status-icon cancelled">✕</span>
                            <span>Cancelled</span>
                          </>
                        ) : (
                          <>
                            <span className="status-icon active">●</span>
                            <span>Active</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {attendee.status !== "cancelled" && (
                        <button
                          onClick={() => openRemoveModal(attendee)}
                          className="remove-button"
                          title="Remove attendee"
                          disabled={eventHasStarted}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="pagination-controls">
        <button
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={!pagination.hasPrevPage || loading.attendees}
        >
          Previous
        </button>
        <span>
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <button
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={!pagination.hasNextPage || loading.attendees}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AttendeesPage;
