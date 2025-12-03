import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../frontend/hooks/useAuth.js";

interface UserContextType {
  profilePicture: string;
  setProfilePicture: (url: string) => void;
  userRole: string;
  userId?: number;
  isProfileLoading: boolean;
  error: string | null;
  updateProfilePicture: (userId: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEFAULT_PROFILE_PIC = "/images/default_profile.png";

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profilePicture, setProfilePicture] =
    useState<string>(DEFAULT_PROFILE_PIC);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get auth data from useAuth hook
  const { userData } = useAuth();
  const userRole = userData?.role || "user";
  const userId = userData?.userId;

  const updateProfilePicture = async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const response = await axios.get(`/api/${userId}/profile-picture`);
      setProfilePicture(response.data.image || DEFAULT_PROFILE_PIC);
      setError(null);
    } catch (err) {
      setError("Failed to load profile picture");
      setProfilePicture(DEFAULT_PROFILE_PIC);
    } finally {
      setIsProfileLoading(false);
    }
  };

  return (
    <UserContext.Provider
      value={{
        profilePicture,
        setProfilePicture,
        userRole,
        userId,
        isProfileLoading,
        error,
        updateProfilePicture,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
