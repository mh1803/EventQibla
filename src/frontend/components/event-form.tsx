import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  status: "active" | "completed" | "cancelled";
  categories: string[];
}

const DEFAULT_IMAGE_URL = "/images/default_cover.png";
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

const EventForm = () => {
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
    status: "active",
    categories: [],
  });

  const [titleError, setTitleError] = useState<string | null>(null);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [latitudeError, setLatitudeError] = useState<string | null>(null);
  const [longitudeError, setLongitudeError] = useState<string | null>(null);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const navigate = useNavigate();

  // Categories list
  const categoriesList: string[] = [
    "Lecture",
    "Charity",
    "Study Group",
    "Social",
  ];

  useEffect(() => {
    const jwt = localStorage.getItem("authToken");
    if (!jwt) {
      navigate("/login", { state: { from: location } });
    }
  }, [navigate]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "title") {
      if (value.length > 30) {
        setTitleError("Title cannot exceed 30 characters.");
        return;
      } else {
        setTitleError(null);
      }
    }

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

        // Call fetchCoordinates if address or postcode changes
        if (name === "address" || name === "postCode" || name === "city") {
          fetchCoordinates(updatedData.address, updatedData.postCode);
        }

        return updatedData;
      });
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_SIZE_MB = 5;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024; // 5MB in bytes

      // Check if the file is too large
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Image size must be under ${MAX_SIZE_MB}MB.`);
        return;
      }

      // If valid image, continue with the FileReader logic
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

    let isValid = true;

    // Postcode validation
    if (!UK_POSTCODE_REGEX.test(formData.postCode)) {
      setPostcodeError("Invalid postcode format.");
      isValid = false;
    } else {
      setPostcodeError(null);
    }

    // Capacity validation
    if (parseInt(formData.capacity) <= 0) {
      setCapacityError("Capacity must be a positive number.");
      isValid = false;
    } else {
      setCapacityError(null);
    }

    // Price validation
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

    // Start time validation
    const currentTime = new Date().toISOString().slice(0, 16);
    if (formData.startTime < currentTime) {
      setStartTimeError("Start time cannot be in the past.");
      isValid = false;
    } else {
      setStartTimeError(null);
    }

    // End time validation
    if (formData.endTime <= formData.startTime) {
      setEndTimeError("End time must be after start time.");
      isValid = false;
    } else {
      setEndTimeError(null);
    }

    // City validation
    if (!formData.city.trim()) {
      setCityError("City is required.");
      isValid = false;
    } else {
      setCityError(null);
    }

    // Categories validation
    if (formData.categories.length === 0) {
      setError("Please select at least one category.");
      setIsLoading(false);
      return;
    } else {
      setError(null);
    }

    if (!isValid) {
      setIsLoading(false);
      return;
    }

    const finalData = {
      ...formData,
      image: formData.image || DEFAULT_IMAGE_URL,
    };

    const jwt = localStorage.getItem("authToken");

    try {
      const response = await fetch(`${API_BASE_URL}/api/event/create-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(finalData),
      });

      const data = await response.json();

      if (response.ok) {
        navigate("/user-dashboard");
      } else {
        setError(data.message || "Event creation failed. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Collect all error messages
  const allErrors = [
    titleError,
    postcodeError,
    capacityError,
    priceError,
    startTimeError,
    endTimeError,
    cityError,
    latitudeError,
    longitudeError,
    error,
  ].filter(Boolean);

  return (
    <div className="event-container">
      <div className="event-form-card">
        <h2>Create an event</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Title: <span className="red-asterisk">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={30}
            />
            <p>{formData.title.length}/30 characters</p>
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
            <label>Upload Event Thumbnail:</label>
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
                Choose Image
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
              Capacity: <span className="red-asterisk">*</span>
            </label>
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              required
            />
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

          {/* Displays all errors above the submit button */}
          {allErrors.length > 0 && (
            <div className="error-summary">
              <h3>Please fix the following errors:</h3>
              <ul>
                {allErrors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" className="event-btn" disabled={isLoading}>
            {isLoading ? "Creating Event..." : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EventForm;
