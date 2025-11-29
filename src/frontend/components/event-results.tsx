import React, { useState, useEffect, useCallback, useRef } from "react";
import "../../../public/css/event-results.css";
import SearchBar from "./searchbar.js";
import EventFilters from "./event-filters.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDateWithOrdinal } from "../../backend/utils/dateFormatter.js";
import { calculateDistance } from "../../backend/utils/calculateDistance.js";
import { useUser } from "../context/UserContext.js";

interface Event {
  id: string;
  title: string;
  imageUrl: string;
  categories: string[];
  price: number;
  genderSpecific: "all" | "men" | "women";
  startTime: string;
  endTime: string;
  address: string;
  city: string;
  postCode: string;
  latitude: number;
  longitude: number;
  flaggedCount?: number;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const categoriesList = ["Lecture", "Charity", "Study Group", "Social"];

const categoryUrlMapping: Record<string, string> = {
  lectures: "Lecture",
  charity: "Charity",
  study: "Study Group",
  social: "Social",
};

const reverseCategoryMapping: Record<string, string> = {
  Lecture: "lectures",
  Charity: "charity",
  "Study Group": "study",
  Social: "social",
};

const EventResults: React.FC = () => {
  const { userRole } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(categoriesList);
  const [allCategoriesChecked, setAllCategoriesChecked] = useState(true);
  const [genderFilter, setGenderFilter] = useState<
    "all" | "men" | "women" | ""
  >("");
  const [sortOrder, setSortOrder] = useState("upcoming-first");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [postcode, setPostcode] = useState("");
  const [maxDistance, setMaxDistance] = useState<number | string>("");
  const [maxPrice, setMaxPrice] = useState<number | string>("");
  const [locationFilterType, setLocationFilterType] = useState<
    "location" | "postcode" | "city" | ""
  >("city");
  const [city, setCity] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [pagination, setPagination] = useState<Pagination>({
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    itemsPerPage: 24,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const navigate = useNavigate();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const fetchCoordinatesFromPostcode = async (postcode: string) => {
    try {
      const cleanedPostcode = postcode.replace(/\s+/g, "").toUpperCase();
      if (cleanedPostcode.length < 5) return null;

      const response = await fetch(
        `https://api.postcodes.io/postcodes/${cleanedPostcode}`
      );
      if (!response.ok) throw new Error("Invalid postcode");

      const data = await response.json();
      return { lat: data.result.latitude, lon: data.result.longitude };
    } catch (error) {
      console.error("Error fetching postcode coordinates:", error);
      return null;
    }
  };

  const debouncedPostcodeLookup = useCallback(
    (
      postcode: string,
      callback: (location: { lat: number; lon: number } | null) => void
    ) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(async () => {
        const location = await fetchCoordinatesFromPostcode(postcode);
        callback(location);
      }, 500); // 500ms debounce delay
    },
    []
  );

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      const categoryName = categoryUrlMapping[categoryParam] || categoryParam;
      setSelectedCategories([categoryName]);
      setAllCategoriesChecked(false);
    } else {
      setSelectedCategories(categoriesList);
      setAllCategoriesChecked(true);
    }
  }, [searchParams]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (permission.state === "denied") {
            alert(
              "Location access is denied. Please enable location permissions in your browser settings."
            );
          } else {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setUserLocation({
                  lat: position.coords.latitude,
                  lon: position.coords.longitude,
                });
              },
              (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                  alert(
                    "You have denied location access. Enable it in settings to use this feature."
                  );
                } else {
                  console.error("Error getting user location:", error);
                  alert(
                    "Unable to retrieve your location. Please ensure location services are enabled."
                  );
                }
              }
            );
          }
        });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleLocationFilterChange = (
    value: "location" | "postcode" | "city" | ""
  ) => {
    setLocationFilterType(value);
    if (value === "location") {
      const confirmLocation = window.confirm(
        "Would you like to share your location to find nearby events?"
      );
      if (confirmLocation) {
        getUserLocation();
      }
    }
  };

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    const queryParams = new URLSearchParams();

    queryParams.append("page", currentPage.toString());
    queryParams.append("limit", itemsPerPage.toString());

    if (searchQuery) queryParams.append("search", searchQuery);
    if (selectedCategories.length > 0) {
      queryParams.append("categories", selectedCategories.join(","));
    }
    if (genderFilter) queryParams.append("gender", genderFilter);
    if (sortOrder) queryParams.append("sort", sortOrder);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/event/events?${queryParams}`
      );
      if (!response.ok)
        throw new Error(`Error ${response.status}: ${response.statusText}`);

      const { data, pagination } = await response.json();
      setPagination(pagination);

      if (selectedCategories.length === 0) {
        setFilteredEvents([]);
        setPagination({
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          itemsPerPage: itemsPerPage,
          hasNextPage: false,
          hasPreviousPage: false,
        });
        setIsLoading(false);
        return;
      }

      let location: { lat: number; lon: number } | null = null;
      if (locationFilterType === "location" && userLocation) {
        location = userLocation;
      } else if (locationFilterType === "postcode" && postcode) {
        await new Promise<void>((resolve) => {
          debouncedPostcodeLookup(postcode, (result) => {
            location = result;
            resolve();
          });
        });
      }

      let eventsWithDistance = data;
      if (locationFilterType === "city" && city.trim()) {
        eventsWithDistance = data.filter(
          (event: Event) =>
            event.city.toLowerCase() === city.trim().toLowerCase()
        );
      } else if (location) {
        eventsWithDistance = data.filter((event: Event) => {
          const distance = calculateDistance(
            location!.lat,
            location!.lon,
            event.latitude,
            event.longitude
          );
          return maxDistance === 0
            ? false
            : distance <= (maxDistance ? Number(maxDistance) : Infinity);
        });
      }

      const eventsWithPrice = eventsWithDistance.filter((event: Event) => {
        const eventPrice = event.price;
        return maxPrice === "" || eventPrice <= Number(maxPrice);
      });

      setFilteredEvents(eventsWithPrice);
    } catch (error) {
      console.error("Error fetching events:", error);
      setFilteredEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    selectedCategories,
    genderFilter,
    sortOrder,
    userLocation,
    postcode,
    maxDistance,
    locationFilterType,
    city,
    maxPrice,
    debouncedPostcodeLookup,
  ]);

  useEffect(() => {
    fetchEvents();
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fetchEvents]);

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const regex = /^\d*\.?\d{0,2}$/;
    if (regex.test(value)) {
      setMaxPrice(value === "" ? "" : Number(value));
    }
  };

  const handleAllCategoriesChange = () => {
    const newChecked = !allCategoriesChecked;
    const newCategories = newChecked ? [...categoriesList] : [];
    setSelectedCategories(newCategories);
    setAllCategoriesChecked(newChecked);

    if (newChecked) {
      searchParams.delete("category");
    } else if (newCategories.length === 1) {
      const queryValue =
        reverseCategoryMapping[newCategories[0]] || newCategories[0];
      searchParams.set("category", queryValue);
    } else {
      searchParams.delete("category");
    }
    setSearchParams(searchParams);
  };

  const handleCategoryChange = (category: string) => {
    let updatedCategories;
    if (selectedCategories.includes(category)) {
      updatedCategories = selectedCategories.filter((c) => c !== category);
    } else {
      updatedCategories = [...selectedCategories, category];
    }

    setSelectedCategories(updatedCategories);
    setAllCategoriesChecked(updatedCategories.length === categoriesList.length);

    if (updatedCategories.length === 1) {
      const queryValue =
        reverseCategoryMapping[updatedCategories[0]] || updatedCategories[0];
      searchParams.set("category", queryValue);
    } else {
      searchParams.delete("category");
    }
    setSearchParams(searchParams);
  };

  const PaginationControls = () => (
    <div className="pagination-controls">
      <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
        First
      </button>
      <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </button>

      <span>
        Page {currentPage} of {pagination.totalPages}
      </span>

      <button
        onClick={() =>
          setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
        }
        disabled={currentPage === pagination.totalPages}
      >
        Next
      </button>
      <button
        onClick={() => setCurrentPage(pagination.totalPages)}
        disabled={currentPage === pagination.totalPages}
      >
        Last
      </button>

      <select
        value={itemsPerPage}
        onChange={(e) => {
          setItemsPerPage(Number(e.target.value));
          setCurrentPage(1);
        }}
      >
        <option value="12">12 per page</option>
        <option value="24">24 per page</option>
        <option value="36">36 per page</option>
      </select>
    </div>
  );

  return (
    <div className="event-results">
      <SearchBar onSearch={setSearchQuery} />
      <EventFilters
        categoriesList={categoriesList}
        selectedCategories={selectedCategories}
        allCategoriesChecked={allCategoriesChecked}
        setSelectedCategories={setSelectedCategories}
        setAllCategoriesChecked={setAllCategoriesChecked}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        locationFilterType={locationFilterType}
        setLocationFilterType={handleLocationFilterChange}
        postcode={postcode}
        setPostcode={setPostcode}
        city={city}
        setCity={setCity}
        maxDistance={maxDistance}
        setMaxDistance={setMaxDistance}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        handlePostcodeChange={(e) => setPostcode(e.target.value)}
        handleCityChange={(e) => setCity(e.target.value)}
        handleMaxDistanceChange={(e) =>
          setMaxDistance(e.target.value === "" ? "" : Number(e.target.value))
        }
        handleMaxPriceChange={handleMaxPriceChange}
        setUserLocation={setUserLocation}
        handleAllCategoriesChange={handleAllCategoriesChange}
        handleCategoryChange={handleCategoryChange}
      />

      <PaginationControls />

      <div className="event-list">
        {isLoading ? (
          <div className="loading-spinner">
            <p>Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <p>No events found.</p>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="event-card"
              onClick={() => navigate(`/events/${event.id}`)}
              style={{ cursor: "pointer" }}
            >
              {event.imageUrl ? (
                <div className="event-image-container">
                  <img src={event.imageUrl} alt={event.title} />
                </div>
              ) : (
                <div className="event-image-container">No Image Available</div>
              )}

              <div className="event-card-content">
                <h3>{event.title}</h3>
                <p>
                  🕒 {formatDateWithOrdinal(event.startTime)} -{" "}
                  {formatDateWithOrdinal(event.endTime)}
                </p>
                <p>
                  📍 {event.address}, {event.city}, {event.postCode}
                </p>
                <p>
                  👤{" "}
                  {event.genderSpecific === "all"
                    ? "Everyone"
                    : event.genderSpecific === "men"
                    ? "Men"
                    : "Women"}
                </p>
                <p className="categories">{event.categories.join(", ")}</p>
                <div className="event-price">
                  {event &&
                    (event.price == 0
                      ? "Free"
                      : `£${Number(event.price).toFixed(2)}`)}
                </div>
                {userRole === "admin" && event.flaggedCount !== undefined && (
                  <div className="event-flag-count">
                    ⚑ : {event.flaggedCount}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <PaginationControls />
    </div>
  );
};

export default EventResults;
