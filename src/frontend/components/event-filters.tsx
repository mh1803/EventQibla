import React from "react";
import "../../../public/css/event-filters.css";
import { useUser } from "../context/UserContext.js";

interface EventFilterProps {
  categoriesList: string[];
  selectedCategories: string[];
  allCategoriesChecked: boolean;
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  setAllCategoriesChecked: React.Dispatch<React.SetStateAction<boolean>>;
  genderFilter: "all" | "men" | "women" | "";
  setGenderFilter: React.Dispatch<
    React.SetStateAction<"all" | "men" | "women" | "">
  >;
  sortOrder: string;
  setSortOrder: React.Dispatch<React.SetStateAction<string>>;
  locationFilterType: "location" | "postcode" | "city" | "";
  setLocationFilterType: (value: "location" | "postcode" | "city" | "") => void;
  postcode: string;
  setPostcode: React.Dispatch<React.SetStateAction<string>>;
  city: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  maxDistance: number | string;
  setMaxDistance: React.Dispatch<React.SetStateAction<number | string>>;
  maxPrice: number | string;
  setMaxPrice: React.Dispatch<React.SetStateAction<number | string>>;
  handlePostcodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMaxDistanceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMaxPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setUserLocation: React.Dispatch<
    React.SetStateAction<{ lat: number; lon: number } | null>
  >;
  handleAllCategoriesChange: () => void;
  handleCategoryChange: (category: string) => void;
}

const EventFilters: React.FC<EventFilterProps> = ({
  categoriesList,
  selectedCategories,
  allCategoriesChecked,
  setSelectedCategories,
  setAllCategoriesChecked,
  genderFilter,
  setGenderFilter,
  sortOrder,
  setSortOrder,
  locationFilterType,
  setLocationFilterType,
  postcode,
  setPostcode,
  city,
  setCity,
  maxDistance,
  setMaxDistance,
  maxPrice,
  setMaxPrice,
  handlePostcodeChange,
  handleCityChange,
  handleMaxDistanceChange,
  handleMaxPriceChange,
  setUserLocation,
}) => {
  const { userRole } = useUser();

  const handleAllCategoriesChange = () => {
    setSelectedCategories(allCategoriesChecked ? [] : [...categoriesList]);
    setAllCategoriesChecked(!allCategoriesChecked);
  };

  const handleCategoryChange = (category: string) => {
    const updatedCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(updatedCategories);
    setAllCategoriesChecked(updatedCategories.length === categoriesList.length);
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting user location:", error);
          alert(
            "Unable to retrieve your location. Please ensure location services are enabled."
          );
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleLocationFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as "location" | "postcode" | "city" | "";
    setLocationFilterType(value);

    if (value === "location") {
      getUserLocation();
    }
  };

  return (
    <div className="filters">
      {/* Categories Section */}
      <div className="categories-section">
        <fieldset>
          <legend>Categories:</legend>
          <label style={{ marginRight: "10px" }}>
            <input
              type="checkbox"
              checked={allCategoriesChecked}
              onChange={handleAllCategoriesChange}
            />
            All
          </label>

          {categoriesList.map((category) => (
            <label key={category} style={{ marginRight: "10px" }}>
              <input
                type="checkbox"
                value={category}
                checked={selectedCategories.includes(category)}
                onChange={() => handleCategoryChange(category)}
              />
              {category}
            </label>
          ))}
        </fieldset>
      </div>

      {/* Top Row: Sort, Gender Filter, and Max Price */}
      <div className="filters-top-row">
        {/* Sort and Gender Filter Section */}
        <div className="filters-middle-section">
          <select
            onChange={(e) => setSortOrder(e.target.value)}
            value={sortOrder}
          >
            <option value="upcoming-first">Upcoming First</option>
            <option value="latest-first">Latest First</option>
            <option value="a-z">A-Z</option>
            <option value="z-a">Z-A</option>
            {/* Admin-only options */}
            {userRole === "admin" && (
              <>
                <option value="flag-count-asc">Flag Count (Ascending)</option>
                <option value="flag-count-desc">Flag Count (Descending)</option>
                <option value="flagged-recently">Flagged Recently</option>
                <option value="flagged-oldest">Flagged Oldest</option>
              </>
            )}
          </select>

          <select
            onChange={(e) =>
              setGenderFilter(e.target.value as "all" | "men" | "women" | "")
            }
            value={genderFilter}
          >
            <option value="">All Genders</option>
            <option value="men">For Men</option>
            <option value="women">For Women</option>
          </select>
        </div>

        {/* Max Price Section */}
        <div className="price-filter-container">
          <label htmlFor="maxPrice">Max Price (£):</label>
          <input
            type="number"
            id="maxPrice"
            value={maxPrice}
            onChange={handleMaxPriceChange}
            placeholder="Enter max price"
            min="0"
          />
        </div>
      </div>

      {/* Find by Location Section */}
      <div className="location-section">
        <label htmlFor="locationFilter">Find by:</label>
        <select
          id="locationFilter"
          value={locationFilterType}
          onChange={handleLocationFilterChange}
        >
          <option value="city">City</option>
          <option value="postcode">Postcode</option>
          <option value="location">My Location</option>
        </select>

        {locationFilterType === "city" && (
          <div>
            <label htmlFor="city">City:</label>
            <input
              type="text"
              id="city"
              value={city}
              onChange={handleCityChange}
              placeholder="Enter your city"
            />
          </div>
        )}

        {locationFilterType === "postcode" && (
          <div>
            <label htmlFor="postcode">Postcode:</label>
            <input
              type="text"
              id="postcode"
              value={postcode}
              onChange={handlePostcodeChange}
              placeholder="Enter your postcode"
            />
          </div>
        )}

        {["postcode", "location"].includes(locationFilterType) && (
          <div>
            <label htmlFor="maxDistance">Max Distance (km):</label>
            <input
              id="maxDistance"
              type="number"
              value={maxDistance}
              onChange={handleMaxDistanceChange}
              placeholder="Enter max distance"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EventFilters;
