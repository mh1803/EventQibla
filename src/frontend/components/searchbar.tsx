import React, { useState, useCallback, useEffect } from "react";
import debounce from "lodash.debounce";
import "../../../public/css/searchbar.css";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState("");

  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      onSearch(searchQuery);
    }, 300),
    [onSearch]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchQuery = e.target.value;
    setQuery(searchQuery);
    debouncedSearch(searchQuery);
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch(query);
    }
  };

  return (
    <div className="search-bar">
      <div className="search-input-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search for events..."
          value={query}
          onChange={handleSearch}
          onKeyPress={handleKeyPress}
        />
        {query && (
          <button
            className="clear-button"
            onClick={handleClear}
            aria-label="Clear"
          >
            ✖
          </button>
        )}
      </div>
      <button
        className="search-button"
        onClick={() => onSearch(query)}
        aria-label="Search"
      >
        🔍
      </button>
    </div>
  );
};

export default SearchBar;
