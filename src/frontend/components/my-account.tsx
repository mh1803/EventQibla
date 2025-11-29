import React, {
  useState,
  ChangeEvent,
  useEffect,
  useCallback,
  memo,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import "../../../public/css/my-account.css";

const ProfilePictureModal = lazy(() =>
  import("./modals/profile-picture-modal.js").then((module) => ({
    default: module.ProfilePictureModal,
  }))
);

interface UserData {
  id: number;
  username: string;
  profilePicture: string | null;
  averageRating: number;
  reviewCount: number;
  email: string;
  joinDate: string;
}

const DEFAULT_PROFILE_PIC = "/images/default_profile.png";

const RatingStars = memo(({ rating }: { rating: number }) => (
  <div className="rating-stars">
    {[...Array(5)].map((_, i) => (
      <span
        key={i}
        className={`star ${i < Math.round(rating) ? "filled" : ""}`}
      >
        ★
      </span>
    ))}
  </div>
));

const MyAccount = () => {
  const { profilePicture, setProfilePicture } = useUser();
  const [userData, setUserData] = useState<UserData>({
    id: 0,
    username: "",
    profilePicture: null,
    averageRating: 0,
    reviewCount: 0,
    email: "",
    joinDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const navigate = useNavigate();

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const fetchUserData = useCallback(async () => {
    const jwt = localStorage.getItem("authToken");
    if (!jwt) {
      navigate("/login", { state: { from: location } });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch user data
      const userResponse = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!userResponse.ok) throw new Error("Failed to fetch user data");
      const userData = await userResponse.json();

      // Fetch in parallel
      const [ratingResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/user/${userData.id}/rating`),
      ]);

      const ratingData = ratingResponse.ok
        ? await ratingResponse.json()
        : { averageRating: 0, reviewCount: 0 };

      setUserData({
        id: userData.id,
        username: userData.username,
        profilePicture: profilePicture,
        averageRating: ratingData.averageRating || 0,
        reviewCount: ratingData.reviewCount || 0,
        email: userData.email,
        joinDate: new Date(userData.created_at).toLocaleDateString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading user data");
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL, navigate, profilePicture]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleImageUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const MAX_SIZE_MB = 5;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

      if (file.size > MAX_SIZE_BYTES) {
        setError(`Image size must be under ${MAX_SIZE_MB}MB.`);
        return;
      }

      if (!validTypes.includes(file.type)) {
        setError("Please upload a valid image (JPEG, PNG, GIF, WEBP).");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });

        const jwt = localStorage.getItem("authToken");
        const response = await fetch(
          `${API_BASE_URL}/api/user/profile-picture`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwt}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: base64Image }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to upload profile picture"
          );
        }

        const pictureResponse = await fetch(
          `${API_BASE_URL}/api/user/${userData.id}/profile-picture`
        );
        const pictureData = pictureResponse.ok
          ? await pictureResponse.json()
          : { image: DEFAULT_PROFILE_PIC };

        const profilePictureUrl = pictureData.image || DEFAULT_PROFILE_PIC;
        setProfilePicture(profilePictureUrl);
        setUserData((prev) => ({ ...prev, profilePicture: profilePictureUrl }));
        setSuccessMessage("Profile picture updated successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error uploading profile picture"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE_URL, userData.id, setProfilePicture]
  );

  const handleRemoveImage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const jwt = localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/api/user/profile-picture`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to remove profile picture"
        );
      }

      setProfilePicture(DEFAULT_PROFILE_PIC);
      setUserData((prev) => ({ ...prev, profilePicture: DEFAULT_PROFILE_PIC }));
      setSuccessMessage("Profile picture removed successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowRemoveModal(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error removing profile picture"
      );
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL, setProfilePicture]);

  if (isLoading && !userData.username) {
    return (
      <div className="account-container">
        <div className="account-card">
          <h2>My Account</h2>
          <p>Loading your account information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-container">
      <div className="account-card">
        <h2>My Account</h2>

        <div className="profile-section">
          <div className="profile-picture-container">
            <div className="profile-picture-wrapper">
              <img
                src={userData.profilePicture || DEFAULT_PROFILE_PIC}
                alt="Profile"
                className="profile-picture"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_PROFILE_PIC;
                }}
                loading="lazy"
              />
            </div>

            <div className="profile-picture-actions">
              <label className="upload-button">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                  disabled={isLoading}
                />
                {isLoading ? "Uploading..." : "Upload New Photo"}
              </label>

              {userData.profilePicture !== DEFAULT_PROFILE_PIC && (
                <button
                  onClick={() => setShowRemoveModal(true)}
                  className="remove-button"
                  disabled={isLoading}
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          <div className="profile-info">
            <h3>{userData.username}</h3>
            <p>Email: {userData.email}</p>
            <p>Member since: {userData.joinDate}</p>

            <div className="rating-section">
              <RatingStars rating={userData.averageRating} />
              <p>
                {userData.averageRating.toFixed(1)} ({userData.reviewCount}{" "}
                {userData.reviewCount === 1 ? "review" : "reviews"})
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} className="close-error">
              ×
            </button>
          </div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <Suspense>
          {showRemoveModal && (
            <ProfilePictureModal
              onConfirm={handleRemoveImage}
              onCancel={() => setShowRemoveModal(false)}
              isLoading={isLoading}
              error={error}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default memo(MyAccount);
