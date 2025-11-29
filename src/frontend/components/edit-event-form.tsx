import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../../../public/css/event-form.css";

interface EventFormData {
  title: string;
  description: string;
  image: string | null;
  startTime: string;
  endTime: string;
  address: string;
  city: string;
  postCode: string;
  latitude: number | null;
  longitude: number | null;
  price: string;
  capacity: string;
  genderSpecific: "all" | "men" | "women";
  categories: string[];
}

const DEFAULT_IMAGE_URL = "/images/default_cover.png";
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

const EditEventForm = () => {
  const { id: eventId } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    image: null,
    startTime: "",
    endTime: "",
    address: "",
    city: "",
    postCode: "",
    latitude: null,
    longitude: null,
    price: "0",
    capacity: "",
    genderSpecific: "all",
    categories: [],
  });

  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [cityError, setCityError] = useState<string | null>(null);
  const [currentTickets, setCurrentTickets] = useState(0);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const categoriesList: string[] = [
    "Lecture",
    "Charity",
    "Study Group",
    "Social",
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const jwt = localStorage.getItem("authToken");
    if (!jwt) {
      navigate("/login");
      return;
    }

    const fetchEventData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/event/my-events/edit-event/${eventId}`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch event data");
        }

        const data = await response.json();

        const ticketsResponse = await fetch(
          `${API_BASE_URL}/api/event/my-events/${eventId}/attendees/count`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }
        );
        const ticketsData = await ticketsResponse.json();
        setCurrentTickets(ticketsData.count);

        // Convert UTC times to local time
        const startTimeLocal = new Date(data.start_time);
        const endTimeLocal = new Date(data.end_time);

        // Format for datetime-local input (YYYY-MM-DDTHH:MM)
        const formatLocal = (date: Date) => {
          const pad = (num: number) => num.toString().padStart(2, "0");
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
            date.getDate()
          )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        setFormData({
          title: data.title,
          description: data.description,
          image: data.image_url,
          startTime: formatLocal(startTimeLocal),
          endTime: formatLocal(endTimeLocal),
          address: data.address,
          city: data.city,
          postCode: data.post_code,
          latitude: data.latitude,
          longitude: data.longitude,
          price: data.price.toString(),
          capacity: data.capacity.toString(),
          genderSpecific: data.gender_specific,
          categories: data.categories || [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setIsFetching(false);
      }
    };

    fetchEventData();
  }, [eventId, navigate]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "categories") {
      const select = e.target as HTMLSelectElement;
      const selectedCategories = Array.from(
        select.selectedOptions,
        (option) => option.value
      );
      setFormData((prevData) => ({
        ...prevData,
        categories: selectedCategories,
      }));
    } else {
      setFormData((prevData) => {
        const updatedData = { ...prevData, [name]: value };

        if (name === "address" || name === "postCode" || name === "city") {
          fetchCoordinates(updatedData.address, updatedData.postCode);
        }

        return updatedData;
      });
    }

    if (name === "capacity") {
      const newCapacity = parseInt(value);

      // Update form data
      setFormData((prev) => ({ ...prev, [name]: value }));

      // Validate capacity
      if (!isNaN(newCapacity)) {
        if (newCapacity < currentTickets) {
          const neededRemovals = currentTickets - newCapacity;
          setCapacityError(
            `Cannot set capacity below current tickets. Remove ${neededRemovals} ticket(s) first.`
          );
        } else {
          setCapacityError(null);
        }
      }
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_SIZE_MB = 5;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

      if (file.size > MAX_SIZE_BYTES) {
        setError(`Image size must be under ${MAX_SIZE_MB}MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prevData) => ({
          ...prevData,
          image: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prevData) => ({
      ...prevData,
      image: null,
    }));
  };

  const fetchCoordinates = async (address: string, postCode: string) => {
    const formattedAddress = `${address}, ${postCode}, ${formData.city}, UK`;
    const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      formattedAddress
    )}&key=${API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "OK") {
        const location = data.results[0].geometry.location;
        setFormData((prevData) => ({
          ...prevData,
          latitude: location.lat,
          longitude: location.lng,
        }));
      } else {
        console.error("Geocoding failed:", data.status);
      }
    } catch (error) {
      console.error("Error fetching geolocation:", error);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setCapacityError(null);

    // Validation
    let isValid = true;

    if (!UK_POSTCODE_REGEX.test(formData.postCode)) {
      setPostcodeError("Invalid postcode format.");
      isValid = false;
    } else {
      setPostcodeError(null);
    }

    const formattedPrice = parseFloat(formData.price).toFixed(2);
    if (parseFloat(formData.price) < 0) {
      setPriceError("Price cannot be negative.");
      isValid = false;
    } else {
      setPriceError(null);
    }

    if (formattedPrice !== formData.price) {
      setFormData((prevData) => ({
        ...prevData,
        price: formattedPrice,
      }));
    }

    const newCapacity = parseInt(formData.capacity);
    if (newCapacity < currentTickets) {
      setCapacityError(
        `Cannot reduce capacity below current tickets (${currentTickets}).`
      );
      setIsLoading(false);
      return;
    } else if (newCapacity <= 0) {
      setCapacityError("Capacity must be a positive number.");
      isValid = false;
    }

    const startTimeUTC = new Date(formData.startTime).toISOString();
    const endTimeUTC = new Date(formData.endTime).toISOString();

    const currentLocalTime = new Date();
    const currentLocalISO = currentLocalTime.toISOString().slice(0, 16);

    if (formData.startTime < currentLocalISO) {
      setStartTimeError("Start time cannot be in the past.");
      isValid = false;
    }

    if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      setEndTimeError("End time must be after start time.");
      isValid = false;
    }

    if (!formData.city.trim()) {
      setCityError("City is required.");
      isValid = false;
    } else {
      setCityError(null);
    }

    if (formData.categories.length === 0) {
      setError("Please select at least one category.");
      setIsLoading(false);
      return;
    }

    if (!isValid) {
      setIsLoading(false);
      return;
    }

    const jwt = localStorage.getItem("authToken");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/my-events/edit-event/${eventId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            ...formData,
            startTime: startTimeUTC,
            endTime: endTimeUTC,
            image: formData.image || DEFAULT_IMAGE_URL,
            price: parseFloat(formData.price),
            capacity: parseInt(formData.capacity),
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        navigate(`/user-dashboard`);
      } else {
        if (data.message?.includes("Cannot reduce capacity below")) {
          setCapacityError(data.message);
        } else {
          setError(data.message || "Event update failed. Please try again.");
        }
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Collect all error messages
  const allErrors = [
    postcodeError,
    capacityError,
    priceError,
    startTimeError,
    endTimeError,
    cityError,
    error,
  ].filter(Boolean);

  if (isFetching) {
    return <div className="loading">Loading event data...</div>;
  }

  return (
    <div className="event-container">
      <div className="event-form-card">
        <h2>Edit Event</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ cursor: "not-allowed" }}>
            <label>Title:</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              maxLength={30}
              readOnly
              style={{
                cursor: "not-allowed",
                backgroundColor: "#f5f5f5",
                color: "#555",
              }}
            />
          </div>

          <div className="form-group">
            <label>
              Description: <span className="red-asterisk">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group image-upload-container">
            <label>Event Thumbnail: </label>
            <div className="custom-upload">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                id="image-upload-input"
              />
              <label
                htmlFor="image-upload-input"
                className="custom-upload-button"
              >
                Change Image
              </label>
            </div>
            {formData.image && (
              <div className="image-preview">
                <img src={formData.image} alt="Event Preview" width="150" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="remove-image-btn"
                >
                  ✖ Remove
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>
              Start Time: <span className="red-asterisk">*</span>
            </label>
            <input
              type="datetime-local"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              End Time: <span className="red-asterisk">*</span>
            </label>
            <input
              type="datetime-local"
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Address: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              City: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Postcode: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              name="postCode"
              value={formData.postCode}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Gender Specific: <span className="red-asterisk">*</span>
            </label>
            <select
              name="genderSpecific"
              value={formData.genderSpecific}
              onChange={handleChange}
              required
            >
              <option value="all">All</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Capacity:<span className="red-asterisk">*</span> (Current tickets:{" "}
              {currentTickets}){" "}
            </label>
            <div className="capacity-info">
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                required
                min={currentTickets}
                formNoValidate
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              Price (£): <span className="red-asterisk">*</span>
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label>
              Categories: <span className="red-asterisk">*</span>
            </label>
            <div className="checkbox-group">
              {categoriesList.map((category) => (
                <label key={category} className="checkbox-label">
                  <span>{category}</span>
                  <input
                    type="checkbox"
                    name="categories"
                    value={category}
                    checked={formData.categories.includes(category)}
                    onChange={(e) => {
                      const { value, checked } = e.target;
                      setFormData((prevData) => ({
                        ...prevData,
                        categories: checked
                          ? [...prevData.categories, value]
                          : prevData.categories.filter((c) => c !== value),
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          {allErrors.length > 0 && (
            <div className="error-summary">
              <h3>Please fix the following errors:</h3>
              <ul>
                {allErrors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
              {capacityError?.includes("remove") && (
                <button
                  type="button"
                  className="manage-tickets-btn"
                  onClick={() => navigate(`/event/${eventId}/attendees`)}
                >
                  Manage Tickets
                </button>
              )}
            </div>
          )}

          <button type="submit" className="event-btn" disabled={isLoading}>
            {isLoading ? "Updating Event..." : "Update Event"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditEventForm;
